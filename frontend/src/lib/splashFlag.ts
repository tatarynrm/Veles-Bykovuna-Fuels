export const SPLASH_EVENT = 'veles:splash';

/** Fire this just before router.push('/') to trigger the splash screen. */
export function markSplashPending() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(SPLASH_EVENT));
  }
}
