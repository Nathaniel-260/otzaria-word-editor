/**
 * שער מקור האייקונים: כל אייקון ב-`src/ui/icons/icons.ts` שמוצהר כ-Fluent
 * System Icons באמת **הועתק** משם, והטבלה ב-THIRD_PARTY_NOTICES.md נוקבת בשם
 * הגליף הנכון.
 *
 * למה שער: ההצהרה ב-THIRD_PARTY_NOTICES.md היא מסמך רישוי, וכל מה שהחזיק אותה
 * עד כה היה הזיכרון של מי שכתב אותה. שתי דרכים לסטות ממנה, ושתיהן קרו כאן:
 *
 * 1. **אייקון מצויר בבית שנספר בין המכוסים.** ה-MIT מכסה את ה-path data של
 *    Microsoft; ציור של הפרויקט אינו שלה, ולמנות אותו בהצהרה מרחיב אותה מעבר
 *    למה שנלקח. `exportPdf` נוסף אחרי כתיבת המסמך ולא נרשם בו כלל — לא בטבלה
 *    ולא ברשימת החריגים — ואף בדיקה לא התלוננה.
 * 2. **הנמקה שהתיישנה.** ארבעה אייקונים נשארו מצוירים בבית בנימוק „אין ל-Fluent
 *    גליף כזה בכלל”, ובחבילה יש `document_header` ו-`document_footer`. הנימוק
 *    לא נבדק אף פעם מול החבילה עצמה.
 *
 * לכן השער אינו קורא את הטבלה כאמת אלא **מודד מול החבילה**: מוריד את
 * `@fluentui/svg-icons` בגרסה הנעוצה ב-`npm pack`, מפרק לתיקייה זמנית, ומשווה
 * את ה-`d=` של כל אייקון מול הגליף שהטבלה מייחסת לו — byte-for-byte. אין כאן
 * דמיון ואין סובלנות: או שזה אותו path, או שזה לא הקוד של Microsoft.
 *
 * ההשוואה היא מול **גרסה נעוצה** ולא מול „האחרונה”: גרסה חדשה עשויה לצייר גליף
 * מחדש, ואז ה-path שכאן היה נפסל כסטייה בלי שהשתנה כלום. שדרוג הוא החלטה —
 * מעדכנים את `VERSION` כאן, מריצים, ומעדכנים את המסמך.
 *
 * **מדלג ואינו נכשל כשאין רשת**, בדיוק כמו `check:sdk`: השער תלוי ב-registry
 * חיצוני, ושער שנכשל על מכונה בלי אינטרנט הוא שער שמכבים אותו. מה שאינו תלוי
 * ברשת — ההתאמה בין ICONS, הטבלה ורשימת החריגים — רץ תמיד.
 *
 * החבילה מורדת לתיקייה זמנית ונמחקת בסוף. היא אינה נכנסת ל-`package.json`,
 * ל-`node_modules` או ל-`dist` — ראו „אין תלות חדשה” ב-THIRD_PARTY_NOTICES.md.
 *
 *   npm run check:icons
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const ICONS_TS = join(ROOT, 'src', 'ui', 'icons', 'icons.ts');
const NOTICES = join(ROOT, 'THIRD_PARTY_NOTICES.md');

/** הגרסה שההצהרה ב-THIRD_PARTY_NOTICES.md נוקבת בה. שינוי כאן = שינוי שם. */
const VERSION = '1.1.338';
/** הווריאנט היחיד שנלקח: regular בגריד 20, כמו ה-viewBox של כל הסט. */
const VARIANT = '_20_regular.svg';

/**
 * האייקונים שאינם של Microsoft, והסיבה לכל אחד. הרשימה **סגורה**: אייקון
 * מצויר בבית שאינו כאן מפיל את השער, וזה בדיוק מה שהיה תופס את `exportPdf`.
 * ההנמקות המלאות במסמך ובהערות `icons.ts`; מה שכאן הוא השורה שהשער מדפיס.
 */
const IN_HOUSE = new Map([
  ['word', 'מיתוג — תג האפליקציה. ה-MIT מכסה אייקוני ממשק, לא סמלי מוצר'],
  ['otzaria', 'מיתוג — הלוגו של אוצריא, שאינו של Microsoft כלל'],
  ['exit', 'נדרש חץ שמאלה (ממשק עברי); אין בספרייה יציאה בכיוון הזה'],
  ['macro', 'סמל הקלטה — טבעת עם דיסק. אין `record` ב-1.1.338'],
  ['firstPageHeader', '„שני דפים שנבדלים זה מזה” — אין לזה גליף'],
  ['oddEvenPages', '„שני דפים שנבדלים זה מזה” — אין לזה גליף'],
]);

const problems = [];

/** כל ערך ב-ICONS, כפי שהוא בקובץ. לא import — השער בודק את הטקסט שנשלח. */
function readIcons() {
  const src = readFileSync(ICONS_TS, 'utf8');
  const out = new Map();
  for (const m of src.matchAll(/^ {2}([a-zA-Z]+): `(<svg[\s\S]*?<\/svg>)`,$/gm)) {
    out.set(m[1], pathData(m[2]));
  }
  return out;
}

/** שרשור כל ה-`d=` שב-SVG. זה, ורק זה, מה שהועתק מ-Microsoft. */
function pathData(svg) {
  return [...svg.matchAll(/\sd="([^"]+)"/g)].map((m) => m[1]).join('|');
}

/**
 * המיפוי שהטבלאות ב-THIRD_PARTY_NOTICES.md מצהירות עליו: שורה של שלוש עמודות
 * שהראשונה והשלישית שלהן ב-backticks. הטבלה היא ההצהרה, ולכן היא — ולא רשימה
 * שנייה בקוד — מקור האמת שנבדק.
 */
