# User Guide

## Signing in

Go to the app URL and sign in. In production this uses your company's identity provider
(via WorkOS). In local development you'll see a persona picker instead — choose a role to
explore the app.

Your role badge is shown in the top-right corner. What you can see and do depends on it
(see the RBAC table in the README).

## Employee Directory (`/employees`)

- **Search & filter** by name/email/title text, department, status, or team, then
  click **Apply**. Filters live in the URL, so you can bookmark or share a filtered view.
- Click a **column header** to sort.
- Click a **name** to open the employee's profile: manager, direct reports, teams, and —
  if your role allows — salary.
- **Add employee** (Admin/HR): fill the form; manager is a dropdown; salary is Admin/HR
  only.
- **Edit** (Admin/HR anywhere; Managers on their direct reports): from the employee page.
- **Delete** (Admin only): from the employee page. Their direct reports are reassigned
  up to the deleted person's manager, and the deletion is recorded in the audit log.

## Team Directory (`/teams`)

- Search teams, see each team's parent, leads, and member count.
- Open a team to see members, leads, and sub-teams.
- Admin/HR can create teams (optionally under a parent team), edit/delete them, add or
  remove members, and promote a member to **Lead**. Team lead is a membership role, so a
  person can lead one team and be a plain member of another.

## Org Chart (`/org-chart`)

- Auto-generated from reporting relationships. **Pan** by dragging the canvas, **zoom**
  with the scroll wheel, use the **minimap** to navigate.
- Deep subtrees start collapsed — click **"Show N reports"** on a card to expand,
  **Collapse** to fold it back.
- Click a person's name on a card to open their profile.
- **Drag-and-drop reparenting**: drag an employee card and drop it onto their new
  manager's card. The chart updates immediately; if the server rejects the move (for
  example, it would create a reporting cycle) the chart snaps back and shows the reason.
  You can only drag cards you're allowed to edit (highlighted border).
- **Export PDF** captures the chart as you currently see it.

## Search (`/search`)

One box that searches employees (name, email, title, department) and teams (name,
description) together. Results are labeled by type; click through to the detail page.

## Exports

From the Employee Directory, Admin/HR can export **CSV**, **Excel**, or **PDF**. The
export always matches the filters currently applied to the directory — filter first,
then export. The CSV column layout matches the bulk-import template, so an exported file
can be re-imported.

## Bulk import (`/import`, Admin/HR)

1. Download the template CSV (or start from a previous export). Columns:
   `email, firstName, lastName, title, department, phone, location, hireDate (YYYY-MM-DD),
   status (active|on_leave|terminated), managerEmail, salary`.
2. Upload a `.csv` or `.xlsx` file. The app validates every row and shows a **dry run**:
   how many rows would be created vs updated, and per-row errors with row numbers.
3. Fix any errors and re-upload, then click **Import**. The import is all-or-nothing:
   either every row commits or nothing changes.

Notes: email is the matching key (existing employees are updated). Managers are matched
by `managerEmail` — the manager can be another row in the same file, in any order.
Imports that would create a reporting cycle are rejected.
