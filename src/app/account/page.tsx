import { auth } from "@/src/lib/auth";
import { redirect } from "next/navigation";
import SignOutButton from "@/components/SignOutButton";

export default async function AccountPage() {
  const session = await auth();
  if (!session?.user) redirect("/signin");
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-semibold">Espace utilisateur</h1>
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="text-sm text-neutral-600">Connecté en tant que</div>
        <div className="text-lg font-medium">{session.user?.email || session.user?.name || "Utilisateur"}</div>
        <div className="mt-4">
          <SignOutButton />
        </div>
      </div>
    </div>
  );
}

