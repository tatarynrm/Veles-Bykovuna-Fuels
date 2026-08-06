'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Info } from 'lucide-react';
import SectionHeading from '@/shared/ui/SectionHeading';
import AnimatedCounter from '@/shared/ui/AnimatedCounter';
import { fadeUp, staggerParent, VIEWPORT, EASE_ENTER } from '@/shared/lib/motion';
import {
  CATEGORY_LABEL, STATUS_LABEL, STATUS_TONE,
} from '@/shared/config/integrations';
import { useSectionSound, useSound } from '@/features/sound';
import { t, localizedMap } from '@/lib/i18n';
import VendorLogo from '@/components/VendorLogos';
import { useIntegrationFilter } from './model/useIntegrationFilter';

// REST/GraphQL/Webhook — назви протоколів, вони однакові в усіх мовах.
const API_LABEL: Record<string, string> = localizedMap({
  REST: 'landing.int.api.rest', GraphQL: 'landing.int.api.graphql', webhook: 'landing.int.api.webhook',
  'file-exchange': 'landing.int.api.fileExchange', CAN: 'landing.int.api.can', none: 'landing.int.api.none',
});

export default function IntegrationsScreen() {
  const { category, setCategory, categories, items, liveCount, total } = useIntegrationFilter();
  const gridRef = useSectionSound<HTMLDivElement>();
  const { play } = useSound();

  return (
    <>
      {/* Шапка */}
      <section className="px-5 pb-16 pt-36 sm:px-8">
        <div className="mx-auto max-w-6xl">
          <SectionHeading
            eyebrow={t('landing.ecosystemEyebrow')}
            title={t('landing.integrationsTitle')}
            description={t('landing.integrationsLead')}
            align="left"
            className="mb-10"
          />

          <motion.div
            variants={staggerParent(0.08)}
            initial="hidden"
            whileInView="show"
            viewport={VIEWPORT}
            className="grid max-w-2xl gap-4 sm:grid-cols-3"
          >
            {[
              { to: liveCount, label: t('landing.integrationsLive'), tone: 'var(--accent)' },
              { to: total - liveCount, label: t('landing.integrationsPlanned'), tone: 'var(--warn)' },
              { to: categories.length, label: t('landing.integrationsCategories'), tone: 'var(--info)' },
            ].map(s => (
              <motion.div key={s.label} variants={fadeUp} className="glass-panel p-4">
                <AnimatedCounter
                  to={s.to}
                  className="font-display text-3xl"
                  style={{ color: s.tone }}
                />
                <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
                  {s.label}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Чесна примітка про ринок — це сильніший аргумент, ніж стіна логотипів. */}
      <section className="px-5 pb-12 sm:px-8">
        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="show"
          viewport={VIEWPORT}
          className="glass-inset mx-auto flex max-w-6xl gap-3 rounded-2xl p-5"
        >
          <Info size={16} className="mt-0.5 flex-none" style={{ color: 'var(--info)' }} />
          <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {t('landing.integrationsNote')}
          </p>
        </motion.div>
      </section>

      {/* Фільтр */}
      <section className="px-5 pb-24 sm:px-8">
        <div className="mx-auto max-w-6xl">
          {/* Sticky панель категорій */}
          <div className="sticky top-[60px] z-30 -mx-2 mb-8 flex flex-wrap gap-2 rounded-xl bg-[var(--background)]/85 p-2 backdrop-blur-md transition-all border border-transparent backdrop-saturate-150">
            {([['all', total], ...categories] as [string, number][]).map(([key, count]) => {
              const active = category === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => { setCategory(key as never); play('tick'); }}
                  className="rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors"
                  style={{
                    background: active ? 'var(--accent-soft)' : 'var(--surface)',
                    borderColor: active ? 'var(--border-accent)' : 'var(--border-subtle)',
                    color: active ? 'var(--accent)' : 'var(--text-secondary)',
                  }}
                >
                  {key === 'all' ? t('landing.filterAll') : CATEGORY_LABEL[key as never]}
                  <span className="ml-1.5 opacity-60" data-numeric>{count}</span>
                </button>
              );
            })}
          </div>

          <div ref={gridRef} className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <AnimatePresence mode="popLayout">
              {items.map(item => (
                <motion.article
                  key={item.name}
                  layout
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.3, ease: EASE_ENTER }}
                  whileHover={{ y: -4 }}
                  className="glass-panel flex flex-col gap-3 p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="shrink-0 rounded-lg overflow-hidden shadow-sm">
                        <VendorLogo name={item.name} size={28} />
                      </div>
                      <h3 className="text-sm font-semibold leading-snug">{item.name}</h3>
                    </div>
                    <span
                      className="flex flex-none items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium"
                      style={{
                        background: 'var(--surface-inset)',
                        color: STATUS_TONE[item.status],
                        border: '1px solid var(--border-subtle)',
                      }}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ background: STATUS_TONE[item.status] }}
                      />
                      {STATUS_LABEL[item.status]}
                    </span>
                  </div>

                  <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    {t(item.what)}
                  </p>
                  <p
                    className="border-l-2 pl-3 text-xs leading-relaxed"
                    style={{ borderColor: 'var(--border-accent)', color: 'var(--text-muted)' }}
                  >
                    {t(item.why)}
                  </p>

                  <div className="mt-auto flex flex-wrap gap-2 pt-1">
                    {[CATEGORY_LABEL[item.category], API_LABEL[item.api] ?? item.api].map(tag => (
                      <span
                        key={tag}
                        className="rounded-md px-2 py-0.5 text-[10px]"
                        style={{ background: 'var(--surface-inset)', color: 'var(--text-muted)' }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </motion.article>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </section>
    </>
  );
}
