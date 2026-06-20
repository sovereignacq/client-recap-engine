import { createClient } from "@/lib/supabase/server";
import { formatMoneyCents } from "@/lib/cards";

export default async function AdminUsersPage() {
  const supabase = await createClient();

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, balance_cents, created_at")
    .order("created_at", { ascending: false });

  // Activity counts (small user base — count client-side from id lists).
  const { data: cardRows } = await supabase
    .from("cards")
    .select("owner_id")
    .is("archived_at", null);
  const cardsByUser = new Map<string, number>();
  (cardRows ?? []).forEach((c) =>
    cardsByUser.set(c.owner_id, (cardsByUser.get(c.owner_id) ?? 0) + 1),
  );

  const { data: openRows } = await supabase
    .from("pack_openings")
    .select("buyer_id");
  const opensByUser = new Map<string, number>();
  (openRows ?? []).forEach((o) =>
    opensByUser.set(o.buyer_id, (opensByUser.get(o.buyer_id) ?? 0) + 1),
  );

  const users = profiles ?? [];

  return (
    <main className="flex flex-1 flex-col items-center px-4 py-12">
      <div className="w-full max-w-5xl space-y-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Users</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Everyone signed up — {users.length} total. Roles, wallet balance, and
            activity.
          </p>
        </div>

        <div className="overflow-x-auto border border-black/10 dark:border-white/15">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-black/10 text-left text-[10px] uppercase tracking-[0.12em] text-zinc-400 dark:border-white/15">
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3 text-right">Wallet</th>
                <th className="px-4 py-3 text-right">Cards</th>
                <th className="px-4 py-3 text-right">Opens</th>
                <th className="px-4 py-3 text-right">Joined</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-black/10 last:border-0 dark:border-white/15">
                  <td className="px-4 py-3">
                    <p className="font-medium">{u.email ?? "—"}</p>
                    {u.full_name && (
                      <p className="text-xs text-zinc-500">{u.full_name}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-[11px] uppercase tracking-[0.12em] ${
                        u.role === "customer" ? "text-zinc-500" : "font-medium"
                      }`}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatMoneyCents(u.balance_cents ?? 0)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {cardsByUser.get(u.id) ?? 0}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {opensByUser.get(u.id) ?? 0}
                  </td>
                  <td className="px-4 py-3 text-right text-zinc-500">
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
