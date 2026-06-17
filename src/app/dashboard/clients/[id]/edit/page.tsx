import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ClientForm } from "../../client-form";

export default async function EditClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: client } = await supabase
    .from("clients")
    .select("id, name, email, company, notes")
    .eq("id", id)
    .maybeSingle();

  if (!client) notFound();

  return (
    <main className="flex flex-1 flex-col items-center px-4 py-12">
      <div className="w-full max-w-xl space-y-6">
        <Link
          href={`/dashboard/clients/${id}`}
          className="text-sm text-zinc-600 hover:underline dark:text-zinc-400"
        >
          ← Back to {client.name}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Edit client</h1>
        <ClientForm
          mode="edit"
          clientId={client.id}
          initial={{
            name: client.name,
            email: client.email,
            company: client.company,
            notes: client.notes,
          }}
        />
      </div>
    </main>
  );
}
