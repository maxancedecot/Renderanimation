import { auth } from "@/src/lib/auth";
import { redirect } from "next/navigation";
import LibraryGrid from "@/components/LibraryGrid";

export default async function LibraryPage() {
  const session = await auth();
  if (!session?.user) redirect("/signin");
  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Bibliothèque</h1>
          <p className="text-sm text-neutral-600">Tes vidéos enregistrées</p>
        </div>
        <a href="/app" className="text-sm rounded-md border px-3 py-2 hover:bg-neutral-50">Créer une nouvelle vidéo</a>
      </div>
      <LibraryGrid />
    </div>
  );
}

