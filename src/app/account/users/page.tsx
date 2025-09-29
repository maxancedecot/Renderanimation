import { auth } from "@/src/lib/auth";
import { redirect } from "next/navigation";
import UsersAdmin from "@/components/UsersAdmin";

export default async function UsersAdminPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const email = (session.user.email || "").toLowerCase();
  const admins = (process.env.ADMIN_EMAILS || "").split(",").map(s=>s.trim().toLowerCase()).filter(Boolean);
  const isAdmin = admins.length === 0 ? true : admins.includes(email);
  if (!isAdmin) redirect("/account");
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-semibold">Gestion des utilisateurs</h1>
      <UsersAdmin />
    </div>
  );
}
