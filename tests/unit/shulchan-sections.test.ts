/**
 * „אחידות עמוד וטורים” — קיבוץ הפרופילים והחלת פרופיל נבחר על כל המקטעים.
 */
import { describe, expect, it } from 'vitest';
import {
  applyColumnsProfile,
  applyPageProfile,
  columnsProfileLabel,
  pageProfileLabel,
  readColumnsProfiles,
  readPageProfiles,
} from '../../src/engine/shulchan/sections-uniform';
import { fakeShulchanHost } from './shulchan-fake';

const PAGE_A = { pageSetup: { width: 8.27, height: 11.69 }, margins: { top: 1, right: 1, bottom: 1, left: 1 } };
const PAGE_B = { pageSetup: { width: 8.5, height: 11 }, margins: { top: 0.5, right: 1, bottom: 1, left: 1 } };

describe('shulchan/sections-uniform — עמוד', () => {
  it('מקבץ מקטעים זהים לפרופיל אחד', async () => {
    const { host } = fakeShulchanHost({
      sections: [
        { address: 's1', ...PAGE_A },
        { address: 's2', ...PAGE_A },
        { address: 's3', ...PAGE_B },
      ],
    });
    const result = await readPageProfiles(host);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.groups).toHaveLength(2);
    expect(result.groups[0]).toMatchObject({ sections: 2 });
  });

  it('החלת פרופיל כותבת גודל ושוליים לכל מקטע', async () => {
    const { host, calls } = fakeShulchanHost({
      sections: [
        { address: 's1', ...PAGE_A },
        { address: 's2', ...PAGE_B },
      ],
    });
    const outcome = await applyPageProfile(host, {
      widthIn: 8.27,
      heightIn: 11.69,
      topIn: 1,
      rightIn: 1,
      bottomIn: 1,
      leftIn: 1,
    });
    expect(outcome.ok).toBe(true);
    expect(calls.setPageSetup).toHaveLength(2);
    expect(calls.setPageMargins[1]).toMatchObject({ target: 's2', top: 1 });
  });

  it('תווית הפרופיל בס"מ, בנוסח המקור', () => {
    const label = pageProfileLabel({ widthIn: 8.27, heightIn: 11.69, topIn: 1, rightIn: 1, bottomIn: 1, leftIn: 1 });
    expect(label).toContain('אורך: 29.69 ס"מ');
    expect(label).toContain('שמאליים: 2.54 ס"מ');
  });
});

describe('shulchan/sections-uniform — טורים', () => {
  it('רק מקטעים מרובי-טורים נכנסים לקיבוץ', async () => {
    const { host } = fakeShulchanHost({
      sections: [
        { address: 's1', columns: { count: 1 } },
        { address: 's2', columns: { count: 2, gap: 0.2, equalWidth: true } },
        { address: 's3', columns: { count: 2, gap: 0.4, equalWidth: false } },
      ],
    });
    const result = await readColumnsProfiles(host);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.groups).toHaveLength(2);
    expect(columnsProfileLabel(result.groups[1]!.profile)).toContain('טורים לא שווים');
  });

  it('החלת פרופיל טורים מדלגת על מקטעי טור-יחיד', async () => {
    const { host, calls } = fakeShulchanHost({
      sections: [
        { address: 's1', columns: { count: 1 } },
        { address: 's2', columns: { count: 2, gap: 0.4, equalWidth: false } },
      ],
    });
    const outcome = await applyColumnsProfile(host, { count: 2, gapIn: 0.2, equalWidth: true });
    expect(outcome.ok).toBe(true);
    expect(calls.setColumns).toEqual([
      { target: 's2', count: 2, gap: 0.2, equalWidth: true },
    ]);
  });

  it('מסמך בלי sections API — כשל סגור', async () => {
    const { host } = fakeShulchanHost({});
    const result = await readPageProfiles(host);
    expect(result.ok).toBe(false);
  });
});
