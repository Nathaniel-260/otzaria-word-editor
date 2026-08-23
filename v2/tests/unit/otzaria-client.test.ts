/**
 * plugin.boot נורה פעם אחת ואוצריא אינה משחזרת אותו: אין getBootInfo, ו-`on`
 * של ה-SDK הוא window.addEventListener בלי replay. לכן ההרשמה חייבת לקרות בזמן
 * טעינת המודול — לפני כל await בתוסף. הבדיקות כאן מקבעות בדיוק את ההתנהגות
 * הזאת, כי הרגרסיה שלה היא מסך שנשאר תלוי על "ממתין לאוצריא".
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import type { BootPayload } from '../../src/types/otzaria_plugin';

const BOOT = { plugin: { id: 'test', version: '1' } } as unknown as BootPayload;

async function freshClient(): Promise<typeof import('../../src/host/otzaria-client')> {
  vi.resetModules();
  return import('../../src/host/otzaria-client');
}

afterEach(() => {
  vi.useRealTimers();
  delete (window as Partial<Window>).Otzaria;
});

describe('waitForBoot', () => {
  it('מחזירה את ה-payload גם כשהאירוע נורה לפני ההמתנה', async () => {
    const client = await freshClient();

    window.dispatchEvent(new CustomEvent('plugin.boot', { detail: BOOT }));

    await expect(client.waitForBoot()).resolves.toBe(BOOT);
  });

  it('מחזירה את אותו payload לכל קורא', async () => {
    const client = await freshClient();
    window.dispatchEvent(new CustomEvent('plugin.boot', { detail: BOOT }));

    const [first, second] = await Promise.all([client.waitForBoot(), client.waitForBoot()]);

    expect(first).toBe(BOOT);
    expect(second).toBe(BOOT);
  });

  it('מתעלמת מאירוע boot שני', async () => {
    const client = await freshClient();
    window.dispatchEvent(new CustomEvent('plugin.boot', { detail: BOOT }));
    window.dispatchEvent(new CustomEvent('plugin.boot', { detail: { plugin: { id: 'other' } } }));

    await expect(client.waitForBoot()).resolves.toBe(BOOT);
  });

  it('נכשלת בזמן קצוב במקום להישאר תלויה', async () => {
    vi.useFakeTimers();
    const client = await freshClient();

    const pending = client.waitForBoot(100);
    const assertion = expect(pending).rejects.toThrow('אוצריא לא סיימה לאתחל את התוסף');
    await vi.advanceTimersByTimeAsync(100);

    await assertion;
  });

  it('מאזין שנרשם אחרי הירייה מפספס — הסיבה שה-latch קיים', async () => {
    await freshClient();
    window.dispatchEvent(new CustomEvent('plugin.boot', { detail: BOOT }));

    const late = vi.fn();
    window.addEventListener('plugin.boot', late);

    expect(late).not.toHaveBeenCalled();
  });
});

describe('call', () => {
  it('זורקת הודעה בעברית כשה-SDK אינו קיים', async () => {
    const client = await freshClient();

    await expect(client.call('app.getInfo')).rejects.toThrow('ה-SDK של אוצריא אינו זמין');
    expect(client.isAvailable()).toBe(false);
  });

  it('מחזירה את data כשהקריאה הצליחה', async () => {
    const client = await freshClient();
    window.Otzaria = {
      call: vi.fn(async () => ({ success: true, data: { version: '0.9.96' }, error: null })),
    } as never;

    await expect(client.call('app.getInfo')).resolves.toEqual({ version: '0.9.96' });
  });

  it('מתרגמת כשל של ה-Host לשגיאה עם ההודעה שלו', async () => {
    const client = await freshClient();
    window.Otzaria = {
      call: vi.fn(async () => ({
        success: false,
        data: null,
        error: { code: 'error.denied', message: 'ההרשאה נדחתה' },
      })),
    } as never;

    await expect(client.call('fs.pickUserFile')).rejects.toThrow('ההרשאה נדחתה');
  });

  it('tryCall מחזירה null במקום לזרוק', async () => {
    const client = await freshClient();

    await expect(client.tryCall('ui.showMessage')).resolves.toBeNull();
  });
});

describe('on', () => {
  it('מחזירה ביטול שקורא ל-off עם אותה הפניה', async () => {
    const client = await freshClient();
    const off = vi.fn();
    const onFn = vi.fn();
    window.Otzaria = { on: onFn, off } as never;

    const listener = vi.fn();
    const stop = client.on('theme.changed', listener);
    stop();

    expect(onFn).toHaveBeenCalledWith('theme.changed', listener);
    expect(off).toHaveBeenCalledWith('theme.changed', listener);
  });
});
