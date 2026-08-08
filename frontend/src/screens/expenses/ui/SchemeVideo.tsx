'use client';

import React, { useEffect, useRef, useState } from 'react';

interface Props {
  src: string;
  /**
   * Чи має ролик грати саме зараз. Видимості замало: у сцені рейсу два кадри
   * лежать один на одному, і той, що під низом, не має декодуватися дарма.
   */
  active?: boolean;
  /** Вантажити одразу з монтуванням — тільки для першого екрана. */
  eager?: boolean;
  /**
   * Почати завантаження раніше, ніж кадр підійде до в'юпорта. Потрібно там,
   * де поява керується скролом: до показу лишається пів секунди, і ролик має
   * бути готовий, а не починати вантажитись у момент появи.
   */
  warm?: boolean;
  /** Наскільки заздалегідь стартує завантаження. */
  rootMargin?: string;
  /**
   * Не вантажити за фактом появи у в'юпорті — тільки за явним `warm`.
   *
   * Потрібно для нижнього шару сцени рейсу: він лежить точно під верхнім,
   * тож для спостерігача «видимий» разом із ним, хоча насправді прихований
   * через visibility (IntersectionObserver про visibility не знає). Без цього
   * обидва ролики стартували б одночасно, і сенс лінивого завантаження зникав.
   */
  defer?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Відео схеми з лінивим завантаженням і відтворенням на вимогу.
 *
 * Сторінка тримає чотири повноекранні кадри (шапка, дві половини сцени рейсу,
 * фінальна розкадровка). Поки всі вони були звичайними
 * `<video preload="auto" autoplay>`, браузер тягнув ~10 МБ одразу й декодував
 * чотири потоки 720p паралельно — звідси і довге завантаження, і ривки.
 *
 * Тут `src` зʼявляється лише тоді, коли елемент підходить до в'юпорта (або
 * коли про нього попросили заздалегідь через `warm`), а `play()` викликається
 * тільки для того кадру, який справді видно. Сам елемент у розмітці є завжди —
 * інакше не було б за чим спостерігати, і GSAP не мав би що анімувати.
 */
export default function SchemeVideo({
  src,
  active = true,
  eager = false,
  warm = false,
  rootMargin = '400px 0px',
  defer = false,
  className,
  style,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [near, setNear] = useState(eager);
  const [visible, setVisible] = useState(eager);

  /*
    Два спостерігачі, бо межі в них різні: завантаження стартує заздалегідь
    (щоб кадр устиг доїхати), а відтворення — рівно за фактом видимості.
  */
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    let loader: IntersectionObserver | undefined;
    if (!eager && !defer) {
      loader = new IntersectionObserver(
        ([entry]) => {
          if (!entry.isIntersecting) return;
          setNear(true);
          loader?.disconnect();
        },
        { rootMargin },
      );
      loader.observe(el);
    }

    const player = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { threshold: 0 },
    );
    player.observe(el);

    return () => {
      loader?.disconnect();
      player.disconnect();
    };
  }, [eager, defer, rootMargin]);

  const loaded = eager || near || warm;
  const playing = loaded && active && visible;

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !loaded) return;
    // play() відхиляється, якщо елемент прибрали або джерело ще міняється —
    // це не помилка застосунку.
    if (playing) void el.play().catch(() => {});
    else el.pause();
  }, [playing, loaded]);

  return (
    <video
      ref={videoRef}
      src={loaded ? src : undefined}
      preload={loaded ? 'auto' : 'none'}
      muted
      loop
      playsInline
      disablePictureInPicture
      aria-hidden
      className={className}
      style={style}
    />
  );
}
