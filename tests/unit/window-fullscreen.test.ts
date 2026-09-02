/**
 * מסך מלא ברמת החלון.
 *
 * מה שהבדיקות האלה מקבעות הוא בעיקר **מה קורה כשזה לא עובד**: אוצריא רצה על
 * שלושה מאחזים (WebView2, WKWebView, דפדפן), ורק אחד מהם מבטיח את ה-API הלא
 * מקודם. מצב מיקוד שנשען על מסך מלא שנכשל היה מצב מיקוד שבור בשני השלישים
 * האחרים.
 */
import { describe, expect, it, vi } from 'vitest';
import {
  enterFullscreen,
  exitFullscreen,
  isFullscreen,
  watchFullscreen,
  type FullscreenOwner,
} from '../../src/composables/window-fullscreen';

/** מאחז מדומה. `flavour` בוחר איזה שם ל-API הוא חושף. */
function fakeOwner(flavour: 'standard' | 'webkit' | 'none'): FullscreenOwner & {
  calls: string[];
  listeners: Map<string, Array<() => void>>;
  fire: (event: string) => void;
} {
  const calls: string[] = [];
  const listeners = new Map<string, Array<() => void>>();
  const owner = {
    calls,
    listeners,
    fullscreenElement: null as Element | null,
    documentElement: {
      ...(flavour === 'standard'
        ? {
            requestFullscreen: async () => {
              calls.push('request');
              owner.fullscreenElement = {} as Element;
            },
          }
        : {}),
      ...(flavour === 'webkit'
        ? {
            webkitRequestFullscreen: () => {
              calls.push('webkitRequest');
              owner.fullscreenElement = {} as Element;
            },
          }
        : {}),
    },
    exitFullscreen:
      flavour === 'standard'
        ? async () => {
            calls.push('exit');
            owner.fullscreenElement = null;
          }
        : undefined,
    webkitExitFullscreen:
      flavour === 'webkit'
        ? () => {
            calls.push('webkitExit');
            owner.fullscreenElement = null;
          }
        : undefined,
    addEventListener: (type: string, listener: () => void) => {
      listeners.set(type, [...(listeners.get(type) ?? []), listener]);
    },
    removeEventListener: (type: string, listener: () => void) => {
      listeners.set(type, (listeners.get(type) ?? []).filter((l) => l !== listener));
    },
    fire: (event: string) => {
      for (const listener of listeners.get(event) ?? []) listener();
    },
  };
  return owner;
}

describe('enterFullscreen / exitFullscreen', () => {
  it('קוראת ל-API הלא מקודם כשהוא קיים', async () => {
    const owner = fakeOwner('standard');
    expect(await enterFullscreen(owner)).toBe(true);
    expect(isFullscreen(owner)).toBe(true);
    expect(owner.calls).toEqual(['request']);
  });

  it('נופלת לקידומת של WebKit — זה ה-WebView של macOS', async () => {
    const owner = fakeOwner('webkit');
    expect(await enterFullscreen(owner)).toBe(true);
    expect(owner.calls).toEqual(['webkitRequest']);
    expect(await exitFullscreen(owner)).toBe(true);
    expect(owner.calls).toEqual(['webkitRequest', 'webkitExit']);
  });

  it('מאחז שאין בו API מחזיר false ואינו זורק', async () => {
    // זה המקרה שבגללו הפונקציה מחזירה ערך ולא זורקת: היא נקראת מתוך טיפול
    // במקש, וחריגה שם מפילה את המאזין הגלובלי — כלומר את כל הקיצורים.
    await expect(enterFullscreen(fakeOwner('none'))).resolves.toBe(false);
  });

  it('בקשה שנדחתה אינה זורקת', async () => {
    const owner = fakeOwner('standard');
    owner.documentElement = {
      requestFullscreen: () => Promise.reject(new Error('disallowed')),
    };
    await expect(enterFullscreen(owner)).resolves.toBe(false);
  });

  it('יציאה כשלא היינו במסך מלא אינה קוראת לכלום', async () => {
    const owner = fakeOwner('standard');
    expect(await exitFullscreen(owner)).toBe(false);
    expect(owner.calls).toEqual([]);
  });
});

describe('watchFullscreen', () => {
  it('מדווחת על יציאה שלא באה מאיתנו — Escape של הדפדפן', () => {
    const owner = fakeOwner('standard');
    const seen: boolean[] = [];
    const stop = watchFullscreen((fullscreen) => seen.push(fullscreen), owner);

    owner.fullscreenElement = {} as Element;
    owner.fire('fullscreenchange');
    owner.fullscreenElement = null;
    owner.fire('fullscreenchange');

    expect(seen).toEqual([true, false]);
    stop();
    owner.fire('fullscreenchange');
    expect(seen).toEqual([true, false]);
  });

  it('מאזינה גם לשם המקודם', () => {
    const owner = fakeOwner('webkit');
    const onChange = vi.fn();
    watchFullscreen(onChange, owner);
    owner.fire('webkitfullscreenchange');
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('מאחז בלי האזנה מחזיר פירוק שאינו זורק', () => {
    expect(() => watchFullscreen(() => {}, {})()).not.toThrow();
  });
});
