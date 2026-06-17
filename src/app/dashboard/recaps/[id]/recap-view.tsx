"use client";

import { useState, useTransition } from "react";
import {
  updateRecapAction,
  deleteRecapAction,
  markRecapSentAction,
} from "../actions";

type Recap = {
  id: string;
  subject: string;
  body: string;
  status: string;
  tone: string | null;
  model: string | null;
  meetingDate: string | null;
  createdAt: string;
};

type Client = {
  id: string;
  name: string;
  email: string | null;
};

export function RecapView({
  recap,
  client,
}: {
  recap: Recap;
  client: Client | null;
}) {
  const [editing, setEditing] = useState(false);
  const [subject, setSubject] = useState(recap.subject);
  const [body, setBody] = useState(recap.body);
  const [status, setStatus] = useState(recap.status);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [isSaving, startSave] = useTransition();
  const [isDeleting, startDelete] = useTransition();
  const [isMarking, startMark] = useTransition();

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(`${subject}\n\n${body}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Copy failed — your browser may have blocked clipboard access.");
    }
  };

  const mailtoHref = client?.email
    ? `mailto:${encodeURIComponent(client.email)}?subject=${encodeURIComponent(
        subject,
      )}&body=${encodeURIComponent(body)}`
    : null;

  const handleSave = () => {
    setError(null);
    const fd = new FormData();
    fd.set("subject_line", subject);
    fd.set("content", body);
    fd.set("status", status);
    startSave(async () => {
      const result = await updateRecapAction(recap.id, fd);
      if (result && "error" in result && result.error) {
        setError(result.error);
      } else {
        setEditing(false);
      }
    });
  };

  const handleDelete = () => {
    if (!confirm("Delete this recap? This cannot be undone.")) return;
    startDelete(async () => {
      await deleteRecapAction(recap.id);
    });
  };

  const handleMarkSent = () => {
    startMark(async () => {
      await markRecapSentAction(recap.id);
      setStatus("sent");
    });
  };

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500">
            {recap.tone && `${recap.tone} · `}
            {recap.model && `${recap.model} · `}
            {new Date(recap.createdAt).toLocaleDateString()}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            {client ? `Recap for ${client.name}` : "Recap"}
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Status: <span className="font-medium">{status}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!editing && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              Edit
            </button>
          )}
          <button
            type="button"
            onClick={copyToClipboard}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            {copied ? "Copied ✓" : "Copy"}
          </button>
          {mailtoHref && (
            <a
              href={mailtoHref}
              className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
            >
              Open in email
            </a>
          )}
        </div>
      </header>

      {editing ? (
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Subject line</label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Body</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={16}
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 font-mono text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            >
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="archived">Archived</option>
            </select>
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
              {isSaving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setSubject(recap.subject);
                setBody(recap.body);
                setStatus(recap.status);
              }}
              disabled={isSaving}
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
            <p className="text-xs uppercase tracking-wide text-zinc-500">
              Subject
            </p>
            <p className="mt-1 font-medium">{subject}</p>
          </section>
          <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
            <p className="text-xs uppercase tracking-wide text-zinc-500">
              Body
            </p>
            <pre className="mt-2 whitespace-pre-wrap font-sans text-sm">
              {body}
            </pre>
          </section>
          {error && (
            <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-3 pt-2">
            {status !== "sent" && (
              <button
                type="button"
                onClick={handleMarkSent}
                disabled={isMarking}
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
              >
                {isMarking ? "…" : "Mark as sent"}
              </button>
            )}
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting}
              className="text-sm text-red-600 hover:underline disabled:opacity-50 dark:text-red-400"
            >
              {isDeleting ? "Deleting…" : "Delete recap"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
