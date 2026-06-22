import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { cardTitle } from "@/lib/cards";
import { SlabAdmin, type SlabRow } from "./slab-admin";

export default async function AdminSlabsPage() {
  const supabase = await createClient();

  const { data: rows } = await supabase
    .from("cards")
    .select(
      "id, player_or_character, card_year, manufacturer, set_name, card_number, variant, grading_company, grade, cert_number, fmv_cents, in_inventory, owner_id, image_url",
    )
    .eq("is_slab", true)
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(200);

  const ownerIds = [...new Set((rows ?? []).map((r) => r.owner_id))];
  const { data: owners } = ownerIds.length
    ? await supabase.from("profiles").select("id, email").in("id", ownerIds)
    : { data: [] };
  const emailById = new Map(
    (owners ?? []).map((o) => [o.id, o.email as string | null]),
  );

  const slabs: SlabRow[] = (rows ?? []).map((r) => ({
    id: r.id,
    name: cardTitle(r),
    company: r.grading_company,
    grade: r.grade,
    cert: r.cert_number,
    valueCents: r.fmv_cents,
    ownerEmail: emailById.get(r.owner_id) ?? null,
    inPool: r.in_inventory,
    imageUrl: r.image_url,
  }));

  return (
    <main className="flex flex-1 flex-col items-center px-4 py-12">
      <div className="w-full max-w-4xl space-y-8">
        <div>
          <Link
            href="/admin"
            className="text-[11px] uppercase tracking-[0.15em] text-zinc-500 hover:text-black dark:hover:text-white"
          >
            ← Back office
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Slabs</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Graded slabs across the platform — players&apos; slabs and the ones
            stocked in the Apex Play pool.
          </p>
        </div>

        <SlabAdmin slabs={slabs} />
      </div>
    </main>
  );
}
