"use client";
import { useState } from 'react';
import { Lang, t } from "@/lib/i18n";

type Plan = {
  priceMonthly: number;
  count: number;
  highlight?: boolean;
  discountKey?: string;
};

export default function Pricing({ lang }: { lang: Lang }) {
  const [cycle, setCycle] = useState<'monthly' | 'yearly'>('monthly');
  const plans: Plan[] = [
    { priceMonthly: 25, count: 5 },
    { priceMonthly: 45, count: 10, discountKey: 'discount10', highlight: true },
    { priceMonthly: 80, count: 20, discountKey: 'discount20' },
  ];
  const formatPrice = (n: number) => `${n}€`;
  const compute = (p: Plan) => cycle === 'monthly' ? p.priceMonthly : p.priceMonthly * 12;

  return (
    <section id="pricing" className="space-y-4">
      <h2 className="text-lg font-semibold">{t(lang, 'pricingTitle')}</h2>
      <p className="text-sm text-neutral-600">{t(lang, 'pricingSubtitle')}</p>

      <div className="flex items-center justify-center">
        <div className="flex items-center gap-1 rounded-full bg-neutral-100 px-1 py-1 text-xs">
          <button
            onClick={() => setCycle('monthly')}
            className={`${cycle === 'monthly' ? 'bg-[#F9D83C] text-black shadow-sm' : 'text-neutral-500'} px-3 py-1 rounded-full transition`}
            aria-pressed={cycle === 'monthly'}
          >{t(lang, 'pricingMonthly')}</button>
          <button
            onClick={() => setCycle('yearly')}
            className={`${cycle === 'yearly' ? 'bg-[#F9D83C] text-black shadow-sm' : 'text-neutral-500'} px-3 py-1 rounded-full transition`}
            aria-pressed={cycle === 'yearly'}
          >{t(lang, 'pricingYearly')}</button>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6 mt-3">
        {plans.map((p) => (
          <div key={p.priceMonthly} className={`rounded-2xl border bg-white p-6 shadow-sm ${p.highlight ? 'ring-2 ring-[#F9D83C] border-[#F9D83C]' : ''}`}>
            <div className="text-3xl font-semibold flex items-baseline gap-3">
              <span>{formatPrice(compute(p))}</span>
              {p.discountKey ? (
                <span className="text-xs font-medium text-green-700 bg-green-100 rounded px-2 py-0.5 ring-1 ring-green-300">{t(lang, p.discountKey)}</span>
              ) : null}
            </div>
            <div className="mt-1 text-sm text-neutral-600">{t(lang, 'videosPerMonth', { count: p.count })}</div>
            {cycle === 'yearly' ? (
              <div className="mt-1 text-xs text-neutral-500">{t(lang, 'billedYearly')}</div>
            ) : null}
            <div className="mt-4">
              <a href="/signin" className="inline-flex items-center justify-center rounded-lg bg-black px-4 py-2 text-white hover:bg-black/90 w-full">
                {t(lang, 'subscribe')}
              </a>
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-neutral-500">Prix HT indicatifs. Annulation à tout moment.</p>
    </section>
  );
}

