/**
 * כל הבדיקות כאן נגזרות מכלל אחד: מסמך שלא נשמר בוודאות נשאר מלוכלך. הרגרסיה
 * של הכלל הזה היא עבודה שנעלמת — משתמש שרואה „נשמר”, סוגר, ומגלה שהקובץ
 * בגרסה קודמת.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  AUTOSAVE_DELAY_MS,
  createSaveCoordinator,
  type SaveCommitInput,
  type SaveCommitOutput,
  type SaveCoordinator,
  type SaveSnapshot,
} from '../../src/sessions/save-coordinator';

interface Harness {
  coordinator: SaveCoordinator;
  commits: SaveCommitInput[];
  uploads: Array<{ url: string; size: number }>;
  states: SaveSnapshot[];
  exportCount: () => number;
  /** משנה את מה שהייצוא הבא יעשה. */
  onExport: (fn: () => Promise<Blob> | Blob) => void;
  onCommit: (fn: (input: SaveCommitInput) => Promise<SaveCommitOutput>) => void;
  onUpload: (fn: (url: string, blob: Blob) => Promise<void>) => void;
  onBeginWrite: (fn: (size: number) => Promise<{ writeToken: string; uploadUrl: string }>) => void;
}

function harness(): Harness {
  const commits: SaveCommitInput[] = [];
  const uploads: Array<{ url: string; size: number }> = [];
  const states: SaveSnapshot[] = [];
  let exports = 0;
  let ticket = 0;

  let exportImpl: () => Promise<Blob> | Blob = () => new Blob(['docx']);
  let commitImpl: (input: SaveCommitInput) => Promise<SaveCommitOutput> = async (input) => ({
    cancelled: false,
    token: input.targetToken ?? 'token-new',
    name: 'חידושים.docx',
  });
  let uploadImpl: (url: string, blob: Blob) => Promise<void> = async () => {};
  let beginImpl: (size: number) => Promise<{ writeToken: string; uploadUrl: string }> = async () => {
    ticket += 1;
    return { writeToken: `w${ticket}`, uploadUrl: `http://127.0.0.1/w/w${ticket}` };
  };

  const coordinator = createSaveCoordinator({
    exportDocument: async () => {
      exports += 1;
      return exportImpl();
    },
    beginWrite: (size) => beginImpl(size),
    upload: async (url, blob) => {
      uploads.push({ url, size: blob.size });
      await uploadImpl(url, blob);
    },
    commit: async (input) => {
      commits.push({ ...input });
      return commitImpl(input);
    },
    onStateChange: (snapshot) => states.push(snapshot),
  });

  return {
    coordinator,
    commits,
    uploads,
    states,
    exportCount: () => exports,
    onExport: (fn) => {
      exportImpl = fn;
    },
    onCommit: (fn) => {
      commitImpl = fn;
    },
    onUpload: (fn) => {
      uploadImpl = fn;
    },
    onBeginWrite: (fn) => {
      beginImpl = fn;
    },
  };
}

/**
 * מריק microtasks. הסבב מגיע ל-upload רק אחרי ה-await של הייצוא, ולכן מיד
 * אחרי saveNow ה-hook עוד לא נקרא.
 */
async function flush(): Promise<void> {
  for (let i = 0; i < 20; i += 1) await Promise.resolve();
}

afterEach(() => {
  vi.useRealTimers();
});

