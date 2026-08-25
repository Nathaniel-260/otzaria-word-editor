/**
 * מעגל המיקוד של `F6`.
 *
 * שתי ההכרעות שנבדקות כאן הן אלה שאפשר לשבור בלי שאיש ישים לב: „באיזה אזור
 * הפוקוס עכשיו” (הכלה ב-DOM, ולא השוואת אלמנטים) ו„לאן לקפוץ” (מעגל שמדלג על
 * אזור שאין בו למה למקד — שורת המצב מוסתרת במצב מיקוד).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createFocusRing, type FocusRegion } from '../../src/ui/shortcuts/focus-ring';

let root: HTMLElement;

/** אזור עם פקד אחד בתוכו, כמו הרצועה או שורת המצב. */
function region(id: string, controls = 1): HTMLElement {
  const element = document.createElement('div');
  element.dataset.region = id;
  for (let index = 0; index < controls; index += 1) {
    const button = document.createElement('button');
    button.textContent = `${id}-${index}`;
    element.appendChild(button);
  }
  root.appendChild(element);
  return element;
}

beforeEach(() => {
  root = document.createElement('div');
  document.body.appendChild(root);
});

afterEach(() => {
  root.remove();
});

/** שלושת האזורים בסדר שבו F6 עובר ביניהם. */
function threeRegions(over: Partial<Record<'ribbon' | 'document' | 'statusbar', FocusRegion>> = {}) {
  const ribbon = region('ribbon', 2);
  const documentArea = region('document');
  const statusbar = region('statusbar');

  const regions: FocusRegion[] = [
    { id: 'ribbon', element: () => ribbon, ...over.ribbon },
    { id: 'document', element: () => documentArea, ...over.document },
    { id: 'statusbar', element: () => statusbar, ...over.statusbar },
  ];

  return { ribbon, documentArea, statusbar, ring: createFocusRing({ regions }) };
}

describe('createFocusRing', () => {
  it('F6 עובר לאזור הבא', () => {
    const { ring, ribbon } = threeRegions();
    ribbon.querySelector('button')!.focus();

    expect(ring.move()).toBe('document');
  });

  it('F6 מקיף חזרה — שלוש לחיצות חוזרות למקום', () => {
    const { ring, ribbon } = threeRegions();
    ribbon.querySelector('button')!.focus();

    expect(ring.move()).toBe('document');
    expect(ring.move()).toBe('statusbar');
    expect(ring.move()).toBe('ribbon');
  });

  it('Shift+F6 עובר בכיוון ההפוך', () => {
    const { ring, ribbon } = threeRegions();
    ribbon.querySelector('button')!.focus();

    expect(ring.move('prev')).toBe('statusbar');
    expect(ring.move('prev')).toBe('document');
  });

  it('המיקוד נוחת על הפקד הראשון באזור, לא על האזור עצמו', () => {
    const { ring, ribbon, statusbar } = threeRegions();
    ribbon.querySelector('button')!.focus();

    ring.move();
    ring.move();

    expect(document.activeElement).toBe(statusbar.querySelector('button'));
  });

  it('אזור שאין בו למה למקד מדולג', () => {
    // שורת המצב מוסתרת במצב מיקוד. קפיצה אליה הייתה משאירה את הפוקוס באוויר.
    const empty = document.createElement('div');
    root.appendChild(empty);
    const ribbon = region('ribbon');
    const documentArea = region('document');

    const ring = createFocusRing({
      regions: [
        { id: 'ribbon', element: () => ribbon },
        { id: 'document', element: () => documentArea },
        { id: 'statusbar', element: () => empty },
      ],
    });
    documentArea.querySelector('button')!.focus();

    expect(ring.move()).toBe('ribbon');
  });

  it('אזור שאינו מורכב כרגע מדולג', () => {
    const ribbon = region('ribbon');
    const documentArea = region('document');

    const ring = createFocusRing({
      regions: [
        { id: 'ribbon', element: () => ribbon },
        { id: 'document', element: () => documentArea },
        { id: 'statusbar', element: () => null },
      ],
    });
    documentArea.querySelector('button')!.focus();

    expect(ring.move()).toBe('ribbon');
  });

  it('פוקוס מחוץ לכל האזורים — F6 נכנס לראשון', () => {
    const { ring } = threeRegions();
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    outside.focus();

    expect(ring.move()).toBe('ribbon');
    outside.remove();
  });

  it('current מדווח את האזור שמכיל את הפוקוס', () => {
    const { ring, statusbar } = threeRegions();
    statusbar.querySelector('button')!.focus();

    expect(ring.current()).toBe('statusbar');
  });

  it('current מחזיר null כשהפוקוס מחוץ למעטפת', () => {
    const { ring } = threeRegions();
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    outside.focus();

    expect(ring.current()).toBeNull();
    outside.remove();
  });

  it('המסמך ממוקד דרך המנוע, ולא דרך אלמנט המארח', () => {
    // מיקוד ה-`<main>` מזיז את הפוקוס אבל אינו מחזיר את הסמן לטקסט.
    const focus = vi.fn(() => true);
    const { ring, ribbon } = threeRegions({ document: { id: 'document', element: () => null, focus } });
    ribbon.querySelector('button')!.focus();

    expect(ring.move()).toBe('document');
    expect(focus).toHaveBeenCalledOnce();
  });

  it('כשהמנוע אינו יכול לקבל מיקוד — נופלים לפקד הראשון באזור', () => {
    const documentArea = region('document');
    const ribbon = region('ribbon');
    const ring = createFocusRing({
      regions: [
        { id: 'ribbon', element: () => ribbon },
        { id: 'document', element: () => documentArea, focus: () => false },
      ],
    });
    ribbon.querySelector('button')!.focus();

    expect(ring.move()).toBe('document');
    expect(document.activeElement).toBe(documentArea.querySelector('button'));
  });
});

