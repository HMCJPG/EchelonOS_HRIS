import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveImport, type ExistingEmployee } from "../src/lib/import-resolver";
import type { ImportRow } from "../src/lib/validation";

const row = (email: string, managerEmail: string | null = null): ImportRow => ({
  email,
  firstName: "F",
  lastName: "L",
  title: null,
  department: null,
  phone: null,
  location: null,
  hireDate: null,
  status: "active",
  managerEmail,
  salary: null,
});

const existing: ExistingEmployee[] = [
  { id: "id-ceo", email: "ceo@x.com", managerId: null },
  { id: "id-vp", email: "vp@x.com", managerId: "id-ceo" },
];

test("create vs update dispositions", () => {
  const r = resolveImport([row("ceo@x.com"), row("new@x.com", "ceo@x.com")], existing);
  assert.equal(r.errors.length, 0);
  assert.deepEqual(
    r.dispositions.map((d) => d.action),
    ["update", "create"],
  );
});

test("duplicate emails in file are rejected", () => {
  const r = resolveImport([row("a@x.com"), row("a@x.com")], []);
  assert.ok(r.errors.some((e) => e.message.includes("Duplicate")));
});

test("unknown manager email is rejected", () => {
  const r = resolveImport([row("a@x.com", "ghost@x.com")], existing);
  assert.ok(r.errors.some((e) => e.message.includes("not found")));
});

test("manager referenced later in the file is fine (two-pass)", () => {
  const r = resolveImport([row("child@x.com", "parent@x.com"), row("parent@x.com")], []);
  assert.equal(r.errors.length, 0);
});

test("self-manager is rejected", () => {
  const r = resolveImport([row("a@x.com", "a@x.com")], []);
  assert.ok(r.errors.some((e) => e.message.includes("own manager")));
});

test("cycle inside the file is detected", () => {
  const r = resolveImport([row("a@x.com", "b@x.com"), row("b@x.com", "a@x.com")], []);
  assert.ok(r.errors.some((e) => e.message.includes("cycle")));
});

test("cycle created against existing data is detected", () => {
  // File makes the CEO report to the VP, but VP already reports to CEO.
  const r = resolveImport([row("ceo@x.com", "vp@x.com")], existing);
  assert.ok(r.errors.some((e) => e.message.includes("cycle")));
});

test("re-import of a clean export is a no-op-shaped update", () => {
  const r = resolveImport([row("ceo@x.com"), row("vp@x.com", "ceo@x.com")], existing);
  assert.equal(r.errors.length, 0);
  assert.ok(r.dispositions.every((d) => d.action === "update"));
});
