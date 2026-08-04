import "server-only";
import { and, asc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { employees, compensation, teamMemberships, teams as teamsTable, type User, type Employee } from "@/db/schema";
import {
  canCreateEmployee,
  canDeleteEmployee,
  canEditEmployee,
  canEditSalary,
  canViewSalary,
} from "@/lib/authz";
import { wouldCreateCycle, getSubtreeIds } from "@/lib/tree";
import { writeAudit, diffFields } from "@/lib/audit";
import type { EmployeeInput } from "@/lib/validation";

export class ForbiddenError extends Error {}
export class CycleError extends Error {
  constructor() {
    super("That change would create a reporting cycle (the new manager is in this employee's own reporting line).");
  }
}

export type DirectoryFilters = {
  q?: string;
  department?: string;
  status?: string;
  teamId?: string;
  /** restrict to the subtree under this employee (used by "My team" view) */
  subtreeOf?: string;
};

export type DirectoryRow = Employee & {
  managerName: string | null;
  managerEmail: string | null;
  salary: number | null; // null = none recorded OR not permitted to see
  canEdit: boolean;
};

const AUDITED_FIELDS = [
  "firstName",
  "lastName",
  "email",
  "title",
  "department",
  "phone",
  "location",
  "hireDate",
  "status",
  "managerId",
] as const;

function directoryConditions(f: DirectoryFilters): SQL[] {
  const conds: SQL[] = [];
  if (f.q) {
    const like = `%${f.q}%`;
    conds.push(
      or(
        sql`(${employees.firstName} || ' ' || ${employees.lastName}) ILIKE ${like}`,
        ilike(employees.email, like),
        ilike(employees.title, like),
        ilike(employees.department, like),
      )!,
    );
  }
  if (f.department) conds.push(eq(employees.department, f.department));
  if (f.status && ["active", "on_leave", "terminated"].includes(f.status)) {
    conds.push(eq(employees.status, f.status as Employee["status"]));
  }
  return conds;
}

/**
 * Directory rows are visible to all authenticated users; salary is attached
 * per-row only where authz allows. This same function backs the exports, so
 * filters and salary gating can't diverge between screen and file.
 */
export async function listEmployees(user: User, f: DirectoryFilters = {}): Promise<DirectoryRow[]> {
  const manager = alias(employees, "manager");
  const conds = directoryConditions(f);

  if (f.teamId) {
    const memberIds = (
      await db.select({ id: teamMemberships.employeeId }).from(teamMemberships).where(eq(teamMemberships.teamId, f.teamId))
    ).map((r) => r.id);
    if (!memberIds.length) return [];
    conds.push(inArray(employees.id, memberIds));
  }
  if (f.subtreeOf) {
    const ids = await getSubtreeIds(db, f.subtreeOf);
    if (!ids.length) return [];
    conds.push(inArray(employees.id, ids));
  }

  const rows = await db
    .select({
      emp: employees,
      managerName: sql<string | null>`${manager.firstName} || ' ' || ${manager.lastName}`,
      managerEmail: manager.email,
    })
    .from(employees)
    .leftJoin(manager, eq(employees.managerId, manager.id))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(asc(employees.lastName), asc(employees.firstName));

  const visibleSalaryIds = rows
    .filter((r) => canViewSalary(user, r.emp))
    .map((r) => r.emp.id);
  const comps = visibleSalaryIds.length
    ? await db.select().from(compensation).where(inArray(compensation.employeeId, visibleSalaryIds))
    : [];
  const salaryByEmp = new Map(comps.map((c) => [c.employeeId, c.salary]));

  return rows.map((r) => ({
    ...r.emp,
    managerName: r.managerName,
    managerEmail: r.managerEmail,
    salary: salaryByEmp.get(r.emp.id) ?? null,
    canEdit: canEditEmployee(user, r.emp),
  }));
}

export async function listDepartments(): Promise<string[]> {
  const rows = await db
    .selectDistinct({ d: employees.department })
    .from(employees)
    .orderBy(asc(employees.department));
  return rows.map((r) => r.d).filter((d): d is string => Boolean(d));
}

export type EmployeeDetail = DirectoryRow & {
  reports: { id: string; name: string; title: string | null }[];
  teams: { id: string; name: string; roleInTeam: string }[];
  canDelete: boolean;
  salaryVisible: boolean;
};

export async function getEmployee(user: User, id: string): Promise<EmployeeDetail | null> {
  const emp = await db.query.employees.findFirst({ where: eq(employees.id, id) });
  if (!emp) return null;

  const manager = emp.managerId
    ? await db.query.employees.findFirst({ where: eq(employees.id, emp.managerId) })
    : null;

  const reports = await db
    .select({ id: employees.id, firstName: employees.firstName, lastName: employees.lastName, title: employees.title })
    .from(employees)
    .where(eq(employees.managerId, id))
    .orderBy(asc(employees.lastName));

  const memberships = await db
    .select({ id: teamMemberships.teamId, roleInTeam: teamMemberships.roleInTeam })
    .from(teamMemberships)
    .where(eq(teamMemberships.employeeId, id));
  const teamRows = memberships.length
    ? await db.select().from(teamsTable).where(inArray(teamsTable.id, memberships.map((m) => m.id)))
    : [];
  const roleByTeam = new Map(memberships.map((m) => [m.id, m.roleInTeam]));

  const salaryVisible = canViewSalary(user, emp);
  const comp = salaryVisible
    ? await db.query.compensation.findFirst({ where: eq(compensation.employeeId, id) })
    : null;

  return {
    ...emp,
    managerName: manager ? `${manager.firstName} ${manager.lastName}` : null,
    managerEmail: manager?.email ?? null,
    salary: comp?.salary ?? null,
    salaryVisible,
    canEdit: canEditEmployee(user, emp),
    canDelete: canDeleteEmployee(user),
    reports: reports.map((r) => ({ id: r.id, name: `${r.firstName} ${r.lastName}`, title: r.title })),
    teams: teamRows.map((t) => ({ id: t.id, name: t.name, roleInTeam: roleByTeam.get(t.id) ?? "member" })),
  };
}

function toEmployeeValues(input: EmployeeInput) {
  return {
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email,
    title: input.title,
    department: input.department,
    phone: input.phone,
    location: input.location,
    hireDate: input.hireDate,
    status: input.status,
    managerId: input.managerId,
  };
}

export async function createEmployee(user: User, input: EmployeeInput): Promise<Employee> {
  if (!canCreateEmployee(user)) throw new ForbiddenError("Only Admin/HR can add employees.");
  return db.transaction(async (tx) => {
    const [emp] = await tx.insert(employees).values(toEmployeeValues(input)).returning();
    if (input.salary != null && canEditSalary(user)) {
      await tx.insert(compensation).values({ employeeId: emp.id, salary: input.salary });
    }
    await writeAudit(tx, {
      actor: user,
      entityType: "employee",
      entityId: emp.id,
      entityLabel: `${emp.firstName} ${emp.lastName}`,
      action: "create",
    });
    return emp;
  });
}

export async function updateEmployee(user: User, id: string, input: EmployeeInput): Promise<Employee> {
  return db.transaction(async (tx) => {
    const existing = await tx.query.employees.findFirst({ where: eq(employees.id, id) });
    if (!existing) throw new Error("Employee not found.");
    if (!canEditEmployee(user, existing)) {
      throw new ForbiddenError("You can only edit your direct reports.");
    }
    if (input.managerId !== existing.managerId && (await wouldCreateCycle(tx, id, input.managerId))) {
      throw new CycleError();
    }

    const values = toEmployeeValues(input);
    const changes = diffFields(existing, values, [...AUDITED_FIELDS]) ?? {};

    const [updated] = await tx
      .update(employees)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(employees.id, id))
      .returning();

    if (input.salary != null && canEditSalary(user)) {
      const oldComp = await tx.query.compensation.findFirst({ where: eq(compensation.employeeId, id) });
      if (oldComp?.salary !== input.salary) {
        changes["salary"] = { old: oldComp?.salary ?? null, new: input.salary };
        await tx
          .insert(compensation)
          .values({ employeeId: id, salary: input.salary, updatedAt: new Date() })
          .onConflictDoUpdate({
            target: compensation.employeeId,
            set: { salary: input.salary, updatedAt: new Date() },
          });
      }
    }

    if (Object.keys(changes).length) {
      await writeAudit(tx, {
        actor: user,
        entityType: "employee",
        entityId: id,
        entityLabel: `${updated.firstName} ${updated.lastName}`,
        action: "update",
        changes,
      });
    }
    return updated;
  });
}

