import "server-only";
import { and, asc, eq, ilike, inArray, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { teams, teamMemberships, employees, type User, type Team } from "@/db/schema";
import { canManageTeams } from "@/lib/authz";
import { writeAudit, diffFields } from "@/lib/audit";
import type { TeamInput } from "@/lib/validation";
import { ForbiddenError, CycleError } from "@/repo/employees";

export type TeamRow = Team & {
  parentTeamName: string | null;
  memberCount: number;
  leadNames: string[];
  canManage: boolean;
};

export async function listTeams(user: User, q?: string): Promise<TeamRow[]> {
  const parent = alias(teams, "parent");
  const conds: SQL[] = [];
  if (q) {
    const like = `%${q}%`;
    conds.push(ilike(teams.name, like));
  }
  const rows = await db
    .select({ team: teams, parentTeamName: parent.name })
    .from(teams)
    .leftJoin(parent, eq(teams.parentTeamId, parent.id))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(asc(teams.name));

  const ids = rows.map((r) => r.team.id);
  const members = ids.length
    ? await db
        .select({
          teamId: teamMemberships.teamId,
          roleInTeam: teamMemberships.roleInTeam,
          firstName: employees.firstName,
          lastName: employees.lastName,
        })
        .from(teamMemberships)
        .innerJoin(employees, eq(teamMemberships.employeeId, employees.id))
        .where(inArray(teamMemberships.teamId, ids))
    : [];

  const canManage = canManageTeams(user);
  return rows.map((r) => {
    const mine = members.filter((m) => m.teamId === r.team.id);
    return {
      ...r.team,
      parentTeamName: r.parentTeamName,
      memberCount: mine.length,
      leadNames: mine.filter((m) => m.roleInTeam === "lead").map((m) => `${m.firstName} ${m.lastName}`),
      canManage,
    };
  });
}

export type TeamDetail = TeamRow & {
  members: { employeeId: string; name: string; title: string | null; roleInTeam: string }[];
  subTeams: { id: string; name: string; memberCount: number }[];
};

export async function getTeam(user: User, id: string): Promise<TeamDetail | null> {
  const team = await db.query.teams.findFirst({ where: eq(teams.id, id) });
  if (!team) return null;
  const parent = team.parentTeamId
    ? await db.query.teams.findFirst({ where: eq(teams.id, team.parentTeamId) })
    : null;

  const members = await db
    .select({
      employeeId: teamMemberships.employeeId,
      roleInTeam: teamMemberships.roleInTeam,
      firstName: employees.firstName,
      lastName: employees.lastName,
      title: employees.title,
    })
    .from(teamMemberships)
    .innerJoin(employees, eq(teamMemberships.employeeId, employees.id))
    .where(eq(teamMemberships.teamId, id))
    .orderBy(asc(employees.lastName));

  const subTeams = await db
    .select({
      id: teams.id,
      name: teams.name,
      memberCount: sql<number>`(SELECT count(*)::int FROM team_memberships tm WHERE tm.team_id = ${teams.id})`,
    })
    .from(teams)
    .where(eq(teams.parentTeamId, id))
    .orderBy(asc(teams.name));

  return {
    ...team,
    parentTeamName: parent?.name ?? null,
    memberCount: members.length,
    leadNames: members.filter((m) => m.roleInTeam === "lead").map((m) => `${m.firstName} ${m.lastName}`),
    canManage: canManageTeams(user),
    members: members.map((m) => ({
      employeeId: m.employeeId,
      name: `${m.firstName} ${m.lastName}`,
      title: m.title,
      roleInTeam: m.roleInTeam,
    })),
    subTeams,
  };
}

/** Cycle check for the team tree — same recursive-CTE idea as employees. */
async function teamWouldCreateCycle(dbx: Parameters<typeof writeAudit>[0], teamId: string, newParentId: string | null) {
  if (!newParentId) return false;
  if (newParentId === teamId) return true;
  const result = await dbx.execute(sql`
    WITH RECURSIVE ancestors AS (
      SELECT id, parent_team_id FROM teams WHERE id = ${newParentId}
      UNION ALL
      SELECT t.id, t.parent_team_id FROM teams t JOIN ancestors a ON t.id = a.parent_team_id
    )
    SELECT 1 AS hit FROM ancestors WHERE id = ${teamId} LIMIT 1
  `);
  return (result as unknown as { rows: unknown[] }).rows.length > 0;
}

export async function createTeam(user: User, input: TeamInput): Promise<Team> {
  if (!canManageTeams(user)) throw new ForbiddenError("Only Admin/HR can manage teams.");
  return db.transaction(async (tx) => {
    const [team] = await tx.insert(teams).values(input).returning();
    await writeAudit(tx, {
      actor: user,
      entityType: "team",
      entityId: team.id,
      entityLabel: team.name,
      action: "create",
    });
    return team;
  });
}

export async function updateTeam(user: User, id: string, input: TeamInput): Promise<Team> {
  if (!canManageTeams(user)) throw new ForbiddenError("Only Admin/HR can manage teams.");
  return db.transaction(async (tx) => {
    const existing = await tx.query.teams.findFirst({ where: eq(teams.id, id) });
    if (!existing) throw new Error("Team not found.");
    if (input.parentTeamId !== existing.parentTeamId && (await teamWouldCreateCycle(tx, id, input.parentTeamId))) {
      throw new CycleError();
    }
    const changes = diffFields(existing, input, ["name", "description", "parentTeamId"]);
    const [updated] = await tx.update(teams).set(input).where(eq(teams.id, id)).returning();
    if (changes) {
      await writeAudit(tx, {
        actor: user,
        entityType: "team",
        entityId: id,
        entityLabel: updated.name,
        action: "update",
        changes,
      });
    }
    return updated;
  });
}

export async function deleteTeam(user: User, id: string): Promise<void> {
  if (!canManageTeams(user)) throw new ForbiddenError("Only Admin/HR can manage teams.");
  await db.transaction(async (tx) => {
    const existing = await tx.query.teams.findFirst({ where: eq(teams.id, id) });
    if (!existing) throw new Error("Team not found.");
    // Sub-teams move up to the deleted team's parent (FK is set-null; be explicit).
    await tx.update(teams).set({ parentTeamId: existing.parentTeamId }).where(eq(teams.parentTeamId, id));
    await tx.delete(teams).where(eq(teams.id, id));
    await writeAudit(tx, {
      actor: user,
      entityType: "team",
      entityId: id,
      entityLabel: existing.name,
      action: "delete",
    });
  });
}

export async function setTeamMembership(
  user: User,
  teamId: string,
  employeeId: string,
  roleInTeam: "member" | "lead" | "remove",
): Promise<void> {
  if (!canManageTeams(user)) throw new ForbiddenError("Only Admin/HR can manage team membership.");
  await db.transaction(async (tx) => {
    const team = await tx.query.teams.findFirst({ where: eq(teams.id, teamId) });
    const emp = await tx.query.employees.findFirst({ where: eq(employees.id, employeeId) });
    if (!team || !emp) throw new Error("Team or employee not found.");
    const label = `${emp.firstName} ${emp.lastName} ↔ ${team.name}`;

    if (roleInTeam === "remove") {
      await tx
        .delete(teamMemberships)
        .where(and(eq(teamMemberships.teamId, teamId), eq(teamMemberships.employeeId, employeeId)));
      await writeAudit(tx, {
        actor: user, entityType: "team", entityId: teamId, entityLabel: label, action: "update",
        changes: { membership: { old: "member", new: null } },
      });
      return;
    }
    await tx
      .insert(teamMemberships)
      .values({ teamId, employeeId, roleInTeam })
      .onConflictDoUpdate({
        target: [teamMemberships.teamId, teamMemberships.employeeId],
        set: { roleInTeam },
      });
    await writeAudit(tx, {
      actor: user, entityType: "team", entityId: teamId, entityLabel: label, action: "update",
      changes: { membership: { old: null, new: roleInTeam } },
    });
  });
}

export async function listTeamOptions(): Promise<{ id: string; name: string }[]> {
  return db.select({ id: teams.id, name: teams.name }).from(teams).orderBy(asc(teams.name));
}