describe('חזרה למסמך', () => {
  it('Escape מהרצועה מחזיר את הפוקוס למסמך', () => {
    const { ring, ribbon, documentArea } = threeRegions();
    ribbon.querySelector('button')!.focus();

    expect(ring.toDocument()).toBe(true);
    expect(document.activeElement).toBe(documentArea.querySelector('button'));
  });

  it('Escape כשהפוקוס כבר במסמך אינו „מטופל”', () => {
    // אחרת היינו בולעים את ה-Escape של המנוע — סגירת תפריט, ביטול בחירה.
    const { ring, documentArea } = threeRegions();
    documentArea.querySelector('button')!.focus();

    expect(ring.toDocument()).toBe(false);
  });

  it('Escape כשהפוקוס מחוץ למעטפת אינו „מטופל”', () => {
    const { ring } = threeRegions();
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    outside.focus();

    expect(ring.toDocument()).toBe(false);
    outside.remove();
  });

  it('בלי אזור מסמך אין לאן לחזור', () => {
    const ribbon = region('ribbon');
    const ring = createFocusRing({ regions: [{ id: 'ribbon', element: () => ribbon }] });
    ribbon.querySelector('button')!.focus();

    expect(ring.toDocument()).toBe(false);
  });
});

describe('מקרי קצה', () => {
  it('בלי אזורים כלל אין תזוזה', () => {
    const ring = createFocusRing({ regions: [] });

    expect(ring.move()).toBeNull();
    expect(ring.current()).toBeNull();
  });

  it('כשאין באף אזור למה למקד — אין תזוזה', () => {
    const empty = document.createElement('div');
    root.appendChild(empty);
    const ring = createFocusRing({ regions: [{ id: 'ribbon', element: () => empty }] });

    expect(ring.move()).toBeNull();
  });

  it('activeElement מוזרק — הבדיקה אינה תלויה בפוקוס האמיתי של jsdom', () => {
    const ribbon = region('ribbon');
    const documentArea = region('document');
    const ring = createFocusRing({
      regions: [
        { id: 'ribbon', element: () => ribbon },
        { id: 'document', element: () => documentArea },
      ],
      activeElement: () => documentArea.querySelector('button'),
    });

    expect(ring.current()).toBe('document');
  });
});
