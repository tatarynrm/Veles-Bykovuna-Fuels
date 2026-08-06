import React from 'react';

interface VendorIconProps {
  name: string;
  size?: number;
  className?: string;
  glow?: boolean;
}

/**
 * Векторні логотипи вендорів для графа інтеграцій та списку каталогу.
 */
/* i18n-ignore-raw: VendorLogo */
export function VendorLogo({ name, size = 20, className = '', glow = false }: VendorIconProps) {
  const s = size;
  const key = name.toLowerCase();

  // OKKO: Зелений бренд з акцентною подвійною галочкою АЗК
  if (key.includes('okko')) {
    return (
      <svg width={s} height={s} viewBox="0 0 32 32" fill="none" className={className}>
        <rect width="32" height="32" rx="8" fill="#00A859" />
        <path d="M9 16L14 21L23 10" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M14 16L17 19L23 13" stroke="#FFDD00" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  // Shell: Жовто-червона черепашка Pecten
  if (key.includes('shell')) {
    return (
      <svg width={s} height={s} viewBox="0 0 32 32" fill="none" className={className}>
        <rect width="32" height="32" rx="8" fill="#DD1D21" />
        <path
          d="M16 5C11 5 7 9.5 7 15.5C7 19.5 9.5 22.5 12 25H20C22.5 25 25 19.5 25 15.5C25 9.5 21 5 16 5Z"
          fill="#FFD500"
        />
        <path d="M16 7V24M11.5 9.5L14 24M20.5 9.5L18 24M8 14.5L15 24M24 14.5L17 24" stroke="#DD1D21" strokeWidth="1.2" />
      </svg>
    );
  }

  // Ruptela: Телематичний логотип R на синьому тлі
  if (key.includes('ruptela')) {
    return (
      <svg width={s} height={s} viewBox="0 0 32 32" fill="none" className={className}>
        <rect width="32" height="32" rx="8" fill="#0066FF" />
        <path d="M10 8H18C20.5 8 22.5 9.5 22.5 12C22.5 14.5 20.5 16 18 16H10V8Z" fill="white" />
        <path d="M10 16H15.5L22 25H16.5L10.5 17.5V16Z" fill="white" />
        <circle cx="23" cy="8" r="2.5" fill="#00FFCC" />
      </svg>
    );
  }

  // WOG: Зелений знак W
  if (key.includes('wog')) {
    return (
      <svg width={s} height={s} viewBox="0 0 32 32" fill="none" className={className}>
        <rect width="32" height="32" rx="8" fill="#00B050" />
        <path d="M7 10L11.5 23L16 14.5L20.5 23L25 10" stroke="white" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  // Укрнафта / Ukrnafta: Жовто-блакитна крапля пального
  if (key.includes('укрнафта') || key.includes('ukrnafta')) {
    return (
      <svg width={s} height={s} viewBox="0 0 32 32" fill="none" className={className}>
        <rect width="32" height="32" rx="8" fill="#0A3B7C" />
        <path d="M16 6C16 6 8 16 8 21C8 25.4 11.6 27 16 27C20.4 27 24 25.4 24 21C24 16 16 6 16 6Z" fill="#FFD700" />
        <path d="M16 11C16 11 11 18 11 21.5C11 24 13.2 25 16 25C18.8 25 21 24 21 21.5C21 18 16 11 16 11Z" fill="#0057B7" />
      </svg>
    );
  }

  // SOCAR: Вогонь (синій, червоний, зелений)
  if (key.includes('socar')) {
    return (
      <svg width={s} height={s} viewBox="0 0 32 32" fill="none" className={className}>
        <rect width="32" height="32" rx="8" fill="#1A1F2C" />
        <path d="M12 24C10 20 11 15 13.5 11C14.5 15 16.5 18 19 21C21 18 21.5 13 18.5 7C22.5 9 24.5 14 24 19C23.5 23.5 19.5 26 16 26C14 26 12.8 25.2 12 24Z" fill="#0097D6" />
        <path d="M13 24C12 21 13 17 15 14C16 17 17.5 19 19.5 21C18 24 15 25.5 13 24Z" fill="#E03838" />
        <path d="M14.5 24C14 22 14.5 19 16 17.5C16.8 19.5 17.5 21 17 23.5C16 24.5 15 24.5 14.5 24Z" fill="#00A859" />
      </svg>
    );
  }

  // AMIC Energy: Червоно-синій логотип AMIC
  if (key.includes('amic')) {
    return (
      <svg width={s} height={s} viewBox="0 0 32 32" fill="none" className={className}>
        <rect width="32" height="32" rx="8" fill="#E30613" />
        <path d="M7 24L16 7L25 24H19.5L16 17L12.5 24H7Z" fill="white" />
        <path d="M12.5 24L16 17L19.5 24H12.5Z" fill="#003399" />
      </svg>
    );
  }

  // UPG: Зелено-жовтий знак UPG
  if (key.includes('upg')) {
    return (
      <svg width={s} height={s} viewBox="0 0 32 32" fill="none" className={className}>
        <rect width="32" height="32" rx="8" fill="#005B36" />
        <path d="M9 9V17C9 20.5 11.5 23 15 23C18.5 23 21 20.5 21 17V9H17V17C17 18 16.2 19 15 19C13.8 19 13 18 13 17V9H9Z" fill="#FFC72C" />
        <circle cx="23" cy="11" r="2.5" fill="#FFC72C" />
      </svg>
    );
  }

  // flespi: Оранжево-чорний телематичний хексагон
  if (key.includes('flespi')) {
    return (
      <svg width={s} height={s} viewBox="0 0 32 32" fill="none" className={className}>
        <rect width="32" height="32" rx="8" fill="#FF5500" />
        <path d="M16 6L25 11V21L16 26L7 21V11L16 6Z" stroke="white" strokeWidth="2" fill="none" />
        <path d="M12 16H20M16 12V20" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    );
  }

  // Wialon: Синя куля Gurtam / Wialon
  if (key.includes('wialon')) {
    return (
      <svg width={s} height={s} viewBox="0 0 32 32" fill="none" className={className}>
        <rect width="32" height="32" rx="8" fill="#0275D8" />
        <circle cx="16" cy="16" r="9" stroke="white" strokeWidth="2" fill="none" />
        <path d="M8 16H24M16 7C19 10 20 13 20 16C20 19 19 22 16 25C13 22 12 19 12 16C12 13 13 10 16 7Z" stroke="white" strokeWidth="1.5" />
      </svg>
    );
  }

  // Technoton: Датчики пального DUT-E (синьо-золотий Т)
  if (key.includes('technoton')) {
    return (
      <svg width={s} height={s} viewBox="0 0 32 32" fill="none" className={className}>
        <rect width="32" height="32" rx="8" fill="#1C3D5A" />
        <path d="M7 9H25V13H18V24H14V13H7V9Z" fill="#F6AD55" />
      </svg>
    );
  }

  // Omnicomm: Датчики LLS (червоний O)
  if (key.includes('omnicomm')) {
    return (
      <svg width={s} height={s} viewBox="0 0 32 32" fill="none" className={className}>
        <rect width="32" height="32" rx="8" fill="#E53E3E" />
        <circle cx="16" cy="16" r="8" stroke="white" strokeWidth="3.5" fill="none" />
        <circle cx="16" cy="16" r="3" fill="white" />
      </svg>
    );
  }

  // monobank: Чорно-білий кіт / M
  if (key.includes('monobank')) {
    return (
      <svg width={s} height={s} viewBox="0 0 32 32" fill="none" className={className}>
        <rect width="32" height="32" rx="8" fill="#111111" />
        <path d="M10 22V10L16 16L22 10V22" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="16" cy="7" r="1.5" fill="#FF4B4B" />
      </svg>
    );
  }

  // ПриватБанк / PrivatBank: Зелений квадрат з замком 'P'
  if (key.includes('приват') || key.includes('privat')) {
    return (
      <svg width={s} height={s} viewBox="0 0 32 32" fill="none" className={className}>
        <rect width="32" height="32" rx="8" fill="#2E7D32" />
        <path d="M10 8H17C19.8 8 22 9.8 22 12.5C22 15.2 19.8 17 17 17H14V24H10V8Z" fill="white" />
        <rect x="14" y="11" width="4" height="3.5" rx="1" fill="#2E7D32" />
      </svg>
    );
  }

  // Вчасно / Vchasno: Бірюзовий V-пташка ЕДО
  if (key.includes('вчасно') || key.includes('vchasno')) {
    return (
      <svg width={s} height={s} viewBox="0 0 32 32" fill="none" className={className}>
        <rect width="32" height="32" rx="8" fill="#00B4D8" />
        <path d="M8 15L14 21L24 9" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  // BAS ERP / 1С: Жовто-червоний бренд BAS
  if (key.includes('bas erp') || key.includes('1с')) {
    return (
      <svg width={s} height={s} viewBox="0 0 32 32" fill="none" className={className}>
        <rect width="32" height="32" rx="8" fill="#D90429" />
        <rect x="5" y="5" width="22" height="22" rx="4" fill="#FFD166" />
        <text x="16" y="20" textAnchor="middle" fontSize="11" fontWeight="900" fontFamily="sans-serif" fill="#D90429">
          BAS
        </text>
      </svg>
    );
  }

  // HERE Routing: Циановий маркер локації HERE
  if (key.includes('here')) {
    return (
      <svg width={s} height={s} viewBox="0 0 32 32" fill="none" className={className}>
        <rect width="32" height="32" rx="8" fill="#1C2024" />
        <path d="M16 6C11.5 6 8 9.5 8 14C8 19.5 16 26 16 26C16 26 24 19.5 24 14C24 9.5 20.5 6 16 6Z" fill="#00C8B3" />
        <circle cx="16" cy="13.5" r="3.5" fill="#1C2024" />
      </svg>
    );
  }

  // Power BI: Золотистий гістограмний логотип Microsoft Power BI
  if (key.includes('power bi')) {
    return (
      <svg width={s} height={s} viewBox="0 0 32 32" fill="none" className={className}>
        <rect width="32" height="32" rx="8" fill="#F2C811" />
        <rect x="8" y="16" width="4" height="9" rx="1" fill="#111111" />
        <rect x="14" y="12" width="4" height="13" rx="1" fill="#111111" />
        <rect x="20" y="7" width="4" height="18" rx="1" fill="#111111" />
      </svg>
    );
  }

  // Telegram: Паперовий літачок у блакитному колі
  if (key.includes('telegram')) {
    return (
      <svg width={s} height={s} viewBox="0 0 32 32" fill="none" className={className}>
        <rect width="32" height="32" rx="8" fill="#24A1DE" />
        <path d="M7 15.5L24 9L18.5 24L14.5 19L11.5 21.5V17.5L20 12.5L10.5 16.5L7 15.5Z" fill="white" />
      </svg>
    );
  }

  // VELES ERP (Ядро): Щит / герб Veles
  if (key.includes('veles') || key === 'core') {
    return (
      <svg width={s} height={s} viewBox="0 0 32 32" fill="none" className={className}>
        <rect width="32" height="32" rx="8" fill="#6366F1" />
        <path d="M16 6L24 10V17C24 21.5 20.5 25 16 26.5C11.5 25 8 21.5 8 17V10L16 6Z" fill="#1E1B4B" />
        <path d="M12 11L16 20L20 11" stroke="#818CF8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  // Запасний красивий векторний бейдж
  return (
    <svg width={s} height={s} viewBox="0 0 32 32" fill="none" className={className}>
      <rect width="32" height="32" rx="8" fill="#334155" />
      <circle cx="16" cy="16" r="6" fill="#94A3B8" />
    </svg>
  );
}

export default VendorLogo;
