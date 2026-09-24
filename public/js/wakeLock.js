// Keeps the phone screen from dimming/locking while lyrics are on screen
// (Screen Wake Lock API). Silently does nothing on browsers without support.

let lock = null;
let wanted = false;

async function acquire() {
  if (!wanted || lock || !('wakeLock' in navigator) || document.visibilityState !== 'visible') return;
  try {
    lock = await navigator.wakeLock.request('screen');
    lock.addEventListener('release', () => {
      lock = null;
    });
  } catch {
    lock = null; // e.g. battery saver mode; not critical
  }
}

// The browser drops the lock when the tab is hidden; take it again on return.
document.addEventListener('visibilitychange', acquire);

export function keepScreenOn(on) {
  wanted = on;
  if (on) acquire();
  else if (lock) lock.release().catch(() => {});
}
