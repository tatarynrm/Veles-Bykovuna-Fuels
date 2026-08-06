'use client';

import React from 'react';
import { Layers, Droplet, Flame } from 'lucide-react';
import { t } from '@/lib/i18n';

interface BrandTabsProps {
  activeBrand: string;
  onSelectBrand: (brand: string) => void;
}

const brands = [
  { id: 'ALL', label: 'nav.allNetworks', hint: 'OKKO + Shell', icon: Layers },
  { id: 'OKKO', label: 'common.okko', hint: 'ERP v2', icon: Droplet },
  { id: 'SHELL', label: 'common.shell', hint: 'Mobility B2B', icon: Flame },
];

export default function BrandTabs({ activeBrand, onSelectBrand }: BrandTabsProps) {
  return (
    <div className="segmented max-w-full overflow-x-auto" role="tablist" aria-label={t('common.stationNetwork')}>
      {brands.map((b) => {
        const active = activeBrand === b.id;
        const Icon = b.icon;
        return (
          <button
            key={b.id}
            role="tab"
            aria-selected={active}
            onClick={() => onSelectBrand(b.id)}
            className={`segmented-item flex items-center gap-2 ${active ? 'segmented-item-active' : ''}`}
          >
            <Icon
              className={`h-3.5 w-3.5 ${
                active ? (b.id === 'SHELL' ? 'text-warn' : 'text-accent') : 'text-txt-muted'
              }`}
            />
            <span>{t(b.label)}</span>
            <span className="hidden font-mono text-micro font-normal text-txt-muted sm:inline">
              {b.hint}
            </span>
          </button>
        );
      })}
    </div>
  );
}
