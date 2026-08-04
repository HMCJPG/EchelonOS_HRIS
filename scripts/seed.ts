/**
 * Seed a realistic demo org: ~45 employees across 6 departments, team
 * hierarchy, compensation, and dev users matching the dev-login personas.
 * Idempotent-ish: refuses to run if employees exist unless --force.
 *
 * Run: npm run db:setup   (push schema + seed)
 * Note: stop `next dev` first when using local PGlite — single-process lock.
 */
import { db } from "../src/db";
import { users, employees, compensation, teams, teamMemberships, auditLogs } from "../src/db/schema";
import { sql } from "drizzle-orm";

type Spec = {
  first: string;
  last: string;
  title: string;
  dept: string;
  managerEmail: string | null;
  salary: number;
  location: string;
};

const email = (first: string, last: string) =>
  `${first.toLowerCase()}.${last.toLowerCase()}@echelon.dev`;

function person(
  first: string,
  last: string,
  title: string,
  dept: string,
  manager: [string, string] | null,
  salary: number,
  location = "New York",
): Spec {
  return {
    first,
    last,
    title,
    dept,
    managerEmail: manager ? email(manager[0], manager[1]) : null,
    salary,
    location,
  };
}

const SPECS: Spec[] = [
  person("Alexandra", "Chen", "Chief Executive Officer", "Executive", null, 350000),

  person("Marcus", "Webb", "VP of Engineering", "Engineering", ["Alexandra", "Chen"], 265000, "San Francisco"),
  person("Priya", "Sharma", "Engineering Manager, Platform", "Engineering", ["Marcus", "Webb"], 205000, "San Francisco"),
  person("Diego", "Alvarez", "Engineering Manager, Product", "Engineering", ["Marcus", "Webb"], 205000, "Remote"),
  person("Sofia", "Rossi", "Staff Engineer", "Engineering", ["Priya", "Sharma"], 195000, "Remote"),
  person("James", "Okafor", "Senior Engineer", "Engineering", ["Priya", "Sharma"], 175000, "San Francisco"),
  person("Emily", "Nguyen", "Senior Engineer", "Engineering", ["Priya", "Sharma"], 172000, "Remote"),
  person("Lukas", "Meyer", "Engineer II", "Engineering", ["Priya", "Sharma"], 148000, "Berlin"),
  person("Hannah", "Kim", "Engineer II", "Engineering", ["Diego", "Alvarez"], 149000, "Remote"),
  person("Omar", "Haddad", "Senior Engineer", "Engineering", ["Diego", "Alvarez"], 174000, "Remote"),
  person("Grace", "Liu", "Engineer I", "Engineering", ["Diego", "Alvarez"], 128000, "San Francisco"),
  person("Tom", "Bishop", "Engineer I", "Engineering", ["Diego", "Alvarez"], 126000, "Austin"),
  person("Nina", "Petrova", "QA Engineer", "Engineering", ["Marcus", "Webb"], 132000, "Remote"),

  person("Rachel", "Goldman", "VP of Sales", "Sales", ["Alexandra", "Chen"], 245000),
  person("Chris", "Donnelly", "Sales Lead, East", "Sales", ["Rachel", "Goldman"], 165000),
  person("Maya", "Patel", "Sales Lead, West", "Sales", ["Rachel", "Goldman"], 165000, "San Francisco"),
  person("Ethan", "Brooks", "Account Executive", "Sales", ["Chris", "Donnelly"], 118000),
  person("Olivia", "Grant", "Account Executive", "Sales", ["Chris", "Donnelly"], 121000, "Boston"),
  person("Noah", "Fischer", "Account Executive", "Sales", ["Maya", "Patel"], 119000, "Denver"),
  person("Ava", "Silva", "Sales Development Rep", "Sales", ["Maya", "Patel"], 82000, "Austin"),
  person("Leo", "Martin", "Sales Development Rep", "Sales", ["Chris", "Donnelly"], 80000),

  person("David", "Osei", "Chief Financial Officer", "Finance", ["Alexandra", "Chen"], 285000),
  person("Sarah", "Whitfield", "Controller", "Finance", ["David", "Osei"], 175000),
  person("Kenji", "Tanaka", "Senior Financial Analyst", "Finance", ["Sarah", "Whitfield"], 128000),
  person("Laura", "Moreno", "Financial Analyst", "Finance", ["Sarah", "Whitfield"], 98000, "Chicago"),
  person("Peter", "Novak", "Accounts Payable Specialist", "Finance", ["Sarah", "Whitfield"], 72000),

  person("Angela", "Duke", "Chief People Officer", "People", ["Alexandra", "Chen"], 240000),
  person("Ben", "Carver", "People Operations Manager", "People", ["Angela", "Duke"], 135000),
  person("Isabelle", "Fontaine", "Recruiter", "People", ["Ben", "Carver"], 95000, "Remote"),
  person("Will", "Turner", "People Ops Coordinator", "People", ["Ben", "Carver"], 68000),

  person("Frank", "Delgado", "Chief Operating Officer", "Operations", ["Alexandra", "Chen"], 275000),
  person("Julia", "Baker", "Operations Manager", "Operations", ["Frank", "Delgado"], 142000),
  person("Sam", "Reid", "Logistics Coordinator", "Operations", ["Julia", "Baker"], 76000, "Chicago"),
  person("Dana", "Ellis", "Facilities Lead", "Operations", ["Julia", "Baker"], 84000),
  person("Victor", "Cruz", "IT Support Specialist", "Operations", ["Julia", "Baker"], 88000, "Austin"),

  person("Monica", "Iyer", "VP of Marketing", "Marketing", ["Alexandra", "Chen"], 230000),
  person("Jack", "Sullivan", "Content Marketing Manager", "Marketing", ["Monica", "Iyer"], 125000, "Remote"),
  person("Zoe", "Andersson", "Product Marketing Manager", "Marketing", ["Monica", "Iyer"], 138000),
  person("Ryan", "Kelly", "Marketing Analyst", "Marketing", ["Jack", "Sullivan"], 92000, "Remote"),
  person("Tara", "Osman", "Brand Designer", "Marketing", ["Jack", "Sullivan"], 105000),
];