function readDeclared() {
  const md = readFileSync(NOTICES, 'utf8');
  const out = new Map();
  for (const m of md.matchAll(/^\| `([a-zA-Z]+)` \| [^|]+ \| `([a-z0-9_]+)` \|$/gm)) {
    out.set(m[1], m[2]);
  }
  return out;
}

/** `npm pack` לתיקייה זמנית. מחזיר `dir: null` כשאין רשת — ואז השער מדלג. */
function fetchPackage() {
  const dir = mkdtempSync(join(tmpdir(), 'fluent-icons-'));
  try {
    // הפקודה כולה ב-`file` ומערך ארגומנטים ריק, עם `shell: true`. שלוש מגבלות
    // נפגשות כאן: ב-Windows `npm` הוא `npm.cmd` ו-Node חוסם spawn שלו בלי shell
    // (EINVAL); `shell: true` **עם** ארגומנטים מעלה את DEP0190, כי הם מחוברים
    // בלי escaping; ו-`execSync` נתקע כאן. אין קלט חיצוני — `VERSION` קבוע.
    const tarball = execFileSync(`npm pack @fluentui/svg-icons@${VERSION} --silent`, [], {
      cwd: dir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
    })
      .trim()
      .split(/\r?\n/)
      .pop();
    execFileSync('tar', ['xzf', tarball], { cwd: dir, stdio: 'ignore' });
    return { dir, icons: join(dir, 'package', 'icons') };
  } catch (err) {
    rmSync(dir, { recursive: true, force: true });
    return { dir: null, error: String(err.message).split('\n')[0] };
  }
}

const icons = readIcons();
if (icons.size < 50) {
  console.error(`✗ נקראו רק ${icons.size} אייקונים מ-icons.ts — הפורמט השתנה?`);
  process.exit(1);
}

const declared = readDeclared();
console.log(
  `אייקונים ב-ICONS: ${icons.size} · מוצהרים בטבלה: ${declared.size} · חריגים: ${IN_HOUSE.size}`
);

// שער ראשון, ואינו זקוק לרשת: כל שם מופיע בדיוק במקום אחד — בטבלה או בחריגים.
for (const name of icons.keys()) {
  const inTable = declared.has(name);
  const inHouse = IN_HOUSE.has(name);
  if (inTable && inHouse) problems.push(`${name}: גם בטבלת Fluent וגם ברשימת החריגים`);
  else if (!inTable && !inHouse) problems.push(`${name}: אינו בטבלה ואינו ברשימת החריגים`);
}
for (const name of declared.keys()) {
  if (!icons.has(name)) problems.push(`${name}: מוצהר בטבלה ואינו קיים ב-ICONS`);
}
for (const name of IN_HOUSE.keys()) {
  if (!icons.has(name)) problems.push(`${name}: ברשימת החריגים ואינו קיים ב-ICONS`);
}

const pkg = fetchPackage();
if (!pkg.dir) {
  console.log(`\n⚠ אין גישה ל-npm registry — ההשוואה מול החבילה מדולגת (${pkg.error})`);
  console.log('  ההתאמה בין ICONS, הטבלה ורשימת החריגים כן נבדקה.');
} else {
  try {
    /** אינדקס הפוך: path data → כל שמות הגליפים שחולקים אותו. */
    const byPath = new Map();
    for (const file of readdirSync(pkg.icons)) {
      if (!file.endsWith(VARIANT)) continue;
      const key = pathData(readFileSync(join(pkg.icons, file), 'utf8'));
      const name = file.slice(0, -VARIANT.length);
      if (byPath.has(key)) byPath.get(key).push(name);
      else byPath.set(key, [name]);
    }
    console.log(
      `גליפי ${VARIANT.slice(1, -4)} ב-@fluentui/svg-icons@${VERSION}: ${byPath.size} ייחודיים\n`
    );

    let exact = 0;
    for (const [name, fluent] of declared) {
      const data = icons.get(name);
      if (data === undefined) continue; // כבר דווח למעלה
      // גליפים שונים חולקים לפעמים path זהה (`text_align_justify` הוא גם
      // `navigation`), ולכן ההתאמה היא „השם המוצהר בין החולקים” ולא „היחיד”.
      const shared = byPath.get(data);
      if (!shared) {
        problems.push(`${name}: ה-path אינו של אף גליף ב-${VERSION} — ההצהרה טוענת ${fluent}`);
      } else if (!shared.includes(fluent)) {
        problems.push(`${name}: ההצהרה טוענת ${fluent}, וה-path הוא של ${shared.join('/')}`);
      } else exact++;
    }
    console.log(`✓ ${exact} אייקונים תואמים byte-for-byte לגליף שהטבלה נוקבת בו`);

    // הכיוון ההפוך: חריג שיש לו כבר מקבילה מדויקת אינו חריג. בלי זה הרשימה
    // מתקבעת — וזה בדיוק מה שקרה ל-`header` ול-`footer`.
    for (const [name, reason] of IN_HOUSE) {
      const shared = byPath.get(icons.get(name));
      if (shared) problems.push(`${name}: מוצהר כציור בבית, אבל ה-path זהה ל-${shared.join('/')}`);
      else console.log(`  חריג — ${name}: ${reason}`);
    }
  } finally {
    rmSync(pkg.dir, { recursive: true, force: true });
  }
}

if (problems.length) {
  console.error(`\n✗ ${problems.length} סטיות מהצהרת הרישוי:`);
  for (const p of problems) console.error(`  - ${p}`);
  console.error('\nראו THIRD_PARTY_NOTICES.md, סעיף Fluent System Icons.');
  process.exit(1);
}
console.log('\n✓ הצהרת הרישוי של האייקונים תואמת את הקוד');
