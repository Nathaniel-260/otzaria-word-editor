/**
 * שער: `title` על אלמנט DOM — כישלון בנייה.
 *
 * ## התקלה שהשער הזה סוגר
 *
 * המשתמש צילם שני טולטיפים זה מעל זה על „כיוון פסקה משמאל לימין”: הכרטיס
 * המעוצב של התוכנה, ומעליו המלבן האפור של מערכת ההפעלה. מקור המלבן הוא תכונת
 * `title` על הכפתור.
 *
 * הניסיון המתבקש — להשאיר את `title` ולהסיר אותו בריחוף — **אינו עובד**, ולא
 * בגלל באג שאפשר לתקן. הדפדפן קורא את התכונה בתזוזת העכבר ולא כשהוא מצייר:
 * הטקסט נלכד כבר בתזוזה שבה הסמן נעצר, ההשהיה שלו רצה, והמלבן מצויר גם אם
 * התכונה ירדה מה-DOM בינתיים. Blink גם מטפס להורים בחיפוש `title`
 * (`HitTestResult::Title`), כך שגם „נעביר אותו לעוטף” אינו מוצא.
 *
 * לכן הפתרון אינו ניהול של הבעיה אלא ביטולה: `title` אינו קיים באף אלמנט DOM
 * בתוכנה, והטולטיפ מוצהר בתכונות `data-tip-*` בלבד. מפקד שנמדד ב-Chrome על
 * ה-dist הארוז לפני ההמרה מצא 61 תכונות `title` — כולן מהמקור שלנו, אף אחת לא
 * מהמנוע — כלומר ההמרה מסלקת את המחלקה כולה.
 *
 * ## למה שער, ולא הסתמכות על זהירות
 *
 * 47 אלמנטים הומרו. `title` הוא הדבר הראשון שיד כותבת כשהיא רוצה טולטיפ, הוא
 * עובר type-check, הוא אינו מפיל דבר — והתוצאה שלו נראית רק בעין, ורק אם
 * מרחפים דווקא על הפקד הזה. זה בדיוק הפרופיל של תקלה שחוזרת.
 *
 * ## למה AST ולא regex
 *
 * `<RibbonGroup title="קובץ ומסמך">` הוא **prop של קומפוננטה**, לא תכונת DOM:
 * הוא נהיה כותרת הקבוצה ואינו מגיע לדפדפן. 40 כאלה במאגר, ו-regex לא מבחין
 * בינם לבין `<button title="…">`. הפרסר של Vue כן — הוא מוסר את שם התג, ותג
 * שמתחיל באות קטנה הוא אלמנט DOM.
 */
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parse } from 'vue/compiler-sfc';
import {
  TIP_DESCRIPTION_ATTR,
  TIP_SHORTCUT_ATTR,
  TIP_TITLE_ATTR,
} from '../../src/ui/tooltip/tooltip-content';

const SRC = join(__dirname, '..', '..', 'src');

/** שם תג שמתחיל באות קטנה הוא אלמנט DOM; באות גדולה — קומפוננטה. */
const NATIVE_TAG = /^[a-z]/;

const KNOWN_TIP_ATTRS = new Set([TIP_TITLE_ATTR, TIP_SHORTCUT_ATTR, TIP_DESCRIPTION_ATTR]);

function vueFiles(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) vueFiles(path, found);
    else if (path.endsWith('.vue')) found.push(path);
  }
  return found;
}

interface TemplateNode {
  type: number;
  tag?: string;
  props?: Array<{
    type: number;
    name: string;
    arg?: { content?: string };
    loc: { start: { line: number } };
  }>;
  children?: TemplateNode[];
}

/** שם התכונה כפי שתגיע ל-DOM: `title` ו-`:title` הם אותו דבר. */
function attributeName(prop: NonNullable<TemplateNode['props']>[number]): string | null {
  if (prop.type === 6) return prop.name;
  if (prop.name === 'bind') return prop.arg?.content ?? null;
  return null;
}

interface Finding {
  where: string;
  what: string;
}

/** כל התכונות שנכתבו על אלמנטי DOM, לפי קובץ ושורה. */
function domAttributes(): Array<Finding & { name: string }> {
  const found: Array<Finding & { name: string }> = [];

  for (const file of vueFiles(SRC)) {
    const { descriptor, errors } = parse(readFileSync(file, 'utf8'), { filename: file });
    expect(errors, `${relative(SRC, file)} אינו נפרס`).toEqual([]);

    const root = descriptor.template?.ast as TemplateNode | undefined;
    if (!root) continue;

    const walk = (node: TemplateNode): void => {
      // 1 = ELEMENT ב-AST של Vue.
      if (node.type === 1 && node.tag && NATIVE_TAG.test(node.tag)) {
        for (const prop of node.props ?? []) {
          const name = attributeName(prop);
          if (name) {
            found.push({
              name,
              what: `<${node.tag}>`,
              where: `${relative(SRC, file)}:${prop.loc.start.line}`,
            });
          }
        }
      }
      for (const child of node.children ?? []) walk(child);
    };

    walk(root);
  }

  return found;
}

const ATTRIBUTES = domAttributes();

describe('הטולטיפ המולד אינו יכול לחזור', () => {
  it('שום אלמנט DOM במקור אינו נושא title', () => {
    const offenders = ATTRIBUTES.filter((attribute) => attribute.name === 'title').map(
      (attribute) => `${attribute.where} ${attribute.what}`,
    );

    // ההודעה היא חלק מהשער: מי שנופל כאן צריך לדעת מה לכתוב במקום.
    expect(
      offenders,
      `יש להצהיר על טולטיפ ב-${TIP_TITLE_ATTR} (ובמידת הצורך ${TIP_SHORTCUT_ATTR} ` +
        `ו-${TIP_DESCRIPTION_ATTR}), ועל השם הנגיש ב-aria-label בנפרד`,
    ).toEqual([]);
  });

  it('אין תכונת data-tip- בשם שהשכבה אינה קוראת', () => {
    const typos = ATTRIBUTES.filter(
      (attribute) => attribute.name.startsWith('data-tip') && !KNOWN_TIP_ATTRS.has(attribute.name),
    ).map((attribute) => `${attribute.where} ${attribute.name}`);

    // בלי זה `data-tip-titel` היה תכונה שקטה שאיש אינו קורא, והטולטיפ פשוט
    // לא היה מופיע — בלי שגיאה ובלי שהעין תבחין בכך בסריקה של הקוד.
    expect(typos, `שמות התכונות המוכרים: ${[...KNOWN_TIP_ATTRS].join(', ')}`).toEqual([]);
  });

  it('הסריקה עצמה מוצאת מה שהיא אמורה — אחרת היא ירוקה על כלום', () => {
    // בלי הבדיקה הזאת שגיאה בפרסר (`descriptor.template` ריק, למשל) הייתה
    // מחזירה רשימה ריקה, וכל השער היה עובר בלי לבדוק דבר.
    const tipTitles = ATTRIBUTES.filter((attribute) => attribute.name === TIP_TITLE_ATTR);
    expect(tipTitles.length).toBeGreaterThan(30);
    expect(ATTRIBUTES.some((attribute) => attribute.name === 'aria-label')).toBe(true);
  });
});
