/**
 * גודל התצוגה.
 *
 * מה שהיה שבור: הסרגל ב-StatusBar.vue קידד `min="50" max="200"` בתבנית, ואיש
 * לא שאל את המנוע. הגבולות האמיתיים יושבים ב-`ui.zoom.getSnapshot()`, ומסמך
 * שהמנוע מגביל אחרת היה מקבל סרגל שנע לערכים שהמנוע דוחה — הסרגל זז והמסמך
 * לא. הבדיקות כאן מקבעות שהגבולות מגיעים מהמנוע, ושדיווח פגום שלו נופל בחן
 * לברירת מחדל שאפשר לעבוד איתה ולא משתיק את הסרגל.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  FALLBACK_ZOOM,
  clampZoom,
  normalizeZoomState,
  observeZoom,
  readZoom,
} from '../../src/engine/zoom';

describe('clampZoom', () => {
  it('מגביל לטווח ומעגל', () => {
    expect(clampZoom(150, 50, 200)).toBe(150);
    expect(clampZoom(320, 50, 200)).toBe(200);
    expect(clampZoom(10, 50, 200)).toBe(50);
    expect(clampZoom(99.6, 50, 200)).toBe(100);
  });

  it('ערך שאינו מספר חוזר לברירת המחדל', () => {
    expect(clampZoom(Number.NaN, 50, 200)).toBe(FALLBACK_ZOOM.value);
  });
});

describe('normalizeZoomState', () => {
  it('לוקח את הגבולות מהמנוע', () => {
    expect(normalizeZoomState({ value: 120, min: 25, max: 400 })).toEqual({
      value: 120,
      min: 25,
      max: 400,
    });
  });

  it('מגביל את הערך המדווח לגבולות המדווחים', () => {
    expect(normalizeZoomState({ value: 500, min: 25, max: 400 }).value).toBe(400);
  });

  it('טווח הפוך נדחה — הוא היה מקפיא כל ערך על אותו מספר', () => {
    expect(normalizeZoomState({ value: 100, min: 400, max: 25 })).toEqual(FALLBACK_ZOOM);
  });

  it('גבולות שאינם מספרים חיוביים נופלים לברירת המחדל', () => {
    expect(normalizeZoomState({ value: 100, min: 0, max: 0 })).toEqual(FALLBACK_ZOOM);
    expect(normalizeZoomState({ value: 100, min: '50', max: '200' })).toEqual(FALLBACK_ZOOM);
    expect(normalizeZoomState(null)).toEqual(FALLBACK_ZOOM);
    expect(normalizeZoomState({})).toEqual(FALLBACK_ZOOM);
  });
});

describe('readZoom', () => {
  it('קורא את ה-snapshot של המנוע', () => {
    const ui = { zoom: { getSnapshot: () => ({ value: 75, min: 10, max: 500 }) } };
    expect(readZoom(ui)).toEqual({ value: 75, min: 10, max: 500 });
  });

  it('גרסת מנוע בלי zoom אינה מפילה', () => {
    expect(readZoom({})).toEqual(FALLBACK_ZOOM);
    expect(readZoom(null)).toEqual(FALLBACK_ZOOM);
  });

  it('snapshot שזורק מוחזר כברירת מחדל ולא כחריגה', () => {
    const ui = {
      zoom: {
        getSnapshot: () => {
          throw new Error('controller מפורק');
        },
      },
    };
    expect(readZoom(ui)).toEqual(FALLBACK_ZOOM);
  });
});

describe('observeZoom', () => {
  it('מדווח על כל שינוי, מנורמל', () => {
    const listeners: Array<(slice: unknown) => void> = [];
    const ui = {
      zoom: {
        getSnapshot: () => ({ value: 100, min: 50, max: 200 }),
        observe: (listener: (slice: { value?: unknown }) => void) => {
          listeners.push(listener as (slice: unknown) => void);
          return () => {};
        },
      },
    };
    const seen: unknown[] = [];

    observeZoom(ui, (state) => seen.push(state));
    listeners[0]({ value: 180, min: 50, max: 200 });

    expect(seen).toEqual([{ value: 180, min: 50, max: 200 }]);
  });

  it('מחזיר disposer, ומעביר את זה של המנוע', () => {
    const unsubscribe = vi.fn();
    const ui = { zoom: { observe: () => unsubscribe } };

    observeZoom(ui, () => {})();

    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('בלי observe — מדווח פעם אחת ומחזיר disposer שאינו נופל', () => {
    const seen: unknown[] = [];
    const dispose = observeZoom({ zoom: { getSnapshot: () => ({ value: 90, min: 50, max: 200 }) } }, (state) =>
      seen.push(state),
    );

    expect(seen).toEqual([{ value: 90, min: 50, max: 200 }]);
    expect(() => dispose()).not.toThrow();
  });

  it('observe שזורק אינו מפיל את פתיחת המסמך', () => {
    const seen: unknown[] = [];
    const dispose = observeZoom(
      {
        zoom: {
          getSnapshot: () => ({ value: 100, min: 50, max: 200 }),
          observe: () => {
            throw new Error('boom');
          },
        },
      },
      (state) => seen.push(state),
    );

    expect(seen).toEqual([FALLBACK_ZOOM]);
    expect(() => dispose()).not.toThrow();
  });
});
