/**
 * הרשומה שנשמרת בין הפעלות, ושתי ההחלטות שנגזרות ממנה.
 *
 * שתי השאלות שהקובץ הזה שומר עליהן, ושתיהן שאלות על אובדן עבודה:
 *
 * 1. **על איזה מסמך מוחל מה שנזכר.** רשומה שייכת למסמך אחד; אם ה-token לא
 *    נפתר ונפתח מסמך אחר, הסמן והזום של הראשון אסור להם לגעת בשני.
 * 2. **מתי טיוטה נפתחת בשקט ומתי שואלים.** טיוטה נכתבת מעל מה שבדיסק, ולכן
 *    היא בטוחה רק כשהקובץ לא זז מתחתיה.
 */
import { describe, it, expect } from 'vitest';
import {
  DRAFT_PATH,
  SESSION_VERSION,
  decideDraftRecovery,
  defaultView,
  documentViewFor,
  emptySession,
  normalizeSession,
  sessionFromLastDocument,
  type SessionDraft,
  type SessionState,
} from '../../src/sessions/session-state';

const anchor = { start: { blockId: 'b7', ordinal: 4, offset: 12 }, end: null };

function session(patch: Partial<SessionState> = {}): SessionState {
  return { ...emptySession(), ...patch };
}

describe('normalizeSession', () => {
  it('קורא רשומה מלאה', () => {
    const stored = session({
      document: { token: 'tok', name: 'א.docx', writable: true },
      view: { zoom: 150, focusMode: true, ribbonTab: 'references', ribbonCollapsed: true },
      caret: anchor,
      draft: { path: DRAFT_PATH, savedAt: 17, documentToken: 'tok', sourceSize: 900 },
    });

    expect(normalizeSession(JSON.parse(JSON.stringify(stored)))).toEqual(stored);
  });

  it('רשומה מגרסה אחרת נזרקת ואינה מנוסה בכל זאת', () => {
    // שדה ששינה משמעות הוא בדיוק המקום שבו שחזור שקט הופך לנזק שקט.
    expect(normalizeSession({ ...emptySession(), version: SESSION_VERSION + 1 })).toBeNull();
    expect(normalizeSession(null)).toBeNull();
    expect(normalizeSession('לא אובייקט')).toBeNull();
  });

  it('שדה פגום מתאפס ואינו פוסל את שאר הרשומה', () => {
    // חמישה דברים בלתי תלויים ברשומה אחת: לשונית פגומה אינה סיבה לאבד את
    // המסמך ואת הטיוטה.
    const read = normalizeSession({
      version: SESSION_VERSION,
      document: { token: 'tok' },
      view: { zoom: -4, focusMode: 'כן', ribbonTab: 42 },
      caret: { start: { blockId: '', offset: 3 } },
      draft: { savedAt: 5 },
    });

    expect(read).toEqual({
      version: SESSION_VERSION,
      document: { token: 'tok', name: 'מסמך', writable: false },
      view: defaultView(),
      caret: null,
      draft: null,
    });
  });

  it('היסט וסדר שליליים נקראים כערכים חוקיים ולא כפגם', () => {
    const read = normalizeSession({
      ...emptySession(),
      caret: { start: { blockId: 'b1', ordinal: -2, offset: -9 }, end: null },
    });

    // סדר שלילי אינו מקום בסדר המסמך, ולכן הוא „לא ידוע”; היסט שלילי נקצץ
    // לתחילת הפסקה, שהוא המקום היחיד שאפשר לפרש אותו בו.
    expect(read?.caret).toEqual({ start: { blockId: 'b1', ordinal: null, offset: 0 }, end: null });
  });
});

describe('sessionFromLastDocument', () => {
  it('משתמש שמעדכן מגרסה קודמת אינו מאבד את המסמך שעבד עליו', () => {
    const migrated = sessionFromLastDocument({ token: 'tok', name: 'ב.docx', writable: false });

    expect(migrated?.document).toEqual({ token: 'tok', name: 'ב.docx', writable: false });
    expect(migrated?.caret, 'אין מה לדעת על הסמן מגרסה שלא שמרה אותו').toBeNull();
  });

  it('אין מסמך קודם — אין רשומה', () => {
    expect(sessionFromLastDocument(null)).toBeNull();
  });
});