describe('saveNow', () => {
  it('מסמך נקי אינו נשמר', async () => {
    const h = harness();

    await expect(h.coordinator.saveNow()).resolves.toEqual({ status: 'clean' });
    expect(h.exportCount()).toBe(0);
  });

  it('שמירה ראשונה בלי יעד עוברת דרך „שמור בשם” ומאמצת את ה-token', async () => {
    const h = harness();
    h.coordinator.markDirty();

    const outcome = await h.coordinator.saveNow();

    expect(outcome).toEqual({ status: 'saved', token: 'token-new', name: 'חידושים.docx' });
    // בלי targetToken — כלומר ה-commit פותח דיאלוג.
    expect(h.commits[0].targetToken).toBeUndefined();
    expect(h.coordinator.snapshot).toMatchObject({
      isDirty: false,
      state: 'idle',
      targetToken: 'token-new',
    });
  });

  it('שמירה חוזרת כותבת לאותו יעד בלי דיאלוג', async () => {
    const h = harness();
    h.coordinator.markDirty();
    await h.coordinator.saveNow();

    h.coordinator.markDirty();
    await h.coordinator.saveNow();

    expect(h.commits).toHaveLength(2);
    expect(h.commits[1].targetToken).toBe('token-new');
  });

  it('„שמור בשם” על מסמך נקי מייצא ופותח דיאלוג', async () => {
    const h = harness();
    h.coordinator.adoptTarget({ token: 'tok', name: 'a.docx' });

    const outcome = await h.coordinator.saveNow({ forceSaveAs: true });

    expect(outcome.status).toBe('saved');
    expect(h.exportCount()).toBe(1);
    expect(h.commits[0].targetToken).toBeUndefined();
  });

  it('ביטול „שמור בשם” משאיר את המסמך מלוכלך ובלי שגיאה', async () => {
    const h = harness();
    h.coordinator.markDirty();
    h.onCommit(async () => ({ cancelled: true }));

    const outcome = await h.coordinator.saveNow();

    expect(outcome).toEqual({ status: 'cancelled' });
    expect(h.coordinator.snapshot).toMatchObject({
      isDirty: true,
      state: 'idle',
      lastError: null,
      targetToken: null,
    });
  });
});

describe('כשלים', () => {
  it('כשל ייצוא משאיר מלוכלך ואינו מעלה כלום', async () => {
    const h = harness();
    h.coordinator.markDirty();
    h.onExport(() => Promise.reject(new Error('המנוע קרס')));

    const outcome = await h.coordinator.saveNow();

    expect(outcome.status).toBe('failed');
    expect(outcome.status === 'failed' && outcome.message).toContain('המנוע קרס');
    expect(h.uploads).toEqual([]);
    expect(h.coordinator.snapshot).toMatchObject({ isDirty: true, state: 'error' });
  });

  it('כשל העלאה משאיר מלוכלך ואינו עושה commit', async () => {
    const h = harness();
    h.coordinator.markDirty();
    h.onUpload(() => Promise.reject(new Error('413')));

    const outcome = await h.coordinator.saveNow();

    expect(outcome.status).toBe('failed');
    expect(h.commits).toEqual([]);
    expect(h.coordinator.snapshot).toMatchObject({ isDirty: true, state: 'error' });
  });

  it('כשל commit משאיר מלוכלך ואינו מאמץ יעד', async () => {
    const h = harness();
    h.coordinator.markDirty();
    h.onCommit(() => Promise.reject(new Error('error.permission_denied')));

    const outcome = await h.coordinator.saveNow();

    expect(outcome.status).toBe('failed');
    expect(h.coordinator.snapshot).toMatchObject({ isDirty: true, targetToken: null });
  });

  it('commit שחוזר בלי token נחשב כשל', async () => {
    const h = harness();
    h.coordinator.markDirty();
    h.onCommit(async () => ({ cancelled: false }));

    const outcome = await h.coordinator.saveNow();

    expect(outcome.status).toBe('failed');
    expect(h.coordinator.snapshot).toMatchObject({ isDirty: true, targetToken: null });
  });

  it('נסיון חוזר אחרי כשל מצליח ומנקה את השגיאה', async () => {
    const h = harness();
    h.coordinator.markDirty();
    h.onUpload(() => Promise.reject(new Error('נפל')));
    await h.coordinator.saveNow();

    h.onUpload(async () => {});
    const outcome = await h.coordinator.saveNow();

    expect(outcome.status).toBe('saved');
    expect(h.coordinator.snapshot).toMatchObject({
      isDirty: false,
      state: 'idle',
      lastError: null,
    });
  });
});

