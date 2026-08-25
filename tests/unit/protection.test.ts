/**
 * הגנת מסמך (גל 19). הבדיקה: מסלול ההפעלה שולח mode:'readOnly', הביטול
 * נקי, NO_OP הצלחה, וכשלים מתורגמים — הסדר שהמדריך מחייב (ביטול לפני
 * הפעלה) נמדד בדפדפן.
 */
import { describe, expect, it } from 'vitest';
import {
  disableProtection,
  enableReadOnlyProtection,
  readProtectionState,
} from '../../src/engine/protection';

function fakeDoc(options: {
  get?: unknown;
  set?: () => unknown;
  clear?: () => unknown;
} = {}) {
  const calls = new Map<string, unknown[]>();
  const make = (name: string, fallback: () => unknown, override?: () => unknown) => (
    input: unknown,
  ) => {
    calls.set(name, [...(calls.get(name) ?? []), input]);
    return (override ?? fallback)() as never;
  };

  const doc = {
    protection: {
      get: make('get', () => options.get ?? { editingRestriction: { mode: 'none', enforced: false } }),
      setEditingRestriction: make('set', () => ({ success: true }), options.set),
      clearEditingRestriction: make('clear', () => ({ success: true }), options.clear),
    },
  } as never;

  return { doc, calls, host: { activeEditor: { doc } } };
}

describe('enableReadOnlyProtection', () => {
  it('שולח mode readOnly', async () => {
    const { host, calls } = fakeDoc();

    await expect(enableReadOnlyProtection(host)).resolves.toEqual({ ok: true });
    expect(calls.get('set')?.[0]).toEqual({ mode: 'readOnly' });
  });

  it('NO_OP = כבר מוגן = הצלחה', async () => {
    const { host } = fakeDoc({
      set: () => ({ success: false, failure: { code: 'NO_OP' } }),
    });

    await expect(enableReadOnlyProtection(host)).resolves.toEqual({ ok: true });
  });

  it('אין set במנוע — הנוסח של §12', async () => {
    const host = { activeEditor: { doc: {} } };
    const outcome = await enableReadOnlyProtection(host as never);

    expect(outcome).toMatchObject({ ok: false, reason: 'command-unsupported' });
  });
});

describe('disableProtection', () => {
  it('clear נקרא ללא קלט', async () => {
    const { host, calls } = fakeDoc();

    await expect(disableProtection(host)).resolves.toEqual({ ok: true });
    expect(calls.get('clear')).toHaveLength(1);
  });

  it('כשל בביטול מתורגם — ולא נבלע', async () => {
    const { host } = fakeDoc({
      clear: () => ({ success: false, failure: { code: 'DOCUMENT_READONLY', message: 'locked' } }),
    });

    const outcome = await disableProtection(host);

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.reason).toBe('DOCUMENT_READONLY');
  });
});

describe('readProtectionState', () => {
  it('מצב מוחזר מהמנוע מנורמל', async () => {
    const { host } = fakeDoc({
      get: { editingRestriction: { mode: 'readOnly', enforced: true } },
    });

    const state = await readProtectionState(host);

    expect(state).toEqual({ mode: 'readOnly', enforced: true });
  });

  it('get שזורק → null ולא זריקה', async () => {
    const throwingHost = {
      activeEditor: {
        doc: {
          protection: {
            get: () => {
              throw new Error('boom');
            },
          },
        },
      },
    };

    await expect(readProtectionState(throwingHost as never)).resolves.toBeNull();
  });
});
