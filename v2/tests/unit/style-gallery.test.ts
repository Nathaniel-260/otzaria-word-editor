/**
 * גלריית הסגנונות.
 *
 * מה שנבדק כאן הוא הדבר שהיה שבור ואינו נראה בעין: הרשימה הייתה קשיחה — שישה
 * מזהים אנגליים עם תוויות שתרגמנו — ולכן הסגנונות של המסמך עצמו, כולל סגנונות
 * מותאמים ושמות עבריים, לא הופיעו בגלריה כלל. הקטלוג נפתר אסינכרונית, ולכן
 * בדיקה שקוראת פעם אחת אינה מוכיחה כלום; המסלול האמיתי נבדק דרך ההרשמה.
 *
 * הכפיל כאן מחזיר `StylesSlice` מלא ומטופס, ולא אובייקט מתירני: כפיל שמאשר כל
 * צורה מאשר גם צורה שהמנוע לא היה מחזיר, ואז הבדיקה ירוקה והתוסף שבור.
 */
import { describe, expect, it, vi } from 'vitest';
import type { StyleCatalogItem } from 'superdoc/ui';
import {
  FALLBACK_STYLES,
  clampPreviewFontSize,
  fallbackStyleGallery,
  observeStyleGallery,
  previewStyleFor,
  readStyleGallery,
  styleRole,
  toGalleryItems,
  toGalleryState,
  type StyleGalleryHost,
  type StyleGalleryState,
  type StylesSlice,
} from '../../src/engine/style-gallery';

/* ------------------------------------------------------------------ */
/* כפילים בצורת החוזה                                                  */
/* ------------------------------------------------------------------ */

/** פריט קטלוג מלא. כל השדות שהחוזה מחייב, כדי שהכפיל לא יהיה מתירני מהמנוע. */
function catalogItem(overrides: Partial<StyleCatalogItem> & { id: string }): StyleCatalogItem {
  return {
    name: overrides.id,
    aliases: [],
    type: 'paragraph',
    custom: false,
    builtin: true,
    default: false,
    basedOn: null,
    next: null,
    link: null,
    priority: null,
    qFormat: true,
    hidden: false,
    semiHidden: false,
    unhideWhenUsed: false,
    locked: false,
    provenance: 'authored',
    visibility: {
      quickGallery: true,
      recommended: true,
      all: true,
      effectivelyHidden: false,
    },
    ...overrides,
  };
}

/** slice מלא. ברירת המחדל היא המצב שלפני התייצבות הקטלוג. */
function slice(overrides: Partial<StylesSlice> = {}): StylesSlice {
  return {
    ready: true,
    status: 'ready',
    catalogRevision: 'rev-1',
    quickGallery: [],
    activeParagraphStyleId: null,
    activeParagraphStyleName: null,
    mixedSelection: false,
    sourceStatus: null,
    diagnostics: [],
    ...overrides,
  };
}

/** גלריה עברית, כמו במסמך שנוצר ב-Word בעברית. */
const HEBREW_GALLERY: readonly StyleCatalogItem[] = [
  catalogItem({ id: 'Normal', name: 'רגיל' }),
  catalogItem({ id: 'Heading1', name: 'כותרת 1' }),
  catalogItem({ id: 'Heading2', name: 'כותרת 2' }),
  catalogItem({ id: 'MyStyle', name: 'סגנון שלי', custom: true, builtin: false }),
];

const fallbackIds = FALLBACK_STYLES.map((style) => style.id);
const ids = (state: StyleGalleryState) => state.items.map((item) => item.id);

/* ------------------------------------------------------------------ */
/* נפילה סגורה                                                         */
/* ------------------------------------------------------------------ */

