/**
 * בדיקת שפיות על תיקיית dist, לפני אריזה.
 *
 * שני האילוצים שהתוסף חייב לעמוד בהם (docs/word-plugin-implementation-plan.md §2, §18):
 * הפלט הוא סקריפטים קלאסיים בלבד — WebView2 אינו טוען <script type="module">
 * מ-file:// — והכול מקומי, בלי רשת. הבדיקה נכשלת על הפרה של אלה, ומדפיסה
 * גדלים כעדות לשער B.
 */
import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const DIST = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const errors = [];
const warnings = [];

if (!existsSync(DIST)) {
  console.error('dist אינו קיים — הריצו npm run build תחילה');
  process.exit(1);
}

const indexPath = join(DIST, 'index.html');
if (!existsSync(indexPath)) errors.push('חסר dist/index.html');

const html = existsSync(indexPath) ? readFileSync(indexPath, 'utf8') : '';

if (/<script[^>]*\btype=("|')module\1/.test(html)) {
  errors.push('dist/index.html מכיל <script type="module"> — WebView2 לא יטען אותו מ-file://');
}
if (/\bcrossorigin\b/.test(html)) {
  errors.push('dist/index.html מכיל crossorigin — מיותר ב-file:// ומעורר בקשה חוצת-מקור');
}

// כל href/src ב-HTML חייב להיות נכס מקומי שקיים בפועל.
for (const match of html.matchAll(/\b(src|href)=("|')([^"']+)\2/g)) {
  const attr = match[1];
  const url = match[3];
  if (/^(https?:)?\/\//i.test(url)) {
    errors.push(`dist/index.html מפנה לכתובת חיצונית ב-${attr}: ${url}`);
    continue;
  }
  if (url.startsWith('data:') || url.startsWith('#')) continue;
  const local = join(DIST, url.replace(/^\.?\//, '').split('?')[0]);
  if (!existsSync(local)) errors.push(`נכס חסר ב-dist: ${url}`);
}

// ה-workers חייבים להיטען לפני app.js — engineWorkerUrls() נצרך בהקמת המנוע.
const workersAt = html.indexOf('engine-workers.js');
const appAt = html.indexOf('app.js');
if (workersAt === -1) errors.push('assets/engine-workers.js אינו נטען מ-index.html');
else if (appAt !== -1 && workersAt > appAt) {
  errors.push('engine-workers.js נטען אחרי app.js — המנוע יקום בלי ה-workers');
}

// CDN-ים שמנועי צד-שלישי נוטים ליפול אליהם כברירת מחדל. אינם נכשלים
// אוטומטית: מחרוזת בבאנדל אינה בקשה. הן נרשמות כדי שייבדקו ידנית בשער A.
const CDN_HINTS = ['cdn.jsdelivr.net', 'unpkg.com', 'cdnjs.cloudflare.com', 'fonts.googleapis.com'];

const files = [];
function walk(dir, prefix = '') {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) walk(join(dir, entry.name), rel);
    else files.push(rel);
  }
}
walk(DIST);

console.log('גדלים ב-dist:');
let total = 0;
for (const rel of files.sort()) {
  const size = statSync(join(DIST, rel)).size;
  total += size;
  console.log(`  ${rel.padEnd(34)} ${(size / 1024 / 1024).toFixed(2)} MB`);
}
console.log(`  ${'סה"כ'.padEnd(34)} ${(total / 1024 / 1024).toFixed(2)} MB`);

for (const rel of files) {
  if (!rel.endsWith('.js')) continue;
  const full = join(DIST, rel);
  try {
    execFileSync(process.execPath, ['--check', full], { stdio: 'pipe' });
  } catch {
    errors.push(`${rel} אינו סקריפט קלאסי תקין (node --check נכשל)`);
  }
  const text = readFileSync(full, 'utf8');
  for (const hint of CDN_HINTS) {
    if (text.includes(hint)) warnings.push(`${rel} מכיל את המחרוזת ${hint}`);
  }
}

for (const w of new Set(warnings)) console.warn(`אזהרה: ${w}`);
if (errors.length) {
  for (const e of errors) console.error(`שגיאה: ${e}`);
  process.exit(1);
}
console.log('dist תקין: סקריפטים קלאסיים, כל הנכסים מקומיים.');
