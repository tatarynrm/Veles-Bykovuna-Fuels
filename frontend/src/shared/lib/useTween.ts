'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Плавно доганяє змінне цільове значення.
 *
 * Потрібне там, де ціль стрибає дискретно (година, обрана скролом), а на
 * екрані має рухатись число, а не клацати. Експоненційне згладжування, а не
 * анімація фіксованої тривалості: ціль може змінитись посеред руху, і твін
 * з тривалістю в такому разі щоразу перезапускався б із ривком.
 */
export function useTween(target: number, smoothing = 0.16): number {
  const [value, setValue] = useState(target);
  const currentRef = useRef(target);
  const targetRef = useRef(target);
  targetRef.current = target;

  useEffect(() => {
    let frame = 0;

    const tick = () => {
      const diff = targetRef.current - currentRef.current;
      // Ближче ніж піввідсотка — сідаємо рівно на ціль, інакше рушій
      // крутиться вічно на нескінченно малих кроках.
      if (Math.abs(diff) < 0.5) {
        currentRef.current = targetRef.current;
        setValue(targetRef.current);
      } else {
        currentRef.current += diff * smoothing;
        setValue(currentRef.current);
      }
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [smoothing]);

  return value;
}
