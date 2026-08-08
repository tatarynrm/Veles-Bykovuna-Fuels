'use client';

import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

interface Props {
  /** Скільки кадрів у наборі. Файли лежать як `${dir}/001.jpg`. */
  count: number;
  /** Каталог у /public без слеша в кінці. */
  dir: string;
  /** Наскільки заздалегідь починати завантаження кадрів. */
  rootMargin?: string;
  className?: string;
  style?: React.CSSProperties;
}

export interface FrameSequenceHandle {
  /** Показати кадр за прогресом 0..1. Викликається зі скролу, повз React. */
  show: (progress: number) => void;
}

/** Одночасних завантажень. Більше — і кадри починають конкурувати з рештою сторінки. */
const CONCURRENCY = 6;
/** Канва не має сенсу ширшою за вихідні кадри — це лише зайва заливка. */
const MAX_CANVAS_WIDTH = 1600;

/**
 * Порядок завантаження від грубого до дрібного: спершу перший кадр, далі
 * кожен n-й, потім проміжки, і так до повного набору.
 *
 * Так уже за перші кілька відсотків завантаження набір покриває всю довжину
 * прокрутки: людина, яка одразу поїхала скролом униз, бачить приблизно
 * правильний кадр, а не порожнечу до кінця завантаження.
 */
function loadOrder(count: number): number[] {
  const order: number[] = [];
  const seen = new Set<number>();
  const push = (i: number) => {
    if (i >= 0 && i < count && !seen.has(i)) {
      seen.add(i);
      order.push(i);
    }
  };

  push(0);
  push(count - 1);
  for (let step = Math.max(1, Math.floor(count / 4)); step >= 1; step = Math.floor(step / 2)) {
    for (let i = 0; i < count; i += step) push(i);
    if (step === 1) break;
  }
  for (let i = 0; i < count; i++) push(i);
  return order;
}

const frameUrl = (dir: string, i: number) => `${dir}/${String(i + 1).padStart(3, '0')}.jpg`;

/**
 * Розкадровка як послідовність зображень на канві.
 *
 * Це заміна прокрутці відео по `currentTime`. У вихідному ролику три ключові
 * кадри на 470, тож кожна перемотка змушувала декодер програти до трьохсот
 * кадрів — при вимірюванні щокадру скролу сторінка від цього вставала.
 * Окремі JPEG такої залежності не мають: показ кадру — це `drawImage`,
 * тобто копіювання вже розпакованої картинки.
 *
 * Кадри навмисно проріджені вдвічі проти вихідного набору: сто штук на пʼять
 * екранів прокрутки — це кадр на кожні сорок пікселів, дрібніше око вже не
 * розрізняє, а важить набір менше за сам ролик.
 */
const FrameSequence = forwardRef<FrameSequenceHandle, Props>(function FrameSequence(
  { count, dir, rootMargin = '600px 0px', className, style },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imagesRef = useRef<(HTMLImageElement | null)[]>([]);
  const startedRef = useRef(false);
  /** Який кадр треба показати за скролом. */
  const wantedRef = useRef(0);
  /** Що справді намальовано — може відставати, поки потрібний кадр не доїхав. */
  const paintedRef = useRef<HTMLImageElement | null>(null);

  /** Найближчий уже завантажений кадр — щоб під час завантаження не блимало порожнім. */
  const nearestLoaded = (index: number): HTMLImageElement | null => {
    const images = imagesRef.current;
    if (images[index]) return images[index];
    for (let d = 1; d < count; d++) {
      if (images[index - d]) return images[index - d];
      if (images[index + d]) return images[index + d];
    }
    return null;
  };

  /*
    Малювання розведене з наміром навмисно. Раніше `show()` запамʼятовував
    індекс до того, як кадр реально потрапляв на канву, — і якщо потрібного
    зображення ще не було, засувка «цей індекс уже показано» лишалася
    зведеною назавжди, а на екрані висів перший-ліпший завантажений кадр.

    Тепер порівнюється не індекс, а те, що справді намальовано: щойно
    доїжджає точніший кадр, `render()` його підмінює.
  */
  const render = () => {
    const canvas = canvasRef.current;
    if (!canvas || !canvas.width) return;

    const img = nearestLoaded(wantedRef.current);
    if (!img || img === paintedRef.current) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width: cw, height: ch } = canvas;
    // «cover»: кадр заповнює канву цілком, зайве обрізається симетрично.
    const scale = Math.max(cw / img.naturalWidth, ch / img.naturalHeight);
    const dw = img.naturalWidth * scale;
    const dh = img.naturalHeight * scale;
    ctx.drawImage(img, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
    paintedRef.current = img;
  };

  useImperativeHandle(ref, () => ({
    show(progress: number) {
      const index = Math.min(count - 1, Math.max(0, Math.round(progress * (count - 1))));
      if (index === wantedRef.current && paintedRef.current) return;
      wantedRef.current = index;
      render();
    },
  }), [count]);

  /* Розмір канви — у пікселях пристрою, але не більший за вихідні кадри. */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.min(Math.round(rect.width * dpr), MAX_CANVAS_WIDTH);
      const height = Math.round(width * (rect.height / rect.width));
      if (canvas.width === width && canvas.height === height) return;
      canvas.width = width;
      canvas.height = height;
      // Зміна розміру чистить канву, тож намальоване треба відновити.
      paintedRef.current = null;
      render();
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count]);

  /* Завантаження стартує на підході до секції, а не з відкриттям сторінки. */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    imagesRef.current = new Array(count).fill(null);
    let cancelled = false;

    const start = () => {
      if (startedRef.current) return;
      startedRef.current = true;

      const order = loadOrder(count);
      let next = 0;

      const pump = () => {
        if (cancelled || next >= order.length) return;
        const index = order[next++];
        const img = new Image();
        img.decoding = 'async';
        img.onload = () => {
          if (cancelled) return;
          imagesRef.current[index] = img;
          // render() сам вирішить, чи цей кадр ближчий за намальований.
          render();
          pump();
        };
        img.onerror = pump;
        img.src = frameUrl(dir, index);
      };

      for (let i = 0; i < CONCURRENCY; i++) pump();
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        start();
        observer.disconnect();
      },
      { rootMargin },
    );
    observer.observe(canvas);

    return () => {
      cancelled = true;
      observer.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, dir, rootMargin]);

  return <canvas ref={canvasRef} aria-hidden className={className} style={style} />;
});

export default FrameSequence;
