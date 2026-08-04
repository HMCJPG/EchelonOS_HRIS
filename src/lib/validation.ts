import { z } from "zod";

/** Defined once, used by forms, server actions, and bulk import. */

const optionalText = z
  .string()
  .trim()
  .max(200)
  .transform((s) => (s === "" ? null : s))
  .nullish()
  .transform((v) => v ?? null);

export const employeeSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(100),
  lastName: z.string().trim().min(1, "Last name is required").max(100),
  email: z.email("Valid email required").trim().toLowerCase(),
  title: optionalText,
  department: optionalText,
  phone: optionalText,
  location: optionalText,
  hireDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
    .nullish()
    .or(z.literal("").transform(() => null))
    .transform((v) => v ?? null),
  status: z.enum(["active", "on_leave", "terminated"]).default("active"),
  managerId: z
    .uuid()
    .nullish()
    .or(z.literal("").transform(() => null))
    .transform((v) => v ?? null),
  salary: z.coerce
    .number()
    .int()
    .min(0)
    .nullish()
    .or(z.literal("").transform(() => null))
    .transform((v) => (typeof v === "number" ? v : null)),
});
export type EmployeeInput = z.infer<typeof employeeSchema>;

export const teamSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  description: optionalText,
  parentTeamId: z
    .uuid()
    .nullish()
    .or(z.literal("").transform(() => null))
    .transform((v) => v ?? null),
});
export type TeamInput = z.infer<typeof teamSchema>;

/** Bulk import row. Email is the natural key; managers referenced by email. */
export const importRowSchema = z.object({
  email: z.email().trim().toLowerCase(),
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  title: optionalText,
  department: optionalText,
  phone: optionalText,
  location: optionalText,
  hireDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
    .nullish()
    .or(z.literal("").transform(() => null))
    .transform((v) => v ?? null),
  status: z
    .enum(["active", "on_leave", "terminated"])
    .nullish()
    .or(z.literal("").transform(() => null))
    .transform((v) => v ?? "active"),
  managerEmail: z
    .email()
    .trim()
    .toLowerCase()
    .nullish()
    .or(z.literal("").transform(() => null))
    .transform((v) => v ?? null),
  salary: z.coerce
    .number()
    .int()
    .min(0)
    .nullish()
    .or(z.literal("").transform(() => null))
    .transform((v) => (typeof v === "number" ? v : null)),
});
export type ImportRow = z.infer<typeof importRowSchema>;
