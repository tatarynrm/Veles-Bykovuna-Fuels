'use client';

import React from 'react';
import { SoundProvider } from '@/features/sound';
import { MarketingNav } from '@/widgets/marketing-nav';
import MarketingFooter from '@/widgets/marketing-footer/ui/MarketingFooter';

/**
 * Спільна оболонка публічних сторінок.
 *
 * SoundProvider живе саме тут, а не в кореневому layout: звук — властивість
 * вітрини, і всередині застосунку (де диспетчер працює зі справжніми даними)
 * фонового гулу двигуна бути не повинно.
 */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <SoundProvider>
      <MarketingNav />
      <main>{children}</main>
      <MarketingFooter />
    </SoundProvider>
  );
}
