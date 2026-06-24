import { createClient } from "@/lib/supabase/server";
import { formatMoneyCents } from "@/lib/cards";
import { ProcessControl } from "./process-control";

type WithdrawalRow = {
  id: string;
  user_id: string;
  amount_cents: number;
  method: string;
  handle: string;
  status: string;
  note: string | null;
  created_at: string;
  processed_at: string | null;
};

const STATUS_STYLE: Record<string, string> = {
  pending: "text-amber-600 dark:text-amber-400",
  paid: "text-emerald-600 dark:text-emerald-400",
  rejected: "text-red-600 dark:text-red-400",
};

export default async function AdminWithdrawalsPage() {
  const supabase = await createClient();

  const { data: rows } = await supabase
    .from("withdrawal_requests")
    .select(
      "id, user_id, amount_cents, method, handle, status, note, created_at, processed_at",
    )
    .order("created_at", { ascending: false })
    .limit(100);

  const requests = (rows ?? []) as WithdrawalRow[];

  // Resolve user emails.
  const ids = [...new Set(requests.map((r) => r.user_id))];
  const emailById = new Map<string, string>();
  if (ids.length) {
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, email")
      .in("id", ids);
    (profs ?? []).forEach((p) => emailById.set(p.id, p.email ?? "—"));
  }

  const pendingTotal = requests
    .filter((r) => r.status === "pending")
    .reduce((s, r) => s + r.amount_cents, 0);

  return (
    <main className="flex flex-1 flex-col items-center px-4 py-12">
      <div className="w-full max-w-5xl space-y-8">
        <div className="flex items-end justify-between">
          <h1 className="text-3xl font-semibold tracking-tight">Withdrawals</h1>
          <p className="text-sm text-zinc-500">
            Pending payouts:{" "}
            <span className="font-semibold tabular-nums">
              {formatMoneyCents(pendingTotal)}
            </span>
          </p>
        </div>

        <p className="text-sm text-zinc-500">
          Funds are held when a request is made. <strong>Mark paid</strong> sends
          the money for real (a PayPal payout to the email on the request) and
          finalizes it; <strong>Reject</strong> refunds the held amount to their
          withdrawable balance.
        </p>

        {requests.length > 0 ? (
          <ul className="border border-black/10 dark:border-white/15">
            {requests.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-4 border-b border-black/10 px-5 py-4 last:border-0 dark:border-white/15"
              >
                <div className="min-w-0">
                  <p className="text-lg font-semibold tabular-nums">
                    {formatMoneyCents(r.amount_cents)}
                    <span
                      className={`ml-3 text-[11px] font-medium uppercase tracking-[0.15em] ${
                        STATUS_STYLE[r.status] ?? "text-zinc-500"
                      }`}
                    >
                      {r.status}
                    </span>
                  </p>
                  <p className="mt-0.5 text-[11px] uppercase tracking-[0.1em] text-zinc-500">
                    {emailById.get(r.user_id) ?? r.user_id} · {r.method} ·{" "}
                    <span className="font-mono normal-case tracking-normal">
                      {r.handle}
                    </span>
                  </p>
                  <p className="mt-0.5 text-[11px] text-zinc-400">
                    {new Date(r.created_at).toLocaleString()}
                  </p>
                </div>
                {r.status === "pending" ? (
                  <ProcessControl id={r.id} />
                ) : (
                  <span className="text-[11px] uppercase tracking-[0.12em] text-zinc-400">
                    {r.processed_at
                      ? new Date(r.processed_at).toLocaleDateString()
                      : ""}
                  </span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="border border-dashed border-black/20 p-12 text-center text-sm text-zinc-500 dark:border-white/20">
            No withdrawal requests yet.
          </p>
        )}
      </div>
    </main>
  );
}
