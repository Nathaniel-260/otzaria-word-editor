/**
 * ה-URLs של ה-workers הם התלות היחידה שלנו במשהו שה-build מזריק ל-window.
 * הבדיקות מקבעות את שתי ההתנהגויות שאין להן ביטוי בטיפוסים: בלי הזרקה מחזירים
 * undefined (כדי ש-SuperDoc ייפול חזרה ל-worker המובנה שלו במקום לקבל URL
 * ריק), ותפקיד חסר אינו הופך ל-blob ריק.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { engineWorkerUrls, resetEngineWorkerUrlsCache } from '../../src/engine/workers';

beforeEach(() => {
  resetEngineWorkerUrlsCache();
  delete window.__SUPERDOC_WORKER_SOURCES__;
  // jsdom אינו מממש createObjectURL.
  URL.createObjectURL = vi.fn((blob: Blob) => `blob:mock/${blob.size}`);
});

afterEach(() => {
  resetEngineWorkerUrlsCache();
});

describe('engineWorkerUrls', () => {
  it('בלי קוד מוטמע מחזיר undefined', () => {
    expect(engineWorkerUrls()).toBeUndefined();
  });

  it('בונה blob לכל תפקיד שיש לו קוד', () => {
    window.__SUPERDOC_WORKER_SOURCES__ = { document: 'a', reviewIndex: 'bb' };

    expect(engineWorkerUrls()).toEqual({ document: 'blob:mock/1', reviewIndex: 'blob:mock/2' });
  });

  it('מדלג על תפקיד בלי קוד במקום לבנות blob ריק', () => {
    window.__SUPERDOC_WORKER_SOURCES__ = { document: 'a', reviewIndex: '' };

    expect(engineWorkerUrls()).toEqual({ document: 'blob:mock/1' });
  });

  it('מתעלם ממפתחות שאינם תפקיד מוכר', () => {
    window.__SUPERDOC_WORKER_SOURCES__ = { document: 'a', collaboration: 'x' };

    expect(engineWorkerUrls()).toEqual({ document: 'blob:mock/1' });
  });

  it('בונה את ה-URLs פעם אחת בלבד', () => {
    window.__SUPERDOC_WORKER_SOURCES__ = { document: 'a' };

    const first = engineWorkerUrls();

    expect(engineWorkerUrls()).toBe(first);
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
  });
});
