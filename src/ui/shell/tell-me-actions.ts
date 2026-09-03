/**
 * קטלוג הפקודות והאפשרויות עבור מנגנון ה-Tell Me (חיפוש פקודות בסגנון Word).
 *
 * המטרה: לאפשר למשתמש להקליד מונח בעברית (כגון: "מרכז", "טבלה", "גופן", "הדפסה",
 * "שמור", "סגנון", "מעקב", "אוצריא"), לקבל תוצאות מדויקות ומדורגות, ולהפעיל את
 * הפקודה ישירות מהמקלדת או העכבר.
 */

import type { ShellAction } from '../shortcuts/registry';
import { alignmentPayload, lineHeightPayload, stylePayload } from '../../engine/payloads';

export interface TellMeAction {
  /** מזהה ייחודי לפעולה */
  id: string;
  /** כותרת ראשית בעברית שמוצגת למשתמש */
  title: string;
  /** נתיב מיקום ברצועה (Breadcrumb) או תחום פעולה */
  category: string;
  /** תיאור קצר אופציונלי */
  description?: string;
  /** מילות מפתח, נרדפות ומונחים באנגלית ובעברית לחיפוש מהיר */
  keywords: string[];
  /** צירוף מקשים מוצג (אם קיים) */
  shortcut?: string;
  /** שם האייקון בספריית ה-SvgIcon */
  icon: string;
  /** פקודת מנוע עריכה להרצה ישירה דרך commandAdapter */
  command?: { id: string; payload?: unknown };
  /** פעולת מעטפת להרצה דרך runShellAction */
  shellAction?: ShellAction;
  /** פעולה ייעודית למעטפת שאינה ב-ShellAction */
  customAction?: string;
}

/**
 * רשימת הפקודות המלאה הזמינה ב-Tell Me.
 */
