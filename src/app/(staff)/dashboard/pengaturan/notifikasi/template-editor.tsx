"use client";

import { useActionState } from "react";
import {
  resetNotifTemplates,
  updateNotifTemplates,
  type TemplateState,
} from "./actions";
import { SubmitButton } from "@/components/submit-button";
import {
  TEMPLATE_DEFS,
  TPL_BODY_MAX,
  TPL_TITLE_MAX,
  type TemplateDef,
  type TemplateOverrides,
} from "@/lib/notif-template";

function FieldEditor({
  def,
  fieldName,
  current,
}: {
  def: TemplateDef;
  fieldName: "title" | "body";
  current: string;
}) {
  const field = def.fields.find((f) => f.name === fieldName)!;
  const max = fieldName === "title" ? TPL_TITLE_MAX : TPL_BODY_MAX;
  return (
    <div>
      <label className="block text-xs font-medium text-foreground">
        {field.label} <span className="text-muted-foreground">(maks {max} karakter)</span>
      </label>
      <textarea
        name={`tpl.${def.id}.${fieldName}`}
        defaultValue={current}
        placeholder={field.default}
        rows={fieldName === "title" ? 2 : 4}
        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm outline-none focus:border-slate-900"
      />
      <p className="mt-1 text-xs text-muted-foreground">
        {field.variabel.length > 0 ? (
          <>
            Variabel:{" "}
            {field.variabel.map((v) => (
              <code key={v} className="rounded bg-slate-100 px-1">
                {`{${v}}`}
              </code>
            ))}
            {" — "}
          </>
        ) : null}
        {field.catatan ??
          "Kosongkan untuk memakai teks default."}
      </p>
    </div>
  );
}

function TemplateCard({ def, initial }: { def: TemplateDef; initial: TemplateOverrides }) {
  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-foreground">{def.label}</p>
        {initial[def.id] && (
          <span className="rounded-full bg-warning/15 px-2 py-0.5 text-xs font-medium text-warning">
            diubah
          </span>
        )}
      </div>
      {def.fields.map((f) => (
        <FieldEditor
          key={f.name}
          def={def}
          fieldName={f.name}
          current={initial[def.id]?.[f.name] ?? ""}
        />
      ))}
    </div>
  );
}

export function TemplateEditor({ initial }: { initial: TemplateOverrides }) {
  const [state, action] = useActionState<TemplateState, FormData>(
    updateNotifTemplates,
    {},
  );
  const [resetState, resetAction] = useActionState<TemplateState, FormData>(
    resetNotifTemplates,
    {},
  );

  const pushDefs = TEMPLATE_DEFS.filter((d) => d.grup === "Push");
  const waDefs = TEMPLATE_DEFS.filter((d) => d.grup === "WhatsApp");

  return (
    <div className="space-y-6">
      <div className="space-y-1 rounded-xl bg-surface p-4 ring-1 ring-slate-200 shadow-card">
        <p className="text-sm font-semibold text-foreground">Cara kerja</p>
        <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
          <li>
            <strong>Push</strong> = notifikasi yang muncul di layar HP/laptop
            (6 event). <strong>WhatsApp</strong> = pesan pratinjau yang terisi
            otomatis saat tombol WA diklik — tinggal tekan kirim.
          </li>
          <li>
            Teks default menempel di placeholder — biarkan kosong untuk memakainya.
            Variabel seperti <code className="rounded bg-slate-100 px-1">{"{code}"}</code>{" "}
            terisi otomatis saat notifikasi dikirim.
          </li>
          <li>Perubahan berlaku seketika untuk notifikasi berikutnya.</li>
        </ul>
      </div>

      <form action={action} onReset={(e) => e.preventDefault()} className="space-y-6">
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">
            Template Push Notifikasi
          </h2>
          <div className="space-y-3">
            {pushDefs.map((def) => (
              <TemplateCard key={def.id} def={def} initial={initial} />
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">
            Template WhatsApp
          </h2>
          <div className="space-y-3">
            {waDefs.map((def) => (
              <TemplateCard key={def.id} def={def} initial={initial} />
            ))}
          </div>
        </section>

        <div className="flex flex-wrap items-center gap-3">
          <SubmitButton
            pendingText="Menyimpan..."
            className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white active:opacity-90 disabled:opacity-60"
          >
            Simpan Template
          </SubmitButton>
          {state.error && <p className="text-sm text-danger">{state.error}</p>}
          {state.success && (
            <p className="text-sm text-success">{state.success}</p>
          )}
        </div>
      </form>

      <form action={resetAction} onReset={(e) => e.preventDefault()}>
        <button
          type="submit"
          onClick={(e) => {
            if (!confirm("Kembalikan SEMUA template notifikasi ke default?")) {
              e.preventDefault();
            }
          }}
          className="rounded-lg border border-red-200 bg-surface px-4 py-2.5 text-sm font-medium text-danger active:opacity-90"
        >
          Kembalikan semua ke default
        </button>
        {resetState.error && (
          <p className="mt-2 text-sm text-danger">{resetState.error}</p>
        )}
        {resetState.success && (
          <p className="mt-2 text-sm text-success">{resetState.success}</p>
        )}
      </form>
    </div>
  );
}
