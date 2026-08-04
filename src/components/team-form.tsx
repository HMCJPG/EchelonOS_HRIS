"use client";

import { useActionState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionResult } from "@/actions/employees";

export function TeamForm({
  action,
  initial = {},
  parentOptions,
  submitLabel,
}: {
  action: (prev: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  initial?: { name?: string; description?: string | null; parentTeamId?: string | null };
  parentOptions: { id: string; name: string }[];
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <form action={formAction} className="max-w-xl space-y-4">
      {state && !state.ok && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      <div className="space-y-1">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" defaultValue={initial.name} required />
      </div>
      <div className="space-y-1">
        <Label htmlFor="description">Description</Label>
        <Input id="description" name="description" defaultValue={initial.description ?? undefined} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="parentTeamId">Parent team</Label>
        <select
          id="parentTeamId"
          name="parentTeamId"
          defaultValue={initial.parentTeamId ?? ""}
          className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
        >
          <option value="">No parent (top level)</option>
          {parentOptions.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}