async function main() {
  const force = process.argv.includes("--force");

  const countRes = (await db.execute(sql`SELECT count(*)::int AS n FROM employees`)) as unknown as {
    rows: { n: number }[];
  };
  const n = countRes.rows[0].n;
  if (n > 0 && !force) {
    console.log(`Employees table already has ${n} rows. Re-run with --force to wipe and reseed.`);
    process.exit(0);
  }
  if (force) {
    await db.delete(auditLogs);
    await db.delete(teamMemberships);
    await db.delete(compensation);
    await db.delete(users);
    await db.execute(sql`UPDATE employees SET manager_id = NULL`);
    await db.delete(employees);
    await db.delete(teams);
  }

  // Pass 1: employees without managers (email is the natural key).
  const idByEmail = new Map<string, string>();
  for (const [i, s] of SPECS.entries()) {
    const hireYear = 2019 + (i % 6);
    const hireMonth = String(1 + (i % 12)).padStart(2, "0");
    const hireDay = String(1 + ((i * 7) % 27)).padStart(2, "0");
    const [row] = await db
      .insert(employees)
      .values({
        firstName: s.first,
        lastName: s.last,
        email: email(s.first, s.last),
        title: s.title,
        department: s.dept,
        phone: `555-01${String(i).padStart(2, "0")}`,
        location: s.location,
        hireDate: `${hireYear}-${hireMonth}-${hireDay}`,
        status: s.last === "Turner" ? "on_leave" : "active",
      })
      .returning({ id: employees.id });
    idByEmail.set(email(s.first, s.last), row.id);
    await db.insert(compensation).values({ employeeId: row.id, salary: s.salary });
  }

  // Pass 2: wire managers.
  for (const s of SPECS) {
    if (!s.managerEmail) continue;
    await db.execute(sql`
      UPDATE employees SET manager_id = ${idByEmail.get(s.managerEmail)!}
      WHERE email = ${email(s.first, s.last)}
    `);
  }

  // Teams: two levels, leads derived from membership role.
  const teamIdByName = new Map<string, string>();
  const teamDefs: { name: string; parent: string | null; description: string }[] = [
    { name: "Engineering", parent: null, description: "Product & platform engineering" },
    { name: "Platform", parent: "Engineering", description: "Infra, CI, developer experience" },
    { name: "Product Engineering", parent: "Engineering", description: "Customer-facing product work" },
    { name: "Go-to-Market", parent: null, description: "Sales and marketing umbrella" },
    { name: "Sales", parent: "Go-to-Market", description: "Revenue org" },
    { name: "Marketing", parent: "Go-to-Market", description: "Brand, content, product marketing" },
    { name: "G&A", parent: null, description: "General & administrative" },
    { name: "Finance", parent: "G&A", description: "FP&A, accounting" },
    { name: "People Ops", parent: "G&A", description: "HR, recruiting, people programs" },
    { name: "Operations", parent: "G&A", description: "Logistics, facilities, IT" },
  ];
  for (const t of teamDefs) {
    const [row] = await db
      .insert(teams)
      .values({
        name: t.name,
        description: t.description,
        parentTeamId: t.parent ? teamIdByName.get(t.parent)! : null,
      })
      .returning({ id: teams.id });
    teamIdByName.set(t.name, row.id);
  }

  const addMembers = async (teamName: string, leadEmail: string | null, memberEmails: string[]) => {
    const teamId = teamIdByName.get(teamName)!;
    for (const m of memberEmails) {
      await db.insert(teamMemberships).values({
        teamId,
        employeeId: idByEmail.get(m)!,
        roleInTeam: m === leadEmail ? "lead" : "member",
      });
    }
  };

  const byDept = (dept: string) =>
    SPECS.filter((s) => s.dept === dept).map((s) => email(s.first, s.last));

  await addMembers("Engineering", email("Marcus", "Webb"), byDept("Engineering"));
  await addMembers("Platform", email("Priya", "Sharma"), [
    email("Priya", "Sharma"), email("Sofia", "Rossi"), email("James", "Okafor"),
    email("Emily", "Nguyen"), email("Lukas", "Meyer"),
  ]);
  await addMembers("Product Engineering", email("Diego", "Alvarez"), [
    email("Diego", "Alvarez"), email("Hannah", "Kim"), email("Omar", "Haddad"),
    email("Grace", "Liu"), email("Tom", "Bishop"),
  ]);
  await addMembers("Sales", email("Rachel", "Goldman"), byDept("Sales"));
  await addMembers("Marketing", email("Monica", "Iyer"), byDept("Marketing"));
  await addMembers("Finance", email("David", "Osei"), byDept("Finance"));
  await addMembers("People Ops", email("Angela", "Duke"), byDept("People"));
  await addMembers("Operations", email("Frank", "Delgado"), byDept("Operations"));

  // Users matching the dev-login personas. manager@ is linked to an employee
  // WITH direct reports so the Manager role has a real subtree to act on.
  await db.insert(users).values([
    { email: "admin@echelon.dev", name: "Admin Persona", role: "admin", employeeId: null },
    {
      email: "hr@echelon.dev",
      name: "HR Persona",
      role: "hr",
      employeeId: idByEmail.get(email("Angela", "Duke")),
    },
    {
      email: "manager@echelon.dev",
      name: "Manager Persona",
      role: "manager",
      employeeId: idByEmail.get(email("Priya", "Sharma")),
    },
    {
      email: "viewer@echelon.dev",
      name: "Viewer Persona",
      role: "employee",
      employeeId: idByEmail.get(email("Grace", "Liu")),
    },
  ]);

  console.log(`Seeded ${SPECS.length} employees, ${teamDefs.length} teams, 4 users.`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
