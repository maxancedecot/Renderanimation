import { auth } from "@/src/lib/auth";
import { redirect } from "next/navigation";
import { getRequestLang } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import LibraryGrid from "@/components/LibraryGrid";

export default async function LibraryPage() {
  const session = await auth();
  if (!session?.user) redirect("/signin");
  const lang = getRequestLang();
  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t(lang, 'navLibrary')}</h1>
          <p className="text-sm text-neutral-600">{lang === 'fr' ? 'Tes vidéos enregistrées' : lang === 'en' ? 'Your saved videos' : 'Je opgeslagen video’s'}</p>
        </div>
        <a href="/app" className="text-sm rounded-md border px-3 py-2 hover:bg-neutral-50">{lang === 'fr' ? 'Créer une nouvelle vidéo' : lang === 'en' ? 'Create a new video' : 'Nieuwe video maken'}</a>
      </div>
      <LibraryGrid />
    </div>
  );
}
