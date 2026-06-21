import { createClient } from "@/lib/supabase/server";
import { cardTitle, formatMoneyCents } from "@/lib/cards";
import { ShipmentControl } from "./shipment-control";

type ShipRow = {
  id: string;
  status: string;
  carrier: string | null;
  tracking_number: string | null;
  fee_cents: number;
  insured_value_cents: number;
  recipient_name: string;
  address1: string;
  address2: string | null;
  city: string;
  region: string;
  postal_code: string;
  country: string;
  created_at: string;
  card:
    | {
        serial: string | null;
        card_year: string | null;
        manufacturer: string | null;
        set_name: string | null;
        player_or_character: string | null;
        card_number: string | null;
        variant: string | null;
      }
    | null;
};

export default async function AdminShipmentsPage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("card_shipments")
    .select(
      "id, status, carrier, tracking_number, fee_cents, insured_value_cents, recipient_name, address1, address2, city, region, postal_code, country, created_at, card:cards(serial, card_year, manufacturer, set_name, player_or_character, card_number, variant)",
    )
    .order("created_at", { ascending: false });

  const rows: ShipRow[] = (data ?? []).map((r) => ({
    ...r,
    card: Array.isArray(r.card) ? (r.card[0] ?? null) : r.card,
  })) as ShipRow[];

  const open = rows.filter(
    (r) => r.status !== "delivered" && r.status !== "canceled",
  );

  return (
    <main className="flex flex-1 flex-col items-center px-4 py-12">
      <div className="w-full max-w-5xl space-y-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Shipments</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Physical card deliveries — {open.length} open of {rows.length} total.
            Advance status and add the carrier &amp; tracking number.
          </p>
        </div>

        {rows.length === 0 ? (
          <p className="text-sm text-zinc-500">No shipment requests yet.</p>
        ) : (
          <ul className="space-y-3">
            {rows.map((r) => (
              <li
                key={r.id}
                className="border border-black/10 p-4 dark:border-white/15"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      {r.card ? cardTitle(r.card) : "Card"}
                    </p>
                    <p className="font-mono text-xs text-zinc-500">
                      {r.card?.serial ?? "—"} · insured{" "}
                      {formatMoneyCents(r.insured_value_cents)} · fee{" "}
                      {formatMoneyCents(r.fee_cents)}
                    </p>
                    <p className="mt-2 text-sm">
                      {r.recipient_name}
                      <br />
                      {r.address1}
                      {r.address2 ? `, ${r.address2}` : ""}
                      <br />
                      {r.city}, {r.region} {r.postal_code} {r.country}
                    </p>
                  </div>
                  <span className="text-xs text-zinc-500">
                    {new Date(r.created_at).toLocaleDateString()}
                  </span>
                </div>
                <div className="mt-3 border-t border-black/10 pt-3 dark:border-white/15">
                  <ShipmentControl
                    id={r.id}
                    status={r.status}
                    carrier={r.carrier}
                    tracking={r.tracking_number}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