describe('שמירות מתחרות', () => {
  it('שתי קריאות במקביל אינן מריצות שני סבבים', async () => {
    const h = harness();
    h.coordinator.markDirty();
    let release!: () => void;
    h.onUpload(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );

    const first = h.coordinator.saveNow();
    const second = h.coordinator.saveNow();
    expect(second).toBe(first);

    await flush();
    release();
    await first;

    expect(h.exportCount()).toBe(1);
    expect(h.commits).toHaveLength(1);
  });

  it('עריכה בזמן שמירה מריצה סבב נוסף ואינה מסומנת כשמורה', async () => {
    const h = harness();
    h.coordinator.markDirty();
    let release!: () => void;
    h.onUpload(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );

    const saving = h.coordinator.saveNow();
    await flush();
    // המשתמש הקליד בזמן שהסבב הראשון באוויר.
    h.coordinator.markDirty();
    h.onUpload(async () => {});
    release();
    const outcome = await saving;

    expect(outcome.status).toBe('saved');
    // שני סבבים: הראשון לא הכיל את ההקלדה, השני כן.
    expect(h.exportCount()).toBe(2);
    expect(h.coordinator.snapshot.isDirty).toBe(false);
    // הסבב השני כותב ליעד שהתקבל בראשון — בלי דיאלוג נוסף.
    expect(h.commits[1].targetToken).toBe('token-new');
  });

  it('עריכה בזמן שמירה שנכשלה משאירה מלוכלך בלי סבב נוסף', async () => {
    const h = harness();
    h.coordinator.markDirty();
    let release!: (error: Error) => void;
    h.onUpload(
      () =>
        new Promise<void>((_, reject) => {
          release = reject;
        }),
    );

    const saving = h.coordinator.saveNow();
    await flush();
    h.coordinator.markDirty();
    release(new Error('נפל'));
    const outcome = await saving;

    expect(outcome.status).toBe('failed');
    expect(h.exportCount()).toBe(1);
    expect(h.coordinator.snapshot.isDirty).toBe(true);
  });
});

describe('autosave', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('אינו רץ בלי יעד כתיבה', async () => {
    const h = harness();

    h.coordinator.markDirty();
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS * 2);

    // בלי יעד, autosave היה פותח „שמור בשם” מעצמו.
    expect(h.exportCount()).toBe(0);
    expect(h.coordinator.snapshot.isDirty).toBe(true);
  });

  it('רץ אחרי debounce כשיש יעד', async () => {
    const h = harness();
    h.coordinator.adoptTarget({ token: 'tok', name: 'a.docx' });

    h.coordinator.markDirty();
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS - 1);
    expect(h.exportCount()).toBe(0);

    await vi.advanceTimersByTimeAsync(1);
    expect(h.exportCount()).toBe(1);
    expect(h.commits[0].targetToken).toBe('tok');
  });

  it('הקלדה רצופה דוחה את ה-autosave ואינה מייצאת בכל הקשה', async () => {
    const h = harness();
    h.coordinator.adoptTarget({ token: 'tok', name: 'a.docx' });

    for (let i = 0; i < 5; i += 1) {
      h.coordinator.markDirty();
      await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS - 100);
    }
    expect(h.exportCount()).toBe(0);

    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS);
    expect(h.exportCount()).toBe(1);
  });

  it('שמירה ידנית מבטלת autosave ממתין', async () => {
    const h = harness();
    h.coordinator.adoptTarget({ token: 'tok', name: 'a.docx' });
    h.coordinator.markDirty();

    await h.coordinator.saveNow();
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS * 2);

    expect(h.exportCount()).toBe(1);
  });

  it('dispose מבטל autosave ממתין', async () => {
    const h = harness();
    h.coordinator.adoptTarget({ token: 'tok', name: 'a.docx' });
    h.coordinator.markDirty();

    h.coordinator.dispose();
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS * 2);

    expect(h.exportCount()).toBe(0);
  });
});