export const TELL_ME_ACTIONS: readonly TellMeAction[] = [
  // --- קובץ ---
  {
    id: 'file-save',
    title: 'שמירה',
    category: 'קובץ',
    description: 'שמירת השינויים במסמך הנוכחי',
    keywords: ['שמור', 'שמירה', 'שמירת מסמך', 'save'],
    shortcut: 'Ctrl+S',
    icon: 'save',
    shellAction: 'save',
  },
  {
    id: 'file-save-as',
    title: 'שמירה בשם',
    category: 'קובץ',
    description: 'שמירת המסמך בעותק חדש או בשם אחר',
    keywords: ['שמור בשם', 'שמירה בשם', 'עותק', 'ייצוא', 'וורד', 'docx', 'word', 'save as'],
    shortcut: 'Ctrl+Shift+S',
    icon: 'saveAs',
    shellAction: 'save-as',
  },
  {
    id: 'file-new',
    title: 'מסמך חדש',
    category: 'קובץ',
    description: 'יצירת מסמך חדש ריק',
    keywords: ['חדש', 'מסמך חדש', 'דף חדש', 'קובץ חדש', 'new'],
    shortcut: 'Ctrl+N',
    icon: 'newDoc',
    shellAction: 'new-document',
  },
  {
    id: 'file-open',
    title: 'פתיחת קובץ',
    category: 'קובץ',
    description: 'פתיחת מסמך קיים מהמחשב',
    keywords: ['פתח', 'פתיחה', 'קובץ', 'טעינה', 'open', 'load'],
    shortcut: 'Ctrl+O',
    icon: 'folder',
    shellAction: 'open-document',
  },
  {
    id: 'file-print',
    title: 'הדפסה',
    category: 'קובץ',
    description: 'הדפסת המסמך',
    keywords: ['הדפס', 'הדפסה', 'מדפסת', 'print'],
    shortcut: 'Ctrl+P',
    icon: 'print',
    shellAction: 'print',
  },
  {
    id: 'file-export-pdf',
    title: 'ייצוא ל-PDF',
    category: 'קובץ',
    description: 'שמירת המסמך כקובץ PDF',
    keywords: ['פי די אף', 'ייצוא', 'pdf', 'export'],
    icon: 'exportPdf',
    customAction: 'export-pdf',
  },
  {
    id: 'help-shortcuts',
    title: 'קיצורי מקלדת',
    category: 'עזרה',
    description: 'הצגת רשימת כל קיצורי המקלדת',
    keywords: ['קיצורים', 'מקלדת', 'עזרה', 'קיצור', 'shortcuts', 'help'],
    shortcut: 'Ctrl+/',
    icon: 'info',
    shellAction: 'shortcuts-help',
  },
  {
    id: 'help-about',
    title: 'אודות וורד לאוצריא',
    category: 'עזרה',
    description: 'מידע על התוכנה וגרסתה',
    keywords: ['אודות', 'גרסה', 'מידע', 'about'],
    icon: 'info',
    customAction: 'about',
  },

  // --- לוח (Clipboard) ---
  {
    id: 'edit-undo',
    title: 'בטל פעולה',
    category: 'עריכה',
    description: 'ביטול הפעולה האחרונה',
    keywords: ['בטל', 'ביטול', 'אחורה', 'undo'],
    shortcut: 'Ctrl+Z',
    icon: 'undo',
    command: { id: 'undo' },
  },
  {
    id: 'edit-redo',
    title: 'בצע שוב',
    category: 'עריכה',
    description: 'חזרה על הפעולה שבוטלה',
    keywords: ['בצע שוב', 'חזור', 'קדימה', 'redo'],
    shortcut: 'Ctrl+Y',
    icon: 'redo',
    command: { id: 'redo' },
  },
  {
    id: 'clipboard-paste',
    title: 'הדבק',
    category: 'בית > לוח',
    description: 'הדבקת תוכן מלוח הגזירים',
    keywords: ['הדבק', 'הדבקה', 'לוח', 'paste'],
    shortcut: 'Ctrl+V',
    icon: 'paste',
    command: { id: 'paste' },
  },
  {
    id: 'clipboard-copy',
    title: 'העתק',
    category: 'בית > לוח',
    description: 'העתקת הטקסט המסומן ללוח',
    keywords: ['העתק', 'העתקה', 'לוח', 'copy'],
    shortcut: 'Ctrl+C',
    icon: 'copy',
    command: { id: 'copy' },
  },
  {
    id: 'clipboard-cut',
    title: 'גזור',
    category: 'בית > לוח',
    description: 'גזירת הטקסט המסומן ללוח',
    keywords: ['גזור', 'גזירה', 'לוח', 'cut'],
    shortcut: 'Ctrl+X',
    icon: 'cut',
    command: { id: 'cut' },
  },
  {
    id: 'clipboard-format-painter',
    title: 'מברשת עיצוב',
    category: 'בית > לוח',
    description: 'העתקת עיצוב ממקום אחד והחלתו במקום אחר',
    keywords: ['מברשת', 'מברשת עיצוב', 'העתק עיצוב', 'format painter'],
    shortcut: 'Ctrl+Shift+C',
    icon: 'formatPainter',
    command: { id: 'format-painter' },
  },

  // --- גופן ועיצוב תו ---
  {
    id: 'font-bold',
    title: 'מודגש (Bold)',
    category: 'בית > גופן',
    description: 'הדגשת הטקסט המסומן',
    keywords: ['מודגש', 'הדגשה', 'עבה', 'בולד', 'bold'],
    shortcut: 'Ctrl+B',
    icon: 'bold',
    command: { id: 'bold' },
  },
  {
    id: 'font-italic',
    title: 'נטוי (Italic)',
    category: 'בית > גופן',
    description: 'הטיית הטקסט המסומן',
    keywords: ['נטוי', 'הטיה', 'איטליק', 'italic'],
    shortcut: 'Ctrl+I',
    icon: 'italic',
    command: { id: 'italic' },
  },
  {
    id: 'font-underline',
    title: 'קו תחתי (Underline)',
    category: 'בית > גופן',
    description: 'הוספת קו מתחת לטקסט',
    keywords: ['קו תחתי', 'פס תחתי', 'קו למטה', 'underline'],
    shortcut: 'Ctrl+U',
    icon: 'underline',
    command: { id: 'underline' },
  },
  {
    id: 'font-strikethrough',
    title: 'קו חוצה (Strikethrough)',
    category: 'בית > גופן',
    description: 'העברת קו באמצע הטקסט',
    keywords: ['קו חוצה', 'מחיקה', 'חוצה', 'strike', 'strikethrough'],
    icon: 'strikethrough',
    command: { id: 'strikethrough' },
  },
  {
    id: 'font-grow',
    title: 'הגדלת גופן',
    category: 'בית > גופן',
    description: 'הגדלת גודל האותיות בדרגה אחת',
    keywords: ['הגדל', 'הגדלת גופן', 'גודל', 'אותיות גדולות', 'grow font', 'bigger'],
    shortcut: 'Ctrl+Shift+.',
    icon: 'growFont',
    shellAction: 'font-grow',
  },
  {
    id: 'font-shrink',
    title: 'הקטנת גופן',
    category: 'בית > גופן',
    description: 'הקטנת גודל האותיות בדרגה אחת',
    keywords: ['הקטן', 'הקטנת גופן', 'גודל', 'אותיות קטנות', 'shrink font', 'smaller'],
    shortcut: 'Ctrl+Shift+,',
    icon: 'shrinkFont',
    shellAction: 'font-shrink',
  },
  {
    id: 'font-superscript',
    title: 'כתב עילי (Superscript)',
    category: 'בית > גופן',
    description: 'הקטנת הטקסט והצבתו מעל גובה השורה',
    keywords: ['כתב עילי', 'חזקה', 'למעלה', 'superscript'],
    shortcut: 'Ctrl+Shift+=',
    icon: 'superscript',
    shellAction: 'superscript',
  },
  {
    id: 'font-subscript',
    title: 'כתב תחתי (Subscript)',
    category: 'בית > גופן',
    description: 'הקטנת הטקסט והצבתו מתחת לגובה השורה',
    keywords: ['כתב תחתי', 'אינדקס', 'למטה', 'subscript'],
    shortcut: 'Ctrl+=',
    icon: 'subscript',
    shellAction: 'subscript',
  },
  {
    id: 'font-clear-formatting',
    title: 'נקה עיצוב',
    category: 'בית > גופן',
    description: 'הסרת כל עיצובי התווים והחזרה לעיצוב ברירת המחדל',
    keywords: ['נקה', 'ניקוי עיצוב', 'אפס עיצוב', 'איפוס', 'clear formatting'],
    shortcut: 'Ctrl+Space',
    icon: 'clearFormatting',
    command: { id: 'clear-formatting' },
  },

  // --- פסקה ויישור ---
  {
    id: 'para-align-right',
    title: 'יישור לימין',
    category: 'בית > פסקה',
    description: 'יישור שורות הפסקה לצד ימין',
    keywords: ['ימין', 'יישור לימין', 'align right'],
    shortcut: 'Ctrl+R',
    icon: 'alignRight',
    command: { id: 'align', payload: alignmentPayload('right') },
  },
  {
    id: 'para-align-center',
    title: 'יישור למרכז (מרכוז)',
    category: 'בית > פסקה',
    description: 'מרכוז שורות הפסקה באמצע הדף',
    keywords: ['מרכז', 'מרכוז', 'אמצע', 'יישור למרכז', 'center', 'align center'],
    shortcut: 'Ctrl+E',
    icon: 'alignCenter',
    command: { id: 'align', payload: alignmentPayload('center') },
  },
  {
    id: 'para-align-left',
    title: 'יישור לשמאל',
    category: 'בית > פסקה',
    description: 'יישור שורות הפסקה לצד שמאל',
    keywords: ['שמאל', 'יישור לשמאל', 'align left'],
    shortcut: 'Ctrl+L',
    icon: 'alignLeft',
    command: { id: 'align', payload: alignmentPayload('left') },
  },
  {
    id: 'para-align-justify',
    title: 'יישור לשני הצדדים (בלוק)',
    category: 'בית > פסקה',
    description: 'יישור שורות הפסקה לשני הצדדים באופן שווה',
    keywords: ['יישור לשני הצדדים', 'מיושר', 'בלוק', 'חסימה', 'justify'],
    shortcut: 'Ctrl+J',
    icon: 'alignJustify',
    command: { id: 'align', payload: alignmentPayload('justify') },
  },
  {
    id: 'para-dir-rtl',
    title: 'כיוון פסקה מימין לשמאל (RTL)',
    category: 'בית > פסקה',
    description: 'קביעת כיוון הפסקה לשפות הנכתבות מימין לשמאל',
    keywords: ['כיוון', 'ימין לשמאל', 'עברית', 'rtl', 'right to left'],
    shortcut: 'Ctrl+RightShift',
    icon: 'dirRtl',
    command: { id: 'direction', payload: { dir: 'rtl' } },
  },
  {
    id: 'para-dir-ltr',
    title: 'כיוון פסקה משמאל לימין (LTR)',
    category: 'בית > פסקה',
    description: 'קביעת כיוון הפסקה לשפות הנכתבות משמאל לימין',
    keywords: ['כיוון', 'שמאל לימין', 'אנגלית', 'ltr', 'left to right'],
    shortcut: 'Ctrl+LeftShift',
    icon: 'dirLtr',
    command: { id: 'direction', payload: { dir: 'ltr' } },
  },
  {
    id: 'para-bullets',
    title: 'רשימת תבליטים',
    category: 'בית > פסקה',
    description: 'הוספה או הסרה של רשימת תבליטים',
    keywords: ['תבליטים', 'נקודות', 'רשימה', 'bullets', 'list'],
    icon: 'bulletList',
    command: { id: 'bullet-list' },
  },
  {
    id: 'para-numbering',
    title: 'רשימה ממוספרת',
    category: 'בית > פסקה',
    description: 'הוספה או הסרה של מספור פסקאות',
    keywords: ['מספור', 'מספרים', 'רשימה ממוספרת', 'numbers', 'numbered list'],
    icon: 'numberList',
    command: { id: 'numbered-list' },
  },
  {
    id: 'para-indent-increase',
    title: 'הגדלת כניסת פסקה',
    category: 'בית > פסקה',
    description: 'הזזת הפסקה פנימה',
    keywords: ['כניסה', 'הזחה', 'הגדל כניסה', 'טאב', 'indent', 'increase indent'],
    icon: 'indentIncrease',
    command: { id: 'indent-increase' },
  },
  {
    id: 'para-indent-decrease',
    title: 'הקטנת כניסת פסקה',
    category: 'בית > פסקה',
    description: 'הזזת הפסקה החוצה לכיוון השוליים',
    keywords: ['כניסה', 'הזחה', 'הקטן כניסה', 'הזחה אחורה', 'outdent', 'decrease indent'],
    icon: 'indentDecrease',
    command: { id: 'indent-decrease' },
  },
  {
    id: 'para-spacing-1',
    title: 'מרווח שורות 1.0 (יחיד)',
    category: 'בית > פסקה',
    description: 'קביעת מרווח שורות רגיל',
    keywords: ['מרווח', 'מרווח שורות', 'רווח שורות', 'line spacing'],
    icon: 'lineSpacing',
    command: { id: 'line-spacing', payload: lineHeightPayload(1.0) },
  },
  {
    id: 'para-spacing-115',
    title: 'מרווח שורות 1.15',
    category: 'בית > פסקה',
    description: 'קביעת מרווח שורות 1.15',
    keywords: ['מרווח', '1.15', 'רווח בין שורות'],
    icon: 'lineSpacing',
    command: { id: 'line-spacing', payload: lineHeightPayload(1.15) },
  },
  {
    id: 'para-spacing-15',
    title: 'מרווח שורות 1.5',
    category: 'בית > פסקה',
    description: 'קביעת מרווח שורות שורה וחצי',
    keywords: ['מרווח', '1.5', 'שורה וחצי', 'רווח שורות'],
    icon: 'lineSpacing',
    command: { id: 'line-spacing', payload: lineHeightPayload(1.5) },
  },
  {
    id: 'para-spacing-2',
    title: 'מרווח שורות 2.0 (כפול)',
    category: 'בית > פסקה',
    description: 'קביעת מרווח שורות כפול',
    keywords: ['מרווח', '2.0', 'כפול', 'מרווח כפול'],
    icon: 'lineSpacing',
    command: { id: 'line-spacing', payload: lineHeightPayload(2.0) },
  },

  // --- סגנונות (Styles) ---
  {
    id: 'style-normal',
    title: 'סגנון: רגיל',
    category: 'בית > סגנונות',
    description: 'החלת סגנון טקסט רגיל',
    keywords: ['סגנון רגיל', 'טקסט רגיל', 'פסקה רגילה', 'normal', 'style'],
    shortcut: 'Ctrl+Shift+N',
    icon: 'pilcrow',
    command: { id: 'style', payload: stylePayload('normal') },
  },
  {
    id: 'style-h1',
    title: 'סגנון: כותרת 1',
    category: 'בית > סגנונות',
    description: 'החלת סגנון כותרת ראשית ברמה 1',
    keywords: ['כותרת 1', 'h1', 'heading 1'],
    shortcut: 'Ctrl+Alt+1',
    icon: 'pilcrow',
    command: { id: 'style', payload: stylePayload('heading-1') },
  },
  {
    id: 'style-h2',
    title: 'סגנון: כותרת 2',
    category: 'בית > סגנונות',
    description: 'החלת סגנון כותרת משנית ברמה 2',
    keywords: ['כותרת 2', 'h2', 'heading 2'],
    shortcut: 'Ctrl+Alt+2',
    icon: 'pilcrow',
    command: { id: 'style', payload: stylePayload('heading-2') },
  },
  {
    id: 'style-h3',
    title: 'סגנון: כותרת 3',
    category: 'בית > סגנונות',
    description: 'החלת סגנון כותרת רמה 3',
    keywords: ['כותרת 3', 'h3', 'heading 3'],
    shortcut: 'Ctrl+Alt+3',
    icon: 'pilcrow',
    command: { id: 'style', payload: stylePayload('heading-3') },
  },
  {
    id: 'style-title',
    title: 'סגנון: כותרת ראשית',
    category: 'בית > סגנונות',
    description: 'החלת סגנון כותרת המסמך (Title)',
    keywords: ['כותרת ראשית', 'כותרת מסמך', 'title'],
    icon: 'pilcrow',
    command: { id: 'style', payload: stylePayload('title') },
  },
  {
    id: 'style-quote',
    title: 'סגנון: ציטוט',
    category: 'בית > סגנונות',
    description: 'החלת סגנון ציטוט מובלט',
    keywords: ['ציטוט', 'מובאה', 'quote'],
    icon: 'pilcrow',
    command: { id: 'style', payload: stylePayload('quote') },
  },

  // --- עריכה וחיפוש ---
  {
    id: 'edit-find',
    title: 'חיפוש במסמך',
    category: 'בית > עריכה',
    description: 'פתיחת חלונית חיפוש טקסט במסמך',
    keywords: ['חפש', 'חיפוש', 'מצא', 'איתור', 'find', 'search'],
    shortcut: 'Ctrl+F',
    icon: 'search',
    shellAction: 'find',
  },
  {
    id: 'edit-replace',
    title: 'חיפוש והחלפה',
    category: 'בית > עריכה',
    description: 'פתיחת חלונית חיפוש והחלפת טקסט במסמך',
    keywords: ['החלף', 'החלפה', 'חיפוש והחלפה', 'replace'],
    shortcut: 'Ctrl+H',
    icon: 'replace',
    shellAction: 'replace',
  },
  {
    id: 'edit-select-all',
    title: 'בחר הכל',
    category: 'בית > עריכה',
    description: 'בחירת כל הטקסט במסמך',
    keywords: ['בחר הכל', 'סימון הכל', 'סמן הכל', 'select all'],
    shortcut: 'Ctrl+A',
    icon: 'select',
    shellAction: 'select-all',
  },

  // --- הוספה ---
  {
    id: 'insert-page-break',
    title: 'מעבר עמוד',
    category: 'הוספה > עמודים',
    description: 'התחלת עמוד חדש במיקום הסמן',
    keywords: ['מעבר עמוד', 'עמוד חדש', 'דף חדש', 'שבירת עמוד', 'page break'],
    shortcut: 'Ctrl+Enter',
    icon: 'pageBreak',
    shellAction: 'page-break',
  },
  {
    id: 'insert-table',
    title: 'הוספת טבלה (3x3)',
    category: 'הוספה > טבלאות',
    description: 'הוספת טבלה בסיסית במסמך',
    keywords: ['טבלה', 'הוסף טבלה', 'טבלאות', 'table'],
    icon: 'table',
    command: { id: 'table-insert', payload: { rows: 3, cols: 3 } },
  },
  {
    id: 'insert-link',
    title: 'הוספת קישור',
    category: 'הוספה > קישורים',
    description: 'יצירת היפר-קישור בטקסט המסומן',
    keywords: ['קישור', 'לינק', 'היפר קישור', 'link', 'hyperlink'],
    shortcut: 'Ctrl+K',
    icon: 'link',
    shellAction: 'link',
  },
  {
    id: 'insert-footnote',
    title: 'הוספת הערת שוליים',
    category: 'הפניות > הערות',
    description: 'הוספת הערה בתחתית העמוד הנוכחי',
    keywords: ['הערת שוליים', 'הערה', 'שוליים', 'footnote'],
    shortcut: 'Ctrl+Alt+F',
    icon: 'footnote',
    shellAction: 'footnote',
  },
  {
    id: 'insert-endnote',
    title: 'הוספת הערת סיום',
    category: 'הפניות > הערות',
    description: 'הוספת הערה בסוף המסמך',
    keywords: ['הערת סיום', 'סיום', 'endnote'],
    shortcut: 'Ctrl+Alt+D',
    icon: 'footnote',
    shellAction: 'endnote',
  },
  {
    id: 'insert-toc',
    title: 'תוכן עניינים',
    category: 'הפניות > תוכן עניינים',
    description: 'יצירת תוכן עניינים אוטומטי מהכותרות',
    keywords: ['תוכן', 'תוכן עניינים', 'אינדקס', 'toc', 'table of contents'],
    icon: 'toc',
    command: { id: 'toc-insert' },
  },

  // --- תצוגה וסקירה ---
  {
    id: 'view-focus-mode',
    title: 'מצב מיקוד',
    category: 'תצוגה',
    description: 'תצוגת מסך מלא נקייה ללא הסחות דעת',
    keywords: ['מיקוד', 'מצב מיקוד', 'מסך מלא', 'קריאה', 'focus', 'focus mode'],
    shortcut: 'F11',
    icon: 'focusMode',
    shellAction: 'focus-mode',
  },
  {
    id: 'view-ruler',
    title: 'סרגל מידות',
    category: 'תצוגה',
    description: 'הצגה או הסתרה של סרגלי המידות (אופקי ואנכי)',
    keywords: ['סרגל', 'סרגלים', 'מידות', 'סרגל שוליים', 'ruler'],
    icon: 'ruler',
    command: { id: 'ruler' },
  },
  {
    id: 'view-formatting-marks',
    title: 'סימני עיצוב (פילקרו)',
    category: 'תצוגה',
    description: 'הצגת סימני פסקאות, רווחים ומעברי שורות מוסתרים',
    keywords: ['סימני עיצוב', 'רווחים', 'פילקרו', 'תווים נסתרים', 'pilcrow', 'formatting marks'],
    shortcut: 'Ctrl+Shift+8',
    icon: 'pilcrow',
    command: { id: 'formatting-marks' },
  },
  {
    id: 'review-track-changes',
    title: 'מעקב אחר שינויים',
    category: 'סקירה',
    description: 'הפעלה או כיבוי של מעקב אחר עריכות במסמך',
    keywords: ['מעקב', 'שינויים', 'עקוב אחר שינויים', 'track changes'],
    shortcut: 'Ctrl+Shift+E',
    icon: 'trackChanges',
    shellAction: 'track-changes',
  },

  // --- אוצריא ---
  {
    id: 'otzaria-citation',
    title: 'ציטוט מהקורא של אוצריא',
    category: 'אוצריא',
    description: 'הדבקת הקטע והמקור הפתוח כעת באוצריא אל תוך המסמך',
    keywords: ['ציטוט', 'אוצריא', 'מקור', 'קורא', 'citation', 'otzaria'],
    shortcut: 'Ctrl+Shift+Q',
    icon: 'book',
    shellAction: 'insert-citation',
  },
  {
    id: 'otzaria-search',
    title: 'חיפוש הטקסט בספריית אוצריא',
    category: 'אוצריא',
    description: 'חיפוש הקטע המסומן בספרי התוכנה',
    keywords: ['חיפוש באוצריא', 'ספרייה', 'חיפוש ספרים', 'אוצריא'],
    shortcut: 'Ctrl+Shift+G',
    icon: 'search',
    shellAction: 'search-otzaria',
  },
  {
    id: 'otzaria-library',
    title: 'פתיחת ספריית אוצריא',
    category: 'אוצריא',
    description: 'פתיחת חלון ספריית הספרים',
    keywords: ['ספרייה', 'ספרים', 'פתח ספר', 'אוצריא', 'library'],
    icon: 'book',
    shellAction: 'open-library',
  },
  {
    id: 'otzaria-export',
    title: 'ייצוא לאוצריא',
    category: 'אוצריא',
    description: 'ייצוא המסמך בפורמט מותאם לספריית אוצריא',
    keywords: ['ייצוא לאוצריא', 'שמירה לאוצריא', 'אוצריא'],
    icon: 'export',
    customAction: 'export-otzaria',
  },

  // --- מאקרו ---
  {
    id: 'macro-record',
    title: 'הקלטת מאקרו',
    category: 'מאקרו',
    description: 'התחלה או עצירה של הקלטת רצף פעולות',
    keywords: ['מאקרו', 'הקלטה', 'הקלטת מאקרו', 'record', 'macro'],
    shortcut: 'Alt+F8',
    icon: 'macro',
    shellAction: 'macro-record',
  },
  {
    id: 'macro-play',
    title: 'הפעלת מאקרו אחרון',
    category: 'מאקרו',
    description: 'ביצוע חוזר של המאקרו שהוקלט לאחרונה',
    keywords: ['הפעל מאקרו', 'נגן מאקרו', 'מאקרו', 'play macro'],
    shortcut: 'Alt+F9',
    icon: 'macro',
    shellAction: 'macro-play',
  },
  {
    id: 'macro-manage',
    title: 'ניהול מאקרו',
    category: 'מאקרו',
    description: 'פתיחת חלון ניהול ועריכת המאקרו',
    keywords: ['ניהול מאקרו', 'רשימת מאקרו', 'מאקרו'],
    icon: 'macro',
    shellAction: 'macro-manage',
  },

  // --- שולחן עורך ---
  {
    id: 'shulchan-first-word',
    title: 'מילה ראשונה מוגדלת ומודגשת',
    category: 'שולחן עורך',
    description: 'עיצוב המילה הראשונה בפסקה בגופן מודגש או מוגדל',
    keywords: ['מילה ראשונה', 'שולחן עורך', 'פתיח', 'מודגשת', 'ראשונה'],
    icon: 'bold',
    command: { id: 'shulchan.first-word' },
  },
  {
    id: 'shulchan-unclosed',
    title: 'חיפוש סוגריים לא סגורים',
    category: 'שולחן עורך',
    description: 'בדיקה ואיתור סוגריים פתוחים ללא סגירה במסמך',
    keywords: ['סוגריים', 'סוגריים לא סגורים', 'שולחן עורך', 'הגהה'],
    icon: 'search',
    command: { id: 'shulchan.unclosed' },
  },
  {
    id: 'shulchan-uniform',
    title: 'יישור שורות אחיד (שולחן עורך)',
    category: 'שולחן עורך',
    description: 'יישור אורכי שורות בצורה מדויקת לספרי קודש',
    keywords: ['שורות', 'אחיד', 'יישור שורות', 'שולחן עורך'],
    icon: 'alignJustify',
    command: { id: 'shulchan.uniform' },
  },
];

