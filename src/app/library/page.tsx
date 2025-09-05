// src/app/library/page.tsx
import { auth } from "@/src/lib/auth";
import { redirect } from "next/navigation";
import { listCreations } from "@/lib/library";
import dynamic from "next/dynamic";

const LibraryGrid = dynamic(() => import("@/components/LibraryGrid"), { ssr: false });

export default async function LibraryPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");
  const items = await listCreations(session.user.id as string);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Ma bibliothèque</h1>
        <p className="text-sm text-neutral-600">{items.length} création{items.length > 1 ? 's' : ''}</p>
      </div>
      <LibraryGrid initialItems={items} />
    </div>
  );
}

