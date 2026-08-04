import {
  pgTable,
  pgEnum,
  uuid,
  text,
  date,
  integer,
  timestamp,
  jsonb,
  primaryKey,
  uniqueIndex,
  index,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

export const userRole = pgEnum("user_role", ["admin", "hr", "manager", "employee"]);
export const employeeStatus = pgEnum("employee_status", ["active", "on_leave", "terminated"]);
export const teamRole = pgEnum("team_role", ["member", "lead"]);
export const auditAction = pgEnum("audit_action", ["create", "update", "delete", "import"]);

// Auth principals. Separate from employees: employees may never log in,
// and users (e.g. an external auditor) may not be employees.
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workosUserId: text("workos_user_id").unique(),
    email: text("email").notNull().unique(),
    name: text("name"),
    role: userRole("role").notNull().default("employee"),
    employeeId: uuid("employee_id").references((): AnyPgColumn => employees.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
);

export const employees = pgTable(
  "employees",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    email: text("email").notNull(),
    title: text("title"),
    department: text("department"),
    phone: text("phone"),
    location: text("location"),
    hireDate: date("hire_date"),
    status: employeeStatus("status").notNull().default("active"),
    managerId: uuid("manager_id").references((): AnyPgColumn => employees.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("employees_email_idx").on(t.email), index("employees_manager_idx").on(t.managerId)],
);

// Salary lives in its own table so "can this role see money" is a join
// decision, not a field-stripping decision.
export const compensation = pgTable("compensation", {
  employeeId: uuid("employee_id")
    .primaryKey()
    .references(() => employees.id, { onDelete: "cascade" }),
  salary: integer("salary"), // annual, whole currency units. ponytail: cents/decimal when payroll math arrives
  currency: text("currency").notNull().default("USD"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const teams = pgTable(
  "teams",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    description: text("description"),
    parentTeamId: uuid("parent_team_id").references((): AnyPgColumn => teams.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("teams_parent_idx").on(t.parentTeamId)],
);

// Join table: people sit on multiple teams. Lead is a membership role, not a
// lead_id FK on teams, so lead-ness can't drift out of sync with membership.
export const teamMemberships = pgTable(
  "team_memberships",
  {
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    roleInTeam: teamRole("role_in_team").notNull().default("member"),
  },
  (t) => [primaryKey({ columns: [t.teamId, t.employeeId] })],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    actorEmail: text("actor_email"),
    entityType: text("entity_type").notNull(), // 'employee' | 'team' | 'user'
    entityId: uuid("entity_id"),
    entityLabel: text("entity_label"),
    action: auditAction("action").notNull(),
    // { field: { old, new } } — comp changes included, so the log itself is Admin/HR-gated
    changes: jsonb("changes").$type<Record<string, { old: unknown; new: unknown }>>(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("audit_entity_idx").on(t.entityType, t.entityId), index("audit_created_idx").on(t.createdAt)],
);

export type User = typeof users.$inferSelect;
export type Employee = typeof employees.$inferSelect;
export type NewEmployee = typeof employees.$inferInsert;
export type Team = typeof teams.$inferSelect;
export type TeamMembership = typeof teamMemberships.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type Role = User["role"];
