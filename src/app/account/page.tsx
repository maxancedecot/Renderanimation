import { auth } from "@/src/lib/auth";
import { redirect } from "next/navigation";
import SignOutButton from "@/components/SignOutButton";
import { getBilling } from "@/lib/billing";

export default async function AccountPage() {
  const session = await auth();
  if (!session?.user) redirect("/signin");
  const billing = await getBilling(String((session.user as any).id || ''));
  const email = (session.user.email || "").toLowerCase();
  const admins = (process.env.ADMIN_EMAILS || "").split(",").map(s=>s.trim().toLowerCase()).filter(Boolean);
  const isAdmin = admins.length === 0 ? true : admins.includes(email);
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
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Abonnement</h2>
        {billing ? (
          <div className="text-sm text-neutral-700 space-y-1 mt-2">
            <div>Statut: <span className="font-medium">{billing.subscriptionStatus || '—'}</span></div>
            <div>Crédits: <span className="font-medium">{billing.videosRemaining ?? 0}</span> / {billing.videosTotal ?? 0}</div>
            <div>4K: <span className="font-medium">{billing.includes4k ? 'Inclus' : 'Non inclus'}</span></div>
            {billing.currentPeriodEnd ? (
              <div>Renouvellement: {new Date((billing.currentPeriodEnd as number) * 1000).toLocaleDateString()}</div>
            ) : null}
            <div className="pt-3">
              <a href="/api/billing/portal" className="inline-flex items-center justify-center rounded-lg border px-4 py-2 hover:bg-neutral-50">Gérer l’abonnement</a>
            </div>
          </div>
        ) : (
          <div className="text-sm text-neutral-600 mt-2">Aucun abonnement actif. <a href="/#pricing" className="underline">Voir les offres</a>.</div>
        )}
      </div>
      {isAdmin && (
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Administration</h2>
          <p className="text-sm text-neutral-600 mt-1">Gérer les utilisateurs de la plateforme.</p>
          <a href="/account/users" className="inline-flex items-center justify-center mt-4 rounded-lg border px-4 py-2 hover:bg-neutral-50">Ouvrir la gestion des utilisateurs</a>
        </div>
      )}
    </div>
  );
}
