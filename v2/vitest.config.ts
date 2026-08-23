import { defineConfig } from 'vitest/config';

/**
 * הבדיקות אינן מרימות את מנוע ה-DOCX: הוא דורש workers ו-canvas אמיתיים,
 * ולכן ריצה חיה נבדקת בשערי Windows (docs/spike-windows.md) ולא ב-jsdom.
 * מה שכן נבדק כאן: חוזה ה-API של superdoc/ui, ה-registry של הפקודות
 * והאדפטרים שלנו מול כפילים.
 */
export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.ts'],
  },
});