describe('מצב', () => {
  it('מדווח את שלבי השמירה בסדר', async () => {
    const h = harness();
    h.coordinator.markDirty();

    await h.coordinator.saveNow();

    // מכווצים חזרות רצופות: כל publish נוסף (למשל סימון isSaving) אינו שלב.
    const stages = h.states
      .map((s) => s.state)
      .filter((value, index, all) => value !== all[index - 1]);

    expect(stages).toEqual(['idle', 'exporting', 'uploading', 'committing', 'idle']);
  });

  it('reset מנקה dirty, שגיאה ויעד', async () => {
    const h = harness();
    h.coordinator.markDirty();
    h.onExport(() => Promise.reject(new Error('נפל')));
    await h.coordinator.saveNow();

    h.coordinator.reset({ token: 'other', name: 'b.docx' });

    expect(h.coordinator.snapshot).toEqual({
      state: 'idle',
      isDirty: false,
      targetToken: 'other',
      name: 'b.docx',
      lastError: null,
      isSaving: false,
    });
  });

  it('adoptTarget מגדיר יעד בלי לשנות dirty', () => {
    const h = harness();
    h.coordinator.markDirty();

    h.coordinator.adoptTarget({ token: 'tok', name: 'a.docx' });

    expect(h.coordinator.snapshot).toMatchObject({ isDirty: true, targetToken: 'tok' });
  });

  it('מעביר את גודל ה-Blob ל-beginWrite', async () => {
    const h = harness();
    h.coordinator.markDirty();
    h.onExport(() => new Blob(['0123456789']));
    const sizes: number[] = [];
    h.onBeginWrite(async (size) => {
      sizes.push(size);
      return { writeToken: 'w', uploadUrl: 'u' };
    });

    await h.coordinator.saveNow();

    expect(sizes).toEqual([10]);
    expect(h.uploads).toEqual([{ url: 'u', size: 10 }]);
  });
});
describe('מעבר מסמך בזמן שמירה', () => {
  it('סבב של המסמך הקודם אינו מאמץ מחדש את היעד שלו', async () => {
    const h = harness();
    h.coordinator.markDirty();
    let release!: () => void;
    h.onUpload(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );

    // א' נשמר…
    const savingA = h.coordinator.saveNow();
    await flush();
    // …ובאמצע נפתח ב'.
    h.coordinator.reset({ token: 'token-B', name: 'ב.docx' });
    release();

    // התוצאה של א' נזרקת: היא לא נוגעת ביעד, במצב ולא ב-dirty של ב'.
    await expect(savingA).resolves.toEqual({ status: 'stale' });
    expect(h.coordinator.snapshot).toMatchObject({
      targetToken: 'token-B',
      name: 'ב.docx',
      isDirty: false,
      state: 'idle',
    });
  });

  it('השמירה הבאה של המסמך החדש כותבת ליעד שלו, לא לקודם', async () => {
    const h = harness();
    h.coordinator.markDirty();
    let release!: () => void;
    h.onUpload(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );

    const savingA = h.coordinator.saveNow();
    await flush();
    h.coordinator.reset({ token: 'token-B', name: 'ב.docx' });
    h.onUpload(async () => {});
    release();
    await savingA;

    h.coordinator.markDirty();
    await h.coordinator.saveNow();

    // זו הרגרסיה שהבדיקה הזאת מקבעת: בלי ה-epoch, ה-commit של א' היה מאמץ
    // מחדש את token-A, וכאן היינו רואים אותו כיעד.
    expect(h.commits[h.commits.length - 1].targetToken).toBe('token-B');
  });

  it('כשל של סבב שהוחלף אינו מסמן שגיאה על המסמך החדש', async () => {
    const h = harness();
    h.coordinator.markDirty();
    let reject!: (error: Error) => void;
    h.onUpload(
      () =>
        new Promise<void>((_, rej) => {
          reject = rej;
        }),
    );

    const savingA = h.coordinator.saveNow();
    await flush();
    h.coordinator.reset({ token: 'token-B', name: 'ב.docx' });
    reject(new Error('נפל'));

    await expect(savingA).resolves.toEqual({ status: 'stale' });
    expect(h.coordinator.snapshot).toMatchObject({ state: 'idle', lastError: null });
  });

  it('isSaving מדווח נכון, כדי שהמעטפת תחסום מעבר מסמך', async () => {
    const h = harness();
    h.coordinator.markDirty();
    let release!: () => void;
    h.onUpload(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );

    expect(h.coordinator.snapshot.isSaving).toBe(false);
    const saving = h.coordinator.saveNow();
    expect(h.coordinator.snapshot.isSaving).toBe(true);

    await flush();
    release();
    await saving;

    expect(h.coordinator.snapshot.isSaving).toBe(false);
  });
});

describe('„שמור בשם” על מסמך נקי', () => {
  it('ביטול משאיר את המסמך נקי ואת היעד כפי שהיה', async () => {
    const h = harness();
    h.coordinator.adoptTarget({ token: 'tok', name: 'a.docx' });
    h.onCommit(async () => ({ cancelled: true }));

    const outcome = await h.coordinator.saveNow({ forceSaveAs: true });

    expect(outcome).toEqual({ status: 'cancelled' });
    // הרגרסיה: קודם הגדלנו revision כדי לכפות ייצוא, וההגדלה שרדה את הביטול
    // וסימנה מסמך שמור כלא-שמור.
    expect(h.coordinator.snapshot).toMatchObject({
      isDirty: false,
      targetToken: 'tok',
      state: 'idle',
    });
  });

  it('הצלחה אינה משאירה את המסמך מלוכלך', async () => {
    const h = harness();
    h.coordinator.adoptTarget({ token: 'tok', name: 'a.docx' });

    await h.coordinator.saveNow({ forceSaveAs: true });

    expect(h.coordinator.snapshot.isDirty).toBe(false);
  });
});

