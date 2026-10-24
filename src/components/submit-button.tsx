"use client";

import { useFormStatus } from "react-dom";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type SubmitButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "type" | "disabled"
> & {
  children: ReactNode;
  /** Teks yang tampil saat submit sedang berjalan. */
  pendingText?: string;
};

/**
 * Tombol submit dengan feedback: saat form diproses, tombol nonaktif
 * dan menampilkan spinner + teks — user tahu aplikasi sedang bekerja,
 * bukan lemot. Pakai di dalam <form> apa pun (server action/native POST).
 */
export function SubmitButton({
  children,
  pendingText = "Memproses…",
  className = "",
  ...rest
}: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      {...rest}
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={className}
    >
      {pending ? (
        <span className="inline-flex items-center justify-center gap-2">
          <span
            aria-hidden="true"
            className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          />
          {pendingText}
        </span>
      ) : (
        children
      )}
    </button>
  );
}
