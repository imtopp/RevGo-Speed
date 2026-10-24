"use client";

import { useActionState } from "react";
import { updateSetting, type SettingState } from "./actions";
import { SubmitButton } from "@/components/submit-button";

type Field = { key: string; label: string; placeholder: string };

export function SettingForm({
  field,
  initialValue,
}: {
  field: Field;
  initialValue: string;
}) {
  const [state, action] = useActionState<SettingState, FormData>(
    updateSetting,
    {},
  );

  return (
    <form action={action} className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <input type="hidden" name="key" value={field.key} />
      <div className="flex-1">
        <label className="block text-sm font-medium text-foreground">
          {field.label}
        </label>
        <input
          name="value"
          defaultValue={initialValue}
          placeholder={field.placeholder}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base outline-none focus:border-slate-900"
        />
      </div>
      <SubmitButton
        pendingText="Simpan..."
        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white active:opacity-90 disabled:opacity-60"
      >
        Simpan
      </SubmitButton>
      {state.error && (
        <p className="text-sm text-danger sm:w-full">{state.error}</p>
      )}
      {state.success && (
        <p className="text-sm text-green-600 sm:w-full">{state.success}</p>
      )}
    </form>
  );
}