describe('נפילה לרשת הביטחון', () => {
  it('אין `ui` בכלל — הרשימה שלנו, לא רשימה ריקה', () => {
    expect(ids(readStyleGallery(null))).toEqual(fallbackIds);
    expect(ids(readStyleGallery(undefined))).toEqual(fallbackIds);
    expect(readStyleGallery(null).fromDocument).toBe(false);
  });

  it('גרסת מנוע בלי `styles` אינה מפילה את הרצועה', () => {
    expect(ids(readStyleGallery({}))).toEqual(fallbackIds);
  });

  it('קטלוג ריק לפני ההתייצבות (`status: pending`) — רשת הביטחון', () => {
    const host: StyleGalleryHost = {
      styles: { getSnapshot: () => slice({ status: 'pending', catalogRevision: null }) },
    };
    const state = readStyleGallery(host);
    expect(ids(state)).toEqual(fallbackIds);
    expect(state.fromDocument).toBe(false);
  });

  it('`getSnapshot` שזורק — נופל למסלול `getQuickGallery`', () => {
    const host: StyleGalleryHost = {
      styles: {
        getSnapshot: () => {
          throw new Error('not mounted');
        },
        getQuickGallery: () => HEBREW_GALLERY,
        getActiveParagraphStyle: () => ({
          styleId: 'Heading1',
          styleName: 'כותרת 1',
          mixed: false,
          diagnostics: [],
        }),
      },
    };
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const state = readStyleGallery(host);
    warn.mockRestore();

    expect(ids(state)).toEqual(['Normal', 'Heading1', 'Heading2', 'MyStyle']);
    expect(state.activeId).toBe('Heading1');
  });

  it('`getQuickGallery` שזורק — רשת הביטחון ולא קריסה', () => {
    const host: StyleGalleryHost = {
      styles: {
        getQuickGallery: () => {
          throw new Error('worker-backed editor');
        },
      },
    };
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const state = readStyleGallery(host);
    warn.mockRestore();

    expect(ids(state)).toEqual(fallbackIds);
    expect(state.fromDocument).toBe(false);
  });

  it('רשת הביטחון אינה משותפת — קורא אחד אינו משנה אותה לכולם', () => {
    const first = fallbackStyleGallery();
    const second = fallbackStyleGallery();
    expect(first.items).not.toBe(second.items);
    expect(first.items[0].previewStyle).not.toBe(second.items[0].previewStyle);
  });

  it('לכל פריט ברשת הביטחון יש צבע מתפקיד ה-API, בלי hex', () => {
    for (const item of fallbackStyleGallery().items) {
      expect(item.previewStyle.color).toMatch(/^var\(--color-/);
    }
  });
});

/* ------------------------------------------------------------------ */
/* הגלריה של המסמך                                                     */
/* ------------------------------------------------------------------ */

describe('הגלריה מהמסמך', () => {
  it('הפריטים והשמות מהמנוע — כולל סגנון מותאם ושמות עבריים', () => {
    const state = toGalleryState(slice({ quickGallery: HEBREW_GALLERY }));
    expect(ids(state)).toEqual(['Normal', 'Heading1', 'Heading2', 'MyStyle']);
    expect(state.items.map((item) => item.label)).toEqual([
      'רגיל',
      'כותרת 1',
      'כותרת 2',
      'סגנון שלי',
    ]);
    expect(state.fromDocument).toBe(true);
  });

  it('שם שהמנוע לא מסר נופל למזהה, ולא לכרטיס ריק', () => {
    const items = toGalleryItems([catalogItem({ id: 'Quote', name: '   ' })]);
    expect(items[0].label).toBe('Quote');
  });

  it('פריט בלי מזהה וכפילות נשמטים', () => {
    const items = toGalleryItems([
      catalogItem({ id: '  ' }),
      catalogItem({ id: 'Normal' }),
      catalogItem({ id: 'Normal', name: 'שוב' }),
    ]);
    expect(items.map((item) => item.id)).toEqual(['Normal']);
  });

  it('סגנון מוסתר אינו מוצג', () => {
    const items = toGalleryItems([
      catalogItem({
        id: 'Hidden',
        visibility: { quickGallery: false, recommended: false, all: true, effectivelyHidden: true },
      }),
      catalogItem({ id: 'Normal' }),
    ]);
    expect(items.map((item) => item.id)).toEqual(['Normal']);
  });

  it('`activeParagraphStyleId` הוא הכרטיס הפעיל', () => {
    const state = toGalleryState(
      slice({ quickGallery: HEBREW_GALLERY, activeParagraphStyleId: 'Heading2' }),
    );
    expect(state.activeId).toBe('Heading2');
  });

  it('בחירה מעורבת — אין כרטיס פעיל', () => {
    const state = toGalleryState(
      slice({
        quickGallery: HEBREW_GALLERY,
        activeParagraphStyleId: 'Heading2',
        mixedSelection: true,
      }),
    );
    expect(state.activeId).toBeNull();
  });

  it('`mixed` במסלול `getActiveParagraphStyle` מתנהג אותו דבר', () => {
    const host: StyleGalleryHost = {
      styles: {
        getQuickGallery: () => HEBREW_GALLERY,
        getActiveParagraphStyle: () => ({
          styleId: null,
          styleName: null,
          mixed: true,
          diagnostics: [],
        }),
      },
    };
    expect(readStyleGallery(host).activeId).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/* ההרשמה — המסלול האמיתי                                              */
/* ------------------------------------------------------------------ */

describe('הרשמה לקטלוג', () => {
  /** `observe` של המנוע: יורה מיד, ואז על כל שינוי. */
  function observableHost(): {
    host: StyleGalleryHost;
    settle: (next: StylesSlice) => void;
    disposed: () => boolean;
  } {
    let current = slice({ status: 'pending', catalogRevision: null });
    const listeners = new Set<(value: StylesSlice) => void>();
    let disposed = false;

    return {
      host: {
        styles: {
          getSnapshot: () => current,
          observe: (listener) => {
            listeners.add(listener);
            listener(current);
            return () => {
              disposed = true;
              listeners.delete(listener);
            };
          },
        },
      },
      settle(next) {
        current = next;
        for (const listener of listeners) listener(next);
      },
      disposed: () => disposed,
    };
  }

  it('הגלריה מתעדכנת כשהקטלוג נפתר אחרי הפתיחה', () => {
    const { host, settle } = observableHost();
    const seen: StyleGalleryState[] = [];
    observeStyleGallery(host, (state) => seen.push(state));

    // הירייה המיידית: הקטלוג עוד לא נפתר, ולכן רשת הביטחון.
    expect(seen).toHaveLength(1);
    expect(ids(seen[0])).toEqual(fallbackIds);
    expect(seen[0].fromDocument).toBe(false);

    settle(slice({ quickGallery: HEBREW_GALLERY, activeParagraphStyleId: 'Normal' }));

    expect(seen).toHaveLength(2);
    expect(ids(seen[1])).toEqual(['Normal', 'Heading1', 'Heading2', 'MyStyle']);
    expect(seen[1].fromDocument).toBe(true);
    expect(seen[1].activeId).toBe('Normal');
  });

  it('ה-disposer של המנוע מוחזר ומשוחרר', () => {
    const { host, disposed } = observableHost();
    const off = observeStyleGallery(host, () => {});
    expect(disposed()).toBe(false);
    off();
    expect(disposed()).toBe(true);
  });

  it('בלי `observe` נשלח המצב הנוכחי, ומוחזר disposer שאין בו כלום', () => {
    const seen: StyleGalleryState[] = [];
    const off = observeStyleGallery(
      { styles: { getQuickGallery: () => HEBREW_GALLERY } },
      (state) => seen.push(state),
    );
    expect(seen).toHaveLength(1);
    expect(seen[0].fromDocument).toBe(true);
    expect(() => off()).not.toThrow();
  });

  it('`observe` שזורק אינו מפיל את פתיחת המסמך', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const seen: StyleGalleryState[] = [];
    const off = observeStyleGallery(
      {
        styles: {
          observe: () => {
            throw new Error('not-ready');
          },
        },
      },
      (state) => seen.push(state),
    );
    warn.mockRestore();

    expect(ids(seen[0])).toEqual(fallbackIds);
    expect(() => off()).not.toThrow();
  });
});

/* ------------------------------------------------------------------ */
/* תצוגה מקדימה                                                        */
/* ------------------------------------------------------------------ */

describe('תצוגה מקדימה', () => {
  it('התפקיד נגזר מהמזהה האנגלי, שאינו מתורגם במסמך עברי', () => {
    expect(styleRole('Heading1')).toBe('heading');
    expect(styleRole('Title')).toBe('heading');
    expect(styleRole('Subtitle')).toBe('subtle');
    expect(styleRole('IntenseQuote')).toBe('subtle');
    expect(styleRole('Normal')).toBe('body');
    expect(styleRole('MyStyle')).toBe('body');
  });

  it('הטיפוגרפיה מהמנוע, והצבע מהתפקיד — כדי שמצב כהה יישאר קריא', () => {
    const style = previewStyleFor(
      catalogItem({
        id: 'Heading1',
        name: 'כותרת 1',
        preview: {
          available: true,
          // צבע הסגנון במסמך. ב-Word ברירת המחדל היא כחול כהה, ועל משטח כהה
          // הוא בלתי קריא — ולכן אינו עובר.
          css: { fontWeight: '600', fontFamily: 'Cambria', color: '#2e74b5', margin: '24pt 0' },
        },
      }),
    );

    expect(style.fontWeight).toBe('600');
    expect(style.fontFamily).toBe('Cambria');
    expect(style.color).toBe('var(--color-primary)');
    expect(style.margin).toBeUndefined();
  });

  it('`available: false` — התפקיד לבדו', () => {
    const style = previewStyleFor(
      catalogItem({
        id: 'Subtitle',
        preview: { available: false, unsupportedReason: 'not-resolved' },
      }),
    );
    expect(style.fontStyle).toBe('italic');
    expect(style.color).toBe('var(--color-on-surface-variant)');
  });

  it('אין אף צבע קשיח בשום פריט שהגלריה מייצרת', () => {
    const items = toGalleryItems([
      ...HEBREW_GALLERY,
      catalogItem({
        id: 'Title',
        preview: { available: true, css: { color: 'rgb(31, 78, 120)', fontSize: '32pt' } },
      }),
    ]);
    for (const item of items) {
      expect(JSON.stringify(item.previewStyle)).not.toMatch(/#[0-9a-f]{3,8}|rgb|hsl/i);
    }
  });

  it('גודל הכותרת מוקטן לגבולות הכרטיס', () => {
    expect(clampPreviewFontSize('32pt')).toBe('16px');
    expect(clampPreviewFontSize('16pt')).toBe('16px');
    expect(clampPreviewFontSize('8px')).toBe('11px');
    expect(clampPreviewFontSize('1em')).toBe('13px');
    expect(clampPreviewFontSize(14)).toBe('14px');
  });

  it('גודל שאינו נקרא אינו נכתב', () => {
    expect(clampPreviewFontSize(undefined)).toBeUndefined();
    expect(clampPreviewFontSize('inherit')).toBeUndefined();
    expect(clampPreviewFontSize('0px')).toBeUndefined();
  });

  it('כרטיס גוף מציג „AaBbCc”, וכרטיס כותרת את שם הסגנון — כמו ב-Word', () => {
    const items = toGalleryItems(HEBREW_GALLERY);
    expect(items.find((item) => item.id === 'Normal')?.previewText).toBe('AaBbCc');
    expect(items.find((item) => item.id === 'Heading1')?.previewText).toBe('כותרת 1');
  });
});
