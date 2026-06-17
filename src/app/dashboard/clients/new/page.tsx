import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUsage } from "@/lib/usage";
import { ClientForm } from "../client-form";

export default async function NewClientPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const usage = await getUsage(user.id);
  if (usage.atClientLimit) {
    redirect("/dashboard/clients?error=limit");
  }

  return (
    <main className="flex flex-1 flex-col items-center px-4 py-12">
      <div className="w-full max-w-xl space-y-6">
        <Link
          href="/dashboard/clients"
          className="text-sm text-zinc-600 hover:underline dark:text-zinc-400"
        >
          ← Back to clients
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">New client</h1>
        <ClientForm mode="create" />
      </div>
    </main>
  );
}