/** Org-chart drag-and-drop path. Same permission as editing the employee. */
export async function reparentEmployee(user: User, id: string, newManagerId: string | null): Promise<void> {
  await db.transaction(async (tx) => {
    const existing = await tx.query.employees.findFirst({ where: eq(employees.id, id) });
    if (!existing) throw new Error("Employee not found.");
    if (!canEditEmployee(user, existing)) {
      throw new ForbiddenError("You can only move your direct reports.");
    }
    if (existing.managerId === newManagerId) return;
    if (await wouldCreateCycle(tx, id, newManagerId)) throw new CycleError();

    await tx
      .update(employees)
      .set({ managerId: newManagerId, updatedAt: new Date() })
      .where(eq(employees.id, id));
    await writeAudit(tx, {
      actor: user,
      entityType: "employee",
      entityId: id,
      entityLabel: `${existing.firstName} ${existing.lastName}`,
      action: "update",
      changes: { managerId: { old: existing.managerId, new: newManagerId } },
    });
  });
}

/** Admin only. Direct reports are reassigned up to the deleted employee's manager. */
export async function deleteEmployee(user: User, id: string): Promise<void> {
  if (!canDeleteEmployee(user)) throw new ForbiddenError("Only Admin can delete employees.");
  await db.transaction(async (tx) => {
    const existing = await tx.query.employees.findFirst({ where: eq(employees.id, id) });
    if (!existing) throw new Error("Employee not found.");
    await tx
      .update(employees)
      .set({ managerId: existing.managerId, updatedAt: new Date() })
      .where(eq(employees.managerId, id));
    await tx.delete(employees).where(eq(employees.id, id));
    await writeAudit(tx, {
      actor: user,
      entityType: "employee",
      entityId: id,
      entityLabel: `${existing.firstName} ${existing.lastName}`,
      action: "delete",
    });
  });
}

export type OrgNode = {
  id: string;
  name: string;
  title: string | null;
  department: string | null;
  managerId: string | null;
  status: Employee["status"];
  canEdit: boolean;
};

/** Flat node list for the org chart; client builds the tree with d3-hierarchy. */
export async function listOrgNodes(user: User): Promise<OrgNode[]> {
  const rows = await db.select().from(employees).orderBy(asc(employees.lastName));
  return rows.map((e) => ({
    id: e.id,
    name: `${e.firstName} ${e.lastName}`,
    title: e.title,
    department: e.department,
    managerId: e.managerId,
    status: e.status,
    canEdit: canEditEmployee(user, e),
  }));
}

/** Options for manager <select>s. */
export async function listManagerOptions(): Promise<{ id: string; name: string }[]> {
  const rows = await db
    .select({ id: employees.id, firstName: employees.firstName, lastName: employees.lastName })
    .from(employees)
    .orderBy(asc(employees.lastName));
  return rows.map((r) => ({ id: r.id, name: `${r.firstName} ${r.lastName}` }));
}
