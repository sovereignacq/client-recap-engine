"use client";

import { useState, useTransition } from "react";
import {
  adminAdjustBalance,
  adminSetSuspended,
  adminIssueWarning,
  adminSetRole,
  adminDeleteUser,
  adminRestoreUser,
  adminRecommendDeletion,
} from "@/app/admin/actions";

const PANEL = "border border-black/10 p-5 dark:border-white/15";
const LABEL =
  "text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400";
const INPUT =
  "w-full rounded-none border border-black/20 bg-transparent px-3 py-2 text-sm outline-none focus:border-black dark:border-white/25 dark:focus:border-white";
const BTN =
  "rounded-none bg-black px-4 py-2 text-[11px] font-medium uppercase tracking-[0.15em] text-white transition hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200";
const BTN_OUTLINE =
  "rounded-none border border-black/20 px-4 py-2 text-[11px] font-medium uppercase tracking-[0.15em] transition hover:bg-black/5 disabled:opacity-50 dark:border-white/25 dark:hover:bg-white/10";

function Msg({ m }: { m: { ok: boolean; text: string } | null }) {
  if (!m) return null;
  return (
    <p
      className={`mt-2 text-xs ${
        m.ok
          ? "text-emerald-600 dark:text-emerald-400"
          : "text-red-600 dark:text-red-400"
      }`}
    >
      {m.text}
    </p>
  );
}

