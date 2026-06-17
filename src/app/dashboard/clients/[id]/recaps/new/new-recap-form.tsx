"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  generateRecapAction,
  saveRecapAction,
} from "@/app/dashboard/recaps/actions";

type Generated = {
  subject: string;
  body: string;
  model: string;
};

export function NewRecapForm({
  clientId,
  disabled,
}: {
  clientId: string;
  disabled: boolean;
}) {
  const router = useRouter();
  const [isGenerating, startGenerate] = useTransition();
  const [isSaving, startSave] = useTransition();
  const [generated, setGenerated] = useState<Generated | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Track form inputs so we can pass them through to save
  const [rawNotes, setRawNotes] = useState("");
  const [tone, setTone] = useState<"professional" | "friendly" | "brief">(
    "professional",
  );
  const [cta, setCta] = useState("");
  const [meetingDate, setMeetingDate] = useState("");

  // Editable output
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const handleGenerate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set("client_id", clientId);
    startGenerate(async () => {
      const result = await generateRecapAction(fd);
      if (result.ok) {
        setGenerated({
          subject: result.subject,
          body: result.body,
          model: result.model,
        });
        setSubject(result.subject);
        setBody(result.body);
      } else {
        setError(result.error);
      }
    });
  };

  const handleSave = () => {
    setError(null);
    const fd = new FormData();
    fd.set("client_id", clientId);
    fd.set("raw_notes", rawNotes);
    fd.set("tone", tone);
    fd.set("call_to_action", cta);
    fd.set("meeting_date", meetingDate);
    fd.set("subject_line", subject);
    fd.set("content", body);
    if (generated?.model) fd.set("model", generated.model);
    startSave(async () => {
      const result = await saveRecapAction(fd);
      if (result.ok) {
        router.push(`/dashboard/recaps/${result.id}`);
      } else {
        setError(result.error);
      }
    });
  };

  const handleRegenerate = () => {
    setGenerated(null);
    setSubject("");
    setBody("");
  };

  if (generated) {
    return (
      <div className="space-y-4">
        <p className="text-xs uppercase tracking-wide text-zinc-500">
          Draft generated with {generated.model}. Edit anything before saving.
        </p>

        <div>
          <label className="text-sm font-medium">Subject line</label>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
        </div>

        <div>
          <label className="text-sm font-medium">Email body</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={16}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 font-mono text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
        </div>

        {error && (
          <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
            {error}
          </p>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
          >
            {isSaving ? "Saving…" : "Save recap"}
          </button>
          <button
            type="button"
            onClick={handleRegenerate}
            disabled={isSaving}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Regenerate
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleGenerate} className="space-y-4">
      <div>
        <label className="text-sm font-medium">
          Raw notes / transcript *
        </label>
        <textarea
          name="raw_notes"
          value={rawNotes}
          onChange={(e) => setRawNotes(e.target.value)}
          rows={10}
          placeholder="Paste whatever you have — bullet notes, voice-memo transcript, scrap of a chat. The messier the better."
          required
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="text-sm font-medium">Tone</label>
          <select
            name="tone"
            value={tone}
            onChange={(e) =>
              setTone(e.target.value as "professional" | "friendly" | "brief")
            }
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          >
            <option value="professional">Professional</option>
            <option value="friendly">Friendly</option>
            <option value="brief">Brief</option>
          </select>
        </div>
        <div>
          <label className="text-sm font-medium">Meeting date</label>
          <input
            name="meeting_date"
            type="date"
            value={meetingDate}
            onChange={(e) => setMeetingDate(e.target.value)}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
        </div>
      </div>

      <div>
        <label className="text-sm font-medium">
          Call-to-action (optional)
        </label>
        <input
          name="call_to_action"
          value={cta}
          onChange={(e) => setCta(e.target.value)}
          placeholder="e.g. Confirm timeline by Friday, or book a follow-up for next week."
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        />
      </div>

      {error && (
        <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={disabled || isGenerating}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
      >
        {isGenerating ? "Generating…" : "Generate recap"}
      </button>
    </form>
  );
}
