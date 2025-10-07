import { auth } from "@/src/lib/auth";
import { redirect } from "next/navigation";
import UsersAdmin from "@/components/UsersAdmin";

export default async function UsersAdminPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const email = (session.user.email || "").toLowerCase();
  const envAdmins = (process.env.ADMIN_EMAILS || "").split(",").map(s=>s.trim().toLowerCase()).filter(Boolean);
  const sessionAdmin = (session.user as any).isAdmin === true;
  const fallbackAdmin = envAdmins.length > 0 && email ? envAdmins.includes(email) : false;
  const isAdmin = envAdmins.length > 0 ? (sessionAdmin || fallbackAdmin) : sessionAdmin;
  if (!isAdmin) redirect("/account");
  const currentUserId = String((session.user as any).id || "");
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-semibold">Gestion des utilisateurs</h1>
      <UsersAdmin currentUserId={currentUserId} />
    </div>
  );
}
