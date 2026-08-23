/**
 * ערכת הנושא של אוצריא → CSS variables.
 *
 * שמות המשתנים והמיפוי הם אלה שמדריך העיצוב של ה-SDK מחייב
 * (docs/plugin-sdk/DESIGN_GUIDE.md): ולידציית העיצוב של הוולידטור פוסלת צבע
 * hex, rgb() או שם צבע באנגלית בתוך CSS, ודורשת var(--color-*). כל צבע ב-UI
 * מגיע מכאן — המשתמש יכול להחליף ערכת צבעים ומצב כהה/בהיר בכל רגע, וה-UI
 * חייב להשתנות איתו בלי רענון.
 */
import type { ColorScheme, ThemePayload } from '../types/otzaria_plugin';

const COLOR_VARS: ReadonlyArray<readonly [string, keyof ColorScheme]> = [
  ['--color-primary', 'primary'],
  ['--color-on-primary', 'onPrimary'],
  ['--color-secondary', 'secondary'],
  ['--color-on-secondary', 'onSecondary'],
  ['--color-secondary-container', 'secondaryContainer'],
  ['--color-on-secondary-container', 'onSecondaryContainer'],
  ['--color-surface', 'surface'],
  ['--color-on-surface', 'onSurface'],
  ['--color-on-surface-variant', 'onSurfaceVariant'],
  ['--color-surface-container-high', 'surfaceContainerHigh'],
  ['--color-surface-container-highest', 'surfaceContainerHighest'],
  ['--color-error', 'error'],
  ['--color-on-error', 'onError'],
  ['--color-outline', 'outline'],
];

/** `#rrggbb` או `#rgb` → rgba(). מחזירה null על כל דבר אחר. */
export function hexToRgba(hex: string, alpha: number): string | null {
  const value = hex.trim().replace(/^#/, '');
  const full =
    value.length === 3
      ? value
          .split('')
          .map((c) => c + c)
          .join('')
      : value;

  if (!/^[0-9a-f]{6}$/i.test(full)) return null;

  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function applyTheme(theme: ThemePayload): void {
  const root = document.documentElement;
  const colors: Partial<ColorScheme> = theme.colorScheme ?? {};

  for (const [name, key] of COLOR_VARS) {
    const value = colors[key];
    // ערך חסר משאיר את ברירת המחדל שב-tokens.css במקום לאפס את המשתנה.
    if (typeof value === 'string' && value !== '') root.style.setProperty(name, value);
  }

  // surfaceContainerHigh הוא הרקע שהמדריך מחייב לפס העליון, אבל הוא נוסף
  // ב-SDK 1.1.0 ואופציונלי בטיפוס. בגרסה שלא מחזירה אותו נופלים ל-highest,
  // כדי שהפס לא ייראה כמו גוף המסמך.
  if (!colors.surfaceContainerHigh && colors.surfaceContainerHighest) {
    root.style.setProperty('--color-surface-container-high', colors.surfaceContainerHighest);
  }

  for (const [name, key] of [
    ['--color-primary-subtle', 'primary'],
    ['--color-secondary-subtle', 'secondary'],
  ] as const) {
    const base = colors[key];
    const subtle = typeof base === 'string' ? hexToRgba(base, 0.12) : null;
    if (subtle) root.style.setProperty(name, subtle);
  }

  // הגופנים של אוצריא מוזרקים כ-@font-face לפני plugin.boot — אין לארוז אותם.
  // מה שכן ארוז הוא 'Selawik' (styles/fonts.ts), והוא יושב **אחרי** בחירת
  // המשתמש: הבחירה שלו קודמת. אין בו עברית, ולכן הוא תופס בפועל רק טקסט לטיני
  // בממשק; 'David' ו-serif נשארים בסוף השרשרת בשביל העברית.
  const typography = theme.typography;
  if (typography?.fontFamily) {
    root.style.setProperty(
      '--font-main',
      `'${typography.fontFamily}', 'Selawik', 'David', serif`,
    );
  }
  if (typeof typography?.fontSize === 'number' && typography.fontSize > 0) {
    root.style.setProperty('--font-size-base', `${typography.fontSize}px`);
  }
  if (typeof typography?.lineHeight === 'number' && typography.lineHeight > 0) {
    root.style.setProperty('--line-height', String(typography.lineHeight));
  }

  if (theme.mode) root.dataset.theme = theme.mode;
  document.body?.classList.toggle('dark-mode', theme.mode === 'dark');
}