describe('documentViewFor', () => {
  const stored = session({
    document: { token: 'tok', name: 'א.docx', writable: true },
    view: { zoom: 150, focusMode: true, ribbonTab: 'view', ribbonCollapsed: false },
    caret: anchor,
  });

  it('אותו מסמך מקבל את הזום ואת הסמן', () => {
    expect(documentViewFor(stored, 'tok')).toEqual({ zoom: 150, caret: anchor });
  });

  it('מסמך אחר אינו מקבל דבר', () => {
    // התרחיש: ה-token לא נפתר, נפתח מסמך חדש, ועליו הייתה מוחלת קפיצה
    // שרירותית לאמצע מסמך אחר.
    expect(documentViewFor(stored, 'other')).toEqual({ zoom: null, caret: null });
    expect(documentViewFor(stored, null)).toEqual({ zoom: null, caret: null });
    expect(documentViewFor(null, 'tok')).toEqual({ zoom: null, caret: null });
  });

  it('מסמך חדש שנזכר מקבל את הסמן שלו', () => {
    // מסמך בלי קובץ הוא `null` בשני הצדדים, וזו התאמה ולא כשל.
    const newDoc = session({ caret: anchor, view: { ...defaultView(), zoom: 90 } });
    expect(documentViewFor(newDoc, null)).toEqual({ zoom: 90, caret: anchor });
  });
});

describe('decideDraftRecovery', () => {
  const draft: SessionDraft = {
    path: DRAFT_PATH,
    savedAt: 100,
    documentToken: 'tok',
    sourceSize: 5_000,
  };

  it('אותו מסמך, אותו גודל בדיסק — משחזרים', () => {
    expect(decideDraftRecovery({ draft, openingToken: 'tok', diskSize: 5_000 })).toEqual({
      action: 'restore',
    });
  });

  it('טיוטה של מסמך אחר אינה מוחלת', () => {
    // התרחיש היחיד שבו התכונה יכולה למחוק עבודה: תוכן של מסמך אחד שנפתח מעל
    // מסמך אחר, ואז נשמר לקובץ שלו.
    expect(decideDraftRecovery({ draft, openingToken: 'other', diskSize: 5_000 })).toEqual({
      action: 'discard',
      reason: 'other-document',
    });
    expect(decideDraftRecovery({ draft, openingToken: null, diskSize: null })).toEqual({
      action: 'discard',
      reason: 'other-document',
    });
  });

  it('אין טיוטה — אין מה לשחזר', () => {
    expect(decideDraftRecovery({ draft: null, openingToken: 'tok', diskSize: 1 })).toEqual({
      action: 'discard',
      reason: 'none',
    });
  });

  it('הקובץ שינה את גודלו מאז — שואלים ולא מכריעים', () => {
    expect(decideDraftRecovery({ draft, openingToken: 'tok', diskSize: 7_000 })).toEqual({
      action: 'ask',
    });
  });

  it('גודל שלא דווח אינו „השתנה” ואינו מייצר שאלה', () => {
    // אוצריא מחזירה 0 כשאין לה גודל. שאלה על סמך לא-מידע היא הטרדה.
    expect(decideDraftRecovery({ draft, openingToken: 'tok', diskSize: 0 })).toEqual({
      action: 'restore',
    });
    expect(decideDraftRecovery({ draft, openingToken: 'tok', diskSize: null })).toEqual({
      action: 'restore',
    });
    expect(
      decideDraftRecovery({
        draft: { ...draft, sourceSize: null },
        openingToken: 'tok',
        diskSize: 9_999,
      }),
    ).toEqual({ action: 'restore' });
  });

  it('מסמך חדש שנשמרה ממנו טיוטה משוחזר גם בלי קובץ', () => {
    // זה המסלול שבו אין שום דבר אחר לחזור אליו: אין token, אין קובץ, ורק
    // הטיוטה מחזיקה את מה שנכתב.
    const unsaved: SessionDraft = { ...draft, documentToken: null, sourceSize: null };
    expect(decideDraftRecovery({ draft: unsaved, openingToken: null, diskSize: null })).toEqual({
      action: 'restore',
    });
  });
});
