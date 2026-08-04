import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canEditEmployee,
  canViewSalary,
  canDeleteEmployee,
  canExport,
  canViewAudit,
} from "../src/lib/authz";
import type { User } from "../src/db/schema";

const user = (role: User["role"], employeeId: string | null = null): User => ({
  id: `u-${role}`,
  workosUserId: null,
  email: `${role}@x.com`,
  name: null,
  role,
  employeeId,
  createdAt: new Date(),
});

// mgr-1 manages emp-direct; emp-skip reports to emp-direct (skip-level).
const direct = { id: "emp-direct", managerId: "mgr-1" };
const skipLevel = { id: "emp-skip", managerId: "emp-direct" };
const unrelated = { id: "emp-other", managerId: "mgr-2" };

test("admin/hr can edit anyone; viewer can edit no one", () => {
  assert.ok(canEditEmployee(user("admin"), unrelated));
  assert.ok(canEditEmployee(user("hr"), unrelated));
  assert.ok(!canEditEmployee(user("employee", "emp-direct"), direct));
});

test("manager edit scope is DIRECT reports only (spec asymmetry)", () => {
  const mgr = user("manager", "mgr-1");
  assert.ok(canEditEmployee(mgr, direct));
  assert.ok(!canEditEmployee(mgr, skipLevel), "skip-level report must NOT be editable");
  assert.ok(!canEditEmployee(mgr, unrelated));
});

test("salary visibility: admin/hr all, manager direct reports + self, employee self only", () => {
  assert.ok(canViewSalary(user("hr"), unrelated));
  const mgr = user("manager", "mgr-1");
  assert.ok(canViewSalary(mgr, direct));
  assert.ok(!canViewSalary(mgr, skipLevel), "manager must not see skip-level comp");
  assert.ok(canViewSalary(user("employee", "emp-direct"), direct), "own salary is visible");
  assert.ok(!canViewSalary(user("employee", "emp-other"), direct));
});

test("delete is admin-only; export and audit are admin/hr", () => {
  assert.ok(canDeleteEmployee(user("admin")));
  assert.ok(!canDeleteEmployee(user("hr")));
  assert.ok(canExport(user("hr")) && !canExport(user("manager")));
  assert.ok(canViewAudit(user("hr")) && !canViewAudit(user("employee")));
});
