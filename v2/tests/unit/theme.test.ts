/**
 * ולידציית העיצוב של אוצריא פוסלת צבע מקודד ב-CSS ודורשת var(--color-*).
 * המשמעות היא שכל צבע בממשק תלוי בכך שהמיפוי כאן נכון — ושערך חסר לא מוחק
 * את ברירת המחדל.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import type { ThemePayload } from '../../src/types/otzaria_plugin';
import { applyTheme, hexToRgba } from '../../src/host/theme';

function cssVar(name: string): string {
  return document.documentElement.style.getPropertyValue(name);
}

const FULL: ThemePayload = {
  mode: 'dark',
  colorScheme: {
    primary: '#1565C0',
    onPrimary: '#ffffff',
    secondary: '#6750A4',
    onSecondary: '#ffffff',
    surface: '#101014',
    onSurface: '#e6e6e6',
    onSurfaceVariant: '#c9c5d0',
    surfaceContainerHigh: '#2b2930',
    surfaceContainerHighest: '#36343b',
    outline: '#938f99',
    error: '#ffb4ab',
    onError: '#690005',
  },
  typography: {
    fontFamily: 'FrankRuhlCLM',
    fontSize: 22,
    lineHeight: 1.7,
    commentatorsFontFamily: 'Shofar',
    commentatorsFontSize: 16,
  },
} as ThemePayload;

beforeEach(() => {
  document.documentElement.removeAttribute('style');
  delete document.documentElement.dataset.theme;
  document.body.className = '';
});

describe('applyTheme', () => {
  it('ממפה את הצבעים לשמות שמדריך העיצוב מחייב', () => {
    applyTheme(FULL);

    expect(cssVar('--color-primary')).toBe('#1565C0');
    expect(cssVar('--color-surface-container-high')).toBe('#2b2930');
    expect(cssVar('--color-surface-container-highest')).toBe('#36343b');
    expect(cssVar('--color-on-surface-variant')).toBe('#c9c5d0');
    expect(cssVar('--color-outline')).toBe('#938f99');
  });

  it('מגדיר גופן, גודל ורווח שורות מהטיפוגרפיה', () => {
    applyTheme(FULL);

    expect(cssVar('--font-main')).toContain('FrankRuhlCLM');
    expect(cssVar('--font-size-base')).toBe('22px');
    expect(cssVar('--line-height')).toBe('1.7');
  });

  it('גוזר את גוני ה-subtle מהצבעים', () => {
    applyTheme(FULL);

    expect(cssVar('--color-primary-subtle')).toBe('rgba(21, 101, 192, 0.12)');
    expect(cssVar('--color-secondary-subtle')).toBe('rgba(103, 80, 164, 0.12)');
  });

  it('מסמן מצב כהה על ה-root ועל ה-body', () => {
    applyTheme(FULL);

    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(document.body.classList.contains('dark-mode')).toBe(true);

    applyTheme({ ...FULL, mode: 'light' } as ThemePayload);

    expect(document.body.classList.contains('dark-mode')).toBe(false);
  });

  it('נופל ל-highest כשהגרסה אינה מחזירה surfaceContainerHigh', () => {
    const { surfaceContainerHigh: _omitted, ...rest } = FULL.colorScheme;

    applyTheme({ ...FULL, colorScheme: rest } as ThemePayload);

    expect(cssVar('--color-surface-container-high')).toBe('#36343b');
  });

  it('ערך חסר אינו מוחק את ברירת המחדל', () => {
    applyTheme({ mode: 'light', colorScheme: {}, typography: {} } as unknown as ThemePayload);

    expect(cssVar('--color-primary')).toBe('');
    expect(cssVar('--font-size-base')).toBe('');
  });
});

describe('hexToRgba', () => {
  it('ממיר #rrggbb', () => {
    expect(hexToRgba('#ff8000', 0.5)).toBe('rgba(255, 128, 0, 0.5)');
  });

  it('ממיר #rgb', () => {
    expect(hexToRgba('#f80', 0.12)).toBe('rgba(255, 136, 0, 0.12)');
  });

  it('מחזיר null על ערך שאינו hex', () => {
    expect(hexToRgba('rebeccapurple', 0.12)).toBeNull();
    expect(hexToRgba('#12345', 0.12)).toBeNull();
  });
});
