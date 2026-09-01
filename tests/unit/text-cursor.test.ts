/**
 * סמן-הטקסט של העכבר — ה-I-beam של Word על כל עמודת הטקסט.
 *
 * שתי המשפחות שנבדקות: הגיאומטריה הטהורה (נקודה מול פס הטקסט של כל עמוד,
 * כולל השוליים האפקטיביים), וההחלה על ה-host — שהסמן נדלק רק בתוך הפס,
 * כבה בשוליים וביציאה, ואינו נשאר דלוק אחרי פירוק.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  createTextCursorWatch,
  pointInTextArea,
  type TextBandGeometry,
} from '../../src/engine/text-cursor';
import type { IndexedPageRect } from '../../src/engine/page-ruler';
import type { PageMarginsState } from '../../src/engine/page-setup';

/** עמוד 500×1000 פיקסלים, שוליים של 10% מכל צד. */
const geometry: TextBandGeometry = {
  pageWidthTwips: 1000,
  pageHeightTwips: 1000,
  leftTwips: 100,
  rightTwips: 100,
  effectiveTopTwips: 100,
  effectiveBottomTwips: 100,
};

const page: IndexedPageRect = { pageIndex: 0, leftPx: 0, topPx: 0, widthPx: 500, heightPx: 1000 };

describe('pointInTextArea', () => {
  it('בתוך פס הטקסט — גם בעמוד ריק לגמרי', () => {
    expect(pointInTextArea(250, 500, [page], geometry)).toBe(true);
  });

  it('השוליים אינם פס טקסט — כל ארבעת הצדדים', () => {
    expect(pointInTextArea(25, 500, [page], geometry), 'שוליים שמאליים').toBe(false);
    expect(pointInTextArea(475, 500, [page], geometry), 'שוליים ימניים').toBe(false);
    expect(pointInTextArea(250, 50, [page], geometry), 'שוליים עליונים').toBe(false);
    expect(pointInTextArea(250, 950, [page], geometry), 'שוליים תחתונים').toBe(false);
  });

  it('השוליים האנכיים הם האפקטיביים — כותרת עליונה דוחקת את הפס', () => {
    // כמו הסרגל ומספרי השורות: מה שהמנוע צייר בפועל, לא מה שכתוב במסמך.
    const withHeader = { ...geometry, effectiveTopTwips: 300 };
    expect(pointInTextArea(250, 250, [page], withHeader)).toBe(false);
    expect(pointInTextArea(250, 350, [page], withHeader)).toBe(true);
  });

  it('הרווח שבין עמודים אינו פס טקסט, והעמוד השני כן', () => {
    const second: IndexedPageRect = { ...page, pageIndex: 1, topPx: 1040 };
    expect(pointInTextArea(250, 1020, [page, second], geometry), 'בין העמודים').toBe(false);
    expect(pointInTextArea(250, 1040 + 500, [page, second], geometry), 'בעמוד השני').toBe(true);
  });

  it('בלי עמודים או בלי מידות דף — אין פס', () => {
    expect(pointInTextArea(250, 500, [], geometry)).toBe(false);
    expect(pointInTextArea(250, 500, [page], { ...geometry, pageWidthTwips: 0 })).toBe(false);
  });
});

/** host עם עמוד מצויר אחד, במלבנים קבועים — ה-DOM המזערי שהמעקב צריך. */
function hostWithPage() {
  const host = document.createElement('div');
  const pageEl = document.createElement('div');
  pageEl.setAttribute('data-page-index', '0');
  host.appendChild(pageEl);
  document.body.appendChild(host);

  const box = (left: number, top: number, width: number, height: number) =>
    ({ left, top, right: left + width, bottom: top + height, width, height }) as DOMRect;
  vi.spyOn(host, 'getBoundingClientRect').mockReturnValue(box(0, 0, 600, 1200));
  vi.spyOn(pageEl, 'getBoundingClientRect').mockReturnValue(box(0, 0, 500, 1000));
  return host;
}

const margins: PageMarginsState = {
  pageWidthTwips: 1000,
  pageHeightTwips: 1000,
  leftTwips: 100,
  rightTwips: 100,
  topTwips: 100,
  bottomTwips: 100,
  effectiveTopTwips: 100,
  effectiveBottomTwips: 100,
  direction: 'rtl',
};

function moveTo(host: HTMLElement, clientX: number, clientY: number): void {
  host.dispatchEvent(new MouseEvent('mousemove', { clientX, clientY }));
}

describe('createTextCursorWatch', () => {
  it('הסמן נדלק בתוך פס הטקסט, כבה בשוליים וביציאה', async () => {
    const host = hostWithPage();
    const watch = createTextCursorWatch({ host, readMargins: () => Promise.resolve(margins) });
    watch.refreshNow();
    await new Promise((resolve) => setTimeout(resolve, 0));

    moveTo(host, 250, 500);
    expect(host.style.cursor, 'בתוך הפס').toBe('text');

    moveTo(host, 25, 500);
    expect(host.style.cursor, 'בשוליים').toBe('');

    moveTo(host, 250, 500);
    host.dispatchEvent(new MouseEvent('mouseleave'));
    expect(host.style.cursor, 'העכבר יצא').toBe('');

    watch.dispose();
    host.remove();
  });

  it('בלי שוליים מהמסמך (עוד נטען) — אין סמן, ואין זריקה', async () => {
    const host = hostWithPage();
    const watch = createTextCursorWatch({
      host,
      readMargins: () => Promise.reject(new Error('המנוע עוד לא מוכן')),
    });
    watch.refreshNow();
    await new Promise((resolve) => setTimeout(resolve, 0));

    moveTo(host, 250, 500);
    expect(host.style.cursor).toBe('');

    watch.dispose();
    host.remove();
  });

  it('פירוק בזמן שהסמן דלוק מחזיר את ברירת המחדל', async () => {
    const host = hostWithPage();
    const watch = createTextCursorWatch({ host, readMargins: () => Promise.resolve(margins) });
    watch.refreshNow();
    await new Promise((resolve) => setTimeout(resolve, 0));

    moveTo(host, 250, 500);
    expect(host.style.cursor).toBe('text');

    watch.dispose();
    expect(host.style.cursor, 'מסמך שנסגר אינו משאיר סמן-טקסט').toBe('');

    moveTo(host, 250, 500);
    expect(host.style.cursor, 'אחרי הפירוק המאזין מנותק').toBe('');
    host.remove();
  });

  it('host שאינו קיים — עצם דומם, בלי זריקות', () => {
    const watch = createTextCursorWatch({ host: null, readMargins: () => Promise.resolve(null) });
    watch.refreshNow();
    watch.noteDocumentChanged();
    watch.dispose();
  });
});
