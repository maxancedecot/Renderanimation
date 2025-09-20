"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function StripeSync() {
  const sp = useSearchParams();
  const router = useRouter();
  const sid = sp.get('session_id') || sp.get('session') || null;
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!sid || done) return;
    (async () => {
      try {
        await fetch(`/api/stripe/sync?session_id=${encodeURIComponent(sid)}`).then(() => {});
      } catch {}
      setDone(true);
      router.replace('/account');
    })();
  }, [sid, done, router]);
  return null;
}

