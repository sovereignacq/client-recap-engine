"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSubmitterAction, updateSubmitterAction } from "./actions";

type Props =
  | { mode: "create"; initial?: undefined; submitterId?: undefined }
  | {
      mode: "edit";
      submitterId: string;
      initial: {
        name: string;
        email: string | null;
        phone: string | null;
        address: string | null;
        notes: string | null;
      };
    };

export function SubmitterForm(props: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        const fd = new FormData(e.currentTarget);
        startTransition(async () => {
          const result =
            props.mode === "create"
              ? await createSubmitterAction(fd)
              : await updateSubmitterAction(props.submitterId, fd);
          if (result && "error" in result) setError(result.error);
        });
      }}
      className="space-y-4"
    >
      <Field
        label="Name *"
        name="name"
        defaultValue={props.initial?.name ?? ""}
        required
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label="Email"
          name="email"
          type="email"
          defaultValue={props.initial?.email ?? ""}
        />
        <Field
          label="Phone"
          name="phone"
          defaultValue={props.initial?.phone ?? ""}
        />
      </div>
      <Field
        label="Address"
        name="address"
        defaultValue={props.initial?.address ?? ""}
      />
      <div>
        <label className="text-sm font-medium">Notes</label>
        <textarea
          name="notes"
          rows={4}
          defaultValue={props.initial?.notes ?? ""}
          placeholder="How you know them, payout preferences, anything worth keeping on the record."
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        />
      </div>

      {error && (
        <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
        >
          {isPending
            ? "Saving…"
            : props.mode === "create"
              ? "Add submitter"
              : "Save changes"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  defaultValue,
  required,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="text-sm font-medium">{label}</label>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        required={required}
        className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
      />
    </div>
  );
}