export function UserControls({
  userId,
  suspended,
  deleted,
  role,
  isOwner,
}: {
  userId: string;
  suspended: boolean;
  deleted: boolean;
  role: string;
  isOwner: boolean;
}) {
  const [pending, startTransition] = useTransition();

  // Balance
  const [amount, setAmount] = useState("");
  const [balReason, setBalReason] = useState("");
  const [balMsg, setBalMsg] = useState<{ ok: boolean; text: string } | null>(
    null,
  );

  // Suspend
  const [suspReason, setSuspReason] = useState("");
  const [suspMsg, setSuspMsg] = useState<{ ok: boolean; text: string } | null>(
    null,
  );

  // Warning
  const [warnReason, setWarnReason] = useState("");
  const [warnMsg, setWarnMsg] = useState<{ ok: boolean; text: string } | null>(
    null,
  );

  // Role / delete
  const [roleVal, setRoleVal] = useState(role);
  const [roleMsg, setRoleMsg] = useState<{ ok: boolean; text: string } | null>(
    null,
  );

  function adjust(sign: 1 | -1) {
    const dollars = parseFloat(amount);
    if (!Number.isFinite(dollars) || dollars <= 0) {
      setBalMsg({ ok: false, text: "Enter a dollar amount." });
      return;
    }
    const cents = Math.round(dollars * 100) * sign;
    startTransition(async () => {
      const res = await adminAdjustBalance(userId, cents, balReason);
      if (res?.error) setBalMsg({ ok: false, text: res.error });
      else {
        setBalMsg({
          ok: true,
          text: `${sign > 0 ? "Credited" : "Debited"} $${dollars.toFixed(2)}.`,
        });
        setAmount("");
        setBalReason("");
      }
    });
  }

  return (
    <div className="grid gap-5 sm:grid-cols-2">
      {/* Balance */}
      <div className={PANEL}>
        <p className={LABEL}>Adjust wallet</p>
        <div className="mt-3 space-y-2">
          <input
            className={INPUT}
            inputMode="decimal"
            placeholder="Amount (USD)"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <input
            className={INPUT}
            placeholder="Reason (optional)"
            value={balReason}
            onChange={(e) => setBalReason(e.target.value)}
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => adjust(1)}
              className={BTN}
            >
              Credit
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => adjust(-1)}
              className={BTN_OUTLINE}
            >
              Debit
            </button>
          </div>
          <Msg m={balMsg} />
        </div>
      </div>

      {/* Suspend */}
      <div className={PANEL}>
        <p className={LABEL}>{suspended ? "Suspended" : "Suspend"}</p>
        <div className="mt-3 space-y-2">
          {suspended ? (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const res = await adminSetSuspended(userId, false);
                  setSuspMsg(
                    res?.error
                      ? { ok: false, text: res.error }
                      : { ok: true, text: "Suspension lifted." },
                  );
                })
              }
              className={BTN}
            >
              Lift suspension
            </button>
          ) : (
            <>
              <input
                className={INPUT}
                placeholder="Reason (shown to user)"
                value={suspReason}
                onChange={(e) => setSuspReason(e.target.value)}
              />
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const res = await adminSetSuspended(
                      userId,
                      true,
                      suspReason,
                    );
                    if (res?.error)
                      setSuspMsg({ ok: false, text: res.error });
                    else {
                      setSuspMsg({ ok: true, text: "User suspended." });
                      setSuspReason("");
                    }
                  })
                }
                className={BTN}
              >
                Suspend (block actions)
              </button>
            </>
          )}
          <Msg m={suspMsg} />
        </div>
      </div>

      {/* Warning */}
      <div className={PANEL}>
        <p className={LABEL}>Issue warning</p>
        <div className="mt-3 space-y-2">
          <input
            className={INPUT}
            placeholder="Reason (shown to user)"
            value={warnReason}
            onChange={(e) => setWarnReason(e.target.value)}
          />
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const res = await adminIssueWarning(userId, warnReason);
                if (res?.error) setWarnMsg({ ok: false, text: res.error });
                else {
                  setWarnMsg({ ok: true, text: "Warning issued." });
                  setWarnReason("");
                }
              })
            }
            className={BTN}
          >
            Send warning
          </button>
          <Msg m={warnMsg} />
        </div>
      </div>

      {/* Role (owner only) & delete (any staff) */}
      <div className={PANEL}>
        <p className={LABEL}>Role &amp; access</p>
        <div className="mt-3 space-y-2">
          {isOwner ? (
            <>
              <select
                className={INPUT}
                value={roleVal}
                onChange={(e) => setRoleVal(e.target.value)}
              >
                <option value="customer">customer</option>
                <option value="staff">staff</option>
                <option value="owner">owner</option>
              </select>
              <button
                type="button"
                disabled={pending || roleVal === role}
                onClick={() =>
                  startTransition(async () => {
                    const res = await adminSetRole(userId, roleVal);
                    setRoleMsg(
                      res?.error
                        ? { ok: false, text: res.error }
                        : { ok: true, text: "Role updated." },
                    );
                  })
                }
                className={BTN}
              >
                Save role
              </button>
            </>
          ) : (
            <p className="text-xs text-zinc-500">
              Only owners can change a user&apos;s role.
            </p>
          )}

          {deleted ? (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const res = await adminRestoreUser(userId);
                  setRoleMsg(
                    res?.error
                      ? { ok: false, text: res.error }
                      : { ok: true, text: "Account restored." },
                  );
                })
              }
              className="w-full rounded-none border border-emerald-500/40 px-4 py-2 text-[11px] font-medium uppercase tracking-[0.15em] text-emerald-700 transition hover:bg-emerald-500/10 disabled:opacity-50 dark:text-emerald-300"
            >
              Restore account
            </button>
          ) : isOwner ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                if (
                  !confirm(
                    "Delete this account? The user will be suspended and removed from active views. It can be restored later.",
                  )
                )
                  return;
                startTransition(async () => {
                  const res = await adminDeleteUser(userId);
                  setRoleMsg(
                    res?.error
                      ? { ok: false, text: res.error }
                      : { ok: true, text: "Account deleted." },
                  );
                });
              }}
              className="w-full rounded-none border border-red-500/40 px-4 py-2 text-[11px] font-medium uppercase tracking-[0.15em] text-red-600 transition hover:bg-red-500/10 disabled:opacity-50 dark:text-red-400"
            >
              Delete account
            </button>
          ) : (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const res = await adminRecommendDeletion(userId);
                  setRoleMsg(
                    res?.error
                      ? { ok: false, text: res.error }
                      : { ok: true, text: "Flagged for the owner to review." },
                  );
                })
              }
              className="w-full rounded-none border border-amber-500/40 px-4 py-2 text-[11px] font-medium uppercase tracking-[0.15em] text-amber-700 transition hover:bg-amber-500/10 disabled:opacity-50 dark:text-amber-300"
            >
              Recommend deletion
            </button>
          )}
          <Msg m={roleMsg} />
        </div>
      </div>
    </div>
  );
}
