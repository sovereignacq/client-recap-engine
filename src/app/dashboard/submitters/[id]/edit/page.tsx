import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SubmitterForm } from "../../submitter-form";

export default async function EditSubmitterPage({
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

  const { data: submitter } = await supabase
    .from("submitters")
    .select("id, name, email, phone, address, notes")
    .eq("id", id)
    .maybeSingle();

  if (!submitter) notFound();

  return (
    <main className="flex flex-1 flex-col items-center px-4 py-12">
      <div className="w-full max-w-xl space-y-6">
        <Link
          href={`/dashboard/submitters/${submitter.id}`}
          className="text-sm text-zinc-600 hover:underline dark:text-zinc-400"
        >
          ← Back to submitter
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Edit submitter</h1>
        <SubmitterForm
          mode="edit"
          submitterId={submitter.id}
          initial={{
            name: submitter.name,
            email: submitter.email,
            phone: submitter.phone,
            address: submitter.address,
            notes: submitter.notes,
          }}
        />
      </div>
    </main>
  );
}