/**
 * מזהי הפעולות המוצעות כברירת מחדל כאשר תיבת החיפוש ריקה.
 */
export const DEFAULT_SUGGESTED_IDS: readonly string[] = [
  'file-save',
  'edit-find',
  'edit-replace',
  'insert-table',
  'font-bold',
  'para-align-center',
  'insert-link',
  'view-focus-mode',
  'help-shortcuts',
];

/**
 * מנרמל מחרוזת עברית לחיפוש:
 * מסיר ניקוד, מוריד אותיות לועזיות לאותיות קטנות, ומסיר רווחים מיותרים.
 */
export function normalizeSearchTerm(text: string): string {
  return text
    .replace(/[\u0591-\u05C7]/g, '') // הסרת טעמים וניקוד
    .trim()
    .toLowerCase();
}

/**
 * מחפש ומדרג פעולות מתוך קטלוג ה-Tell Me.
 *
 * @param query שאילתת החיפוש של המשתמש
 * @param actions רשימת הפעולות לחיפוש (ברירת מחדל: TELL_ME_ACTIONS)
 * @returns רשימת פעולות ממוינת לפי ציון רלוונטיות
 */
export function searchTellMeActions(
  query: string,
  actions: readonly TellMeAction[] = TELL_ME_ACTIONS,
): TellMeAction[] {
  const normalized = normalizeSearchTerm(query);
  if (!normalized) {
    // כשאין שאילתה, מחזירים את הפעולות המוצעות לפי סדר ההגדרה שלהן
    const suggestedMap = new Map(actions.map((a) => [a.id, a]));
    return DEFAULT_SUGGESTED_IDS.map((id) => suggestedMap.get(id)).filter(
      (a): a is TellMeAction => Boolean(a),
    );
  }

  const queryWords = normalized.split(/\s+/).filter(Boolean);

  const scored: { action: TellMeAction; score: number }[] = [];

  for (const action of actions) {
    const titleNorm = normalizeSearchTerm(action.title);
    const categoryNorm = normalizeSearchTerm(action.category);
    const descNorm = action.description ? normalizeSearchTerm(action.description) : '';
    const keywordsNorm = action.keywords.map(normalizeSearchTerm);

    let score = 0;

    // התאמה מדויקת לכותרת
    if (titleNorm === normalized) {
      score += 120;
    } else if (titleNorm.startsWith(normalized)) {
      // תחילית של הכותרת
      score += 90;
    } else if (titleNorm.includes(normalized)) {
      // מוכלת בכותרת
      score += 60;
    }

    // בדיקת מילים בתוך הכותרת
    for (const qWord of queryWords) {
      if (titleNorm.split(/\s+/).some((w) => w.startsWith(qWord))) {
        score += 35;
      }
    }

    // מילות מפתח
    for (const kw of keywordsNorm) {
      if (kw === normalized) {
        score += 80;
      } else if (kw.startsWith(normalized)) {
        score += 50;
      } else if (kw.includes(normalized)) {
        score += 30;
      }
    }

    // קטגוריה
    if (categoryNorm.includes(normalized)) {
      score += 20;
    }

    // תיאור
    if (descNorm.includes(normalized)) {
      score += 15;
    }

    if (score > 0) {
      scored.push({ action, score });
    }
  }

  // מיון לפי ציון יורד
  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, 15).map((item) => item.action);
}
