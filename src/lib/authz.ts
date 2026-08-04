import type { User, Employee, Role } from "@/db/schema";

/**
 * Single source of truth for permissions. Enforced in the repo layer (the only
 * code that touches the db), so there is exactly one place to forget — and
 * it's covered by tests.
 *
 * Model (documented decision): the *directory rows* are visible to every
 * authenticated user (like a real company directory). RBAC gates
 *   1. mutations  — who can create/edit/delete what
 *   2. salary     — field-level, via the separate compensation table
 *   3. surfaces   — audit log, exports, user management
 * Manager asymmetry per spec: VIEW extends to the whole subtree ("view
 * team"), EDIT is direct reports only.
 */

const ELEVATED: Role[] = ["admin", "hr"];

export function canManageUsers(user: User) {
  return user.role === "admin";
}

export function canViewAudit(user: User) {
  return ELEVATED.includes(user.role);
}

export function canExport(user: User) {
  return ELEVATED.includes(user.role);
}

export function canCreateEmployee(user: User) {
  return ELEVATED.includes(user.role);
}

export function canDeleteEmployee(user: User) {
  return user.role === "admin";
}

export function canImport(user: User) {
  return ELEVATED.includes(user.role);
}

export function canManageTeams(user: User) {
  return ELEVATED.includes(user.role);
}

/** Direct-reports-only for managers — the edit half of the spec's asymmetry. */
export function canEditEmployee(user: User, employee: Pick<Employee, "id" | "managerId">) {
  if (ELEVATED.includes(user.role)) return true;
  if (user.role === "manager" && user.employeeId) {
    return employee.managerId === user.employeeId;
  }
  return false;
}

/** Reparenting = editing the employee's manager field; same rule as edit. */
export const canReparent = canEditEmployee;

/** Salary edits are admin/HR only — managers edit profile fields, not comp. */
export function canEditSalary(user: User) {
  return ELEVATED.includes(user.role);
}

/** Admin/HR: everyone. Manager: self + direct reports. Everyone: self. */
export function canViewSalary(user: User, employee: Pick<Employee, "id" | "managerId">) {
  if (ELEVATED.includes(user.role)) return true;
  if (user.employeeId === employee.id) return true;
  if (user.role === "manager" && user.employeeId) {
    return employee.managerId === user.employeeId;
  }
  return false;
}

/** Whether this user gets a salary column in list/export surfaces at all. */
export function canViewAnySalary(user: User) {
  return ELEVATED.includes(user.role) || user.role === "manager" || Boolean(user.employeeId);
}
