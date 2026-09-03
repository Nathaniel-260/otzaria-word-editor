import { describe, it, expect } from 'vitest';
import {
  TELL_ME_ACTIONS,
  DEFAULT_SUGGESTED_IDS,
  searchTellMeActions,
  normalizeSearchTerm,
} from '../../src/ui/shell/tell-me-actions';
import { ICONS } from '../../src/ui/icons/icons';

describe('קטלוג הפקודות Tell Me (tell-me-actions)', () => {
  it('יש פקודות בקטלוג', () => {
    expect(TELL_ME_ACTIONS.length).toBeGreaterThan(30);
  });

  it('כל המזהים ייחודיים', () => {
    const ids = TELL_ME_ACTIONS.map((a) => a.id);
    const uniqueIds = new Set(ids);
    expect(ids.length).toBe(uniqueIds.size);
  });

  it('כל פקודה כוללת כותרת, קטגוריה ואייקון חוקי שקיים ב-ICONS', () => {
    for (const action of TELL_ME_ACTIONS) {
      expect(action.title.trim().length, `action ${action.id} has empty title`).toBeGreaterThan(0);
      expect(action.category.trim().length, `action ${action.id} has empty category`).toBeGreaterThan(0);
      expect(ICONS[action.icon], `action ${action.id} references missing icon '${action.icon}'`).toBeDefined();
    }
  });

  it('לכל פקודה יש יעד ביצוע תקף (command או shellAction או customAction)', () => {
    for (const action of TELL_ME_ACTIONS) {
      const hasTarget = Boolean(action.command || action.shellAction || action.customAction);
      expect(hasTarget, `action ${action.id} has no execution target`).toBe(true);
    }
  });

  it('מזהי הפעולות המוצעות קיימים כולם בקטלוג', () => {
    const actionIds = new Set(TELL_ME_ACTIONS.map((a) => a.id));
    for (const id of DEFAULT_SUGGESTED_IDS) {
      expect(actionIds.has(id), `suggested action id '${id}' not in TELL_ME_ACTIONS`).toBe(true);
    }
  });
});

describe('אלגוריתם חיפוש Tell Me (searchTellMeActions)', () => {
  it('שאילתה ריקה מחזירה את הפעולות המוצעות כברירת מחדל', () => {
    const results = searchTellMeActions('');
    expect(results.length).toBe(DEFAULT_SUGGESTED_IDS.length);
    expect(results.map((r) => r.id)).toEqual(DEFAULT_SUGGESTED_IDS);
  });

  it('חיפוש "הדפסה" מוצא את פעולת ההדפסה ראשונה', () => {
    const results = searchTellMeActions('הדפסה');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].id).toBe('file-print');
  });

  it('חיפוש "טבלה" מוצא את פעולת הוספת טבלה ראשונה', () => {
    const results = searchTellMeActions('טבלה');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].id).toBe('insert-table');
  });

  it('חיפוש "מרכז" מוצא את יישור למרכז', () => {
    const results = searchTellMeActions('מרכז');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].id).toBe('para-align-center');
  });

  it('חיפוש מונח באנגלית (כמו bold) מוצא מודגש דרך מילות מפתח', () => {
    const results = searchTellMeActions('bold');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].id).toBe('font-bold');
  });

  it('חיפוש "שמור" מוצא גם שמירה וגם שמירה בשם', () => {
    const results = searchTellMeActions('שמור');
    const ids = results.map((r) => r.id);
    expect(ids).toContain('file-save');
    expect(ids).toContain('file-save-as');
  });

  it('נרמול טקסט עברי מסיר ניקוד ומסיר רווחים', () => {
    // שָׁמוֹר -> שמור
    const withVowels = '\u05E9\u05B8\u05C1\u05DE\u05D5\u05B9\u05E8';
    expect(normalizeSearchTerm(withVowels)).toBe('שמור');
    expect(normalizeSearchTerm('  Hello World  ')).toBe('hello world');
  });

  it('חיפוש עם ניקוד עברי מוצא את הפקודה המתאימה', () => {
    const withVowels = '\u05D4\u05B7\u05D3\u05B0\u05E4\u05B8\u05BC\u05E1\u05B8\u05D4'; // הַדְפָּסָה
    const results = searchTellMeActions(withVowels);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].id).toBe('file-print');
  });

  it('שאילתה שאינה קיימת מחזירה רשימה ריקה', () => {
    const results = searchTellMeActions('xyznonexistentquery123');
    expect(results).toEqual([]);
  });
});
