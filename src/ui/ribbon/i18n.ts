/**
 * שפת התפריטים (הרצועה) לפי שפת המשתמש.
 *
 * אוצריא מדווחת את שפת המשתמש ב־`plugin.boot`: `app.language` הוא קוד השפה
 * בלבד (`'he'` / `'en'`) ו־`app.locale` התג המלא (`'he-IL'`) — ראו
 * docs/plugin-sdk (BootPayload.app). `setMenuLocale` נקראת מ־main.ts ברגע
 * שה־payload מגיע, ומאז כל מחרוזת שעוברת דרך `menuString` מוצגת באנגלית
 * כששפת המשתמש אנגלית, ובעברית בכל יתר המקרים.
 *
 * שתי החלטות עיצוב:
 *
 * 1. **התרגום בנקודת התצוגה, לא במקור.** לשוניות הרצועה ממשיכות להכיל את
 *    המחרוזות העבריות המקוריות, והתרגום קורה ברכיבי הבסיס שמציגים אותן
 *    (RibbonButton, RibbonMenuButton, RibbonGroup, RibbonSelect,
 *    StyleGallery, TablePicker, ColorPickerPopover ו־Ribbon.vue). כך עבודת
 *    התפריטים והמקור עצמם אינם משתנים — רק מה שמוצג. ברירת המחדל `'he'`
 *    מחזירה כל מחרוזת כמו שהיא, ולכן בהרכבות הבדיקות (שפת stub הפיתוח
 *    היא `'he'`) לא משתנה דבר.
 *
 * 2. **מילון מהעברית לאנגלית, עם נפילה חזרה למקור.** מחרוזת שאינה במילון
 *    מוצגת בעברית — תרגום חסר אינו יכול לשבור כלום.
 */

import { ref } from 'vue';

export type MenuLocale = 'he' | 'en';

const locale = ref<MenuLocale>('he');

/**
 * קביעת שפת התפריטים מקוד שפה או מתג מלא.
 *
 * רק `'en…'` מתרגם לאנגלית; כל יתר הערכים (כולל `'he-IL'`, `undefined`,
 * וכשל אתחול) משאירים עברית — שפת המקור של התוסף.
 */
export function setMenuLocale(language: string | null | undefined): void {
  const code = (language ?? '').toLowerCase().split(/[-_]/)[0];
  locale.value = code === 'en' ? 'en' : 'he';
}

/** התרגומים לאנגלית, לפי מחרוזת המקור העברית. */
const EN: Readonly<Record<string, string>> = {
  // ── לשוניות (Ribbon.vue) ───────────────────────────────────────────
  'קובץ': 'File',
  'בית': 'Home',
  'הוספה': 'Insert',
  'פריסה': 'Layout',
  'הפניות': 'References',
  'סקירה': 'Review',
  'תצוגה': 'View',
  '✦ אוצריא': '✦ Otzaria',
  'לשוניות הרצועה': 'Ribbon tabs',
  'הצג את הרצועה': 'Show the ribbon',
  'כווץ את הרצועה': 'Collapse the ribbon',

  // ── לשונית „קובץ” ──────────────────────────────────────────────────
  'קובץ ומסמך': 'File & Document',
  'מסמך חדש': 'New Document',
  'יצירת מסמך Word ריק חדש': 'Create a new blank Word document',
  'פתח קובץ': 'Open File',
  'פתיחת מסמך Word (.docx) מהמחשב': 'Open a Word (.docx) document from the computer',
  'שמירה': 'Save',
  'שמור': 'Save',
  'שמירת שינויים במסמך': 'Save changes to the document',
  'שמור בשם...': 'Save As...',
  'שמירת המסמך כקובץ חדש': 'Save the document as a new file',
  'ייצוא והדפסה': 'Export & Print',
  'ייצוא ל-Word': 'Export to Word',
  'הורדת קובץ .docx תואם Microsoft Word': 'Download a Microsoft Word-compatible .docx file',
  'הדפסה': 'Print',
  'הדפסת המסמך': 'Print the document',
  'יציאה': 'Exit',
  'חזרה למסך הספרייה של אוצריא; המסמך יישאר פתוח':
    'Return to the Otzaria library screen; the document stays open',
  'אין מסמך פתוח': 'No open document',
  'השמירה רצה כרגע — רגע אחד': 'Saving is in progress — one moment',
  'פתיחת מסמך רצה כרגע': 'Opening a document is in progress',
  'מידע': 'Info',
  'אודות': 'About',
  'אודות עורך Word לאוצריא': 'About the Word Editor for Otzaria',
  'קיצורים': 'Shortcuts',
  'רשימת קיצורי המקלדת': 'List of keyboard shortcuts',

  // ── לשונית „בית” ───────────────────────────────────────────────────
  'לוח': 'Clipboard',
  'הדבק': 'Paste',
  'הדבקת תוכן מהלוח': 'Paste content from the clipboard',
  'גזור': 'Cut',
  'גזירת הבחירה ללוח': 'Cut the selection to the clipboard',
  'העתק': 'Copy',
  'העתקת הבחירה ללוח': 'Copy the selection to the clipboard',
  'מברשת עיצוב': 'Format Painter',
  'העתק עיצוב ממקום אחד והחל במקום אחר':
    'Copy formatting from one place and apply it elsewhere',
  'גופן': 'Font',
  'גודל גופן': 'Font Size',
  'הגדל גופן': 'Increase Font Size',
  'הקטן גופן': 'Decrease Font Size',
  'נקה את כל העיצוב': 'Clear All Formatting',
  'מתקדם': 'Advanced',
  'גופן מתקדם: ריווח תווים, מיקום, אפקטים וגופן מורכב':
    'Advanced font: character spacing, position, effects and complex-script font',
  'מודגש': 'Bold',
  'נטוי': 'Italic',
  'קו תחתון': 'Underline',
  'קו חוצה': 'Strikethrough',
  'צבע סימון טקסט': 'Text Highlight Color',
  'צבע גופן': 'Font Color',
  'פיסקה': 'Paragraph',
  'תבליטים': 'Bullets',
  'מספור': 'Numbering',
  'הקטן הזחה': 'Decrease Indent',
  'הגדל הזחה': 'Increase Indent',
  'רשימה': 'List',
  'התחל מחדש מ-1': 'Restart at 1',
  'המשך מספור קודם': 'Continue previous numbering',
  'המר לטקסט…': 'Convert to text…',
  'לחץ שוב לאישור — הפעולה בלתי-הפיכה':
    'Click again to confirm — this action cannot be undone',
  'פעולות רשימה: סגנון מספור (כולל עברי), התחלה מחדש והמרה לטקסט':
    'List actions: numbering style (including Hebrew), restart, and convert to text',
  'כיוון פסקה מימין לשמאל': 'Paragraph direction right-to-left',
  'כיוון פסקה משמאל לימין': 'Paragraph direction left-to-right',
  'הצג/הסתר סימני עיצוב': 'Show/Hide formatting marks',
  'יישור לימין': 'Align Right',
  'מרכז': 'Center',
  'יישור לשמאל': 'Align Left',
  'יישור לשני הצדדים': 'Justify',
  'מרווח בין שורות': 'Line Spacing',
  'תפריט פסקה: כניסות, ריווח ועצירות טאב': 'Paragraph dialog: indents, spacing and tab stops',
  'סגנונות': 'Styles',
  'עריכה': 'Editing',
  'חפש': 'Find',
  'חיפוש טקסט במסמך': 'Search text in the document',
  'החלפה': 'Replace',
  'החלפת טקסט במסמך': 'Replace text in the document',
  'בחר הכל': 'Select All',
  'בחירת כל הטקסט במסמך': 'Select all text in the document',
  'הרמת הטקסט המסומן לכתב עליון; לחיצה נוספת מחזירה אותו לשורה':
    'Raise the selected text to superscript; clicking again restores it inline',
  'הנמכת הטקסט המסומן לכתב תחתי; לחיצה נוספת מחזירה אותו לשורה':
    'Lower the selected text to subscript; clicking again restores it inline',

  // ── לשונית „הוספה” ─────────────────────────────────────────────────
  'טבלאות': 'Tables',
  'טבלה': 'Table',
  'הוספת טבלה': 'Insert table',
  'הוסף טבלה': 'Add table',
  'בחירת מידות הטבלה': 'Choose table dimensions',
  'עמודה אחת': 'one column',
  'עמודות': 'columns',
  'שורה אחת': 'one row',
  'שורות': 'rows',
  'על': 'by',
  'איורים': 'Illustrations',
  'הוספת תמונה מקובץ (PNG או JPEG)': 'Insert a picture from a file (PNG or JPEG)',
  'התמונה נוספת למסמך…': 'Picture added to the document…',
  'בחירת התמונה נכשלה': 'Picture selection failed',
  'לא ניתן להטמיע את התמונה הזאת במסמך':
    'This picture cannot be embedded in the document',
  'קישורים': 'Links',
  'קישור': 'Link',
  'הוספת היפר-קישור לכתובת אינטרנט או לדואר':
    'Insert a hyperlink to a web address or e-mail',
  'הסר קישור': 'Remove Link',
  'הסרת ההיפר-קישור מהטקסט המסומן (הטקסט נשמר)':
    'Remove the hyperlink from the selected text (the text is kept)',
  'כותרת עליונה': 'Header',
  'כותרת תחתונה': 'Footer',
  'עריכת כותרת עליונה': 'Edit header',
  'עריכת כותרת תחתונה': 'Edit footer',
  'הסרת כותרת עליונה': 'Remove header',
  'הסרת כותרת תחתונה': 'Remove footer',
  'יוצר כותרת ריקה אם עדיין אין': 'Creates an empty one if there isn’t yet',
  'מוחק את הכותרת מכל המסמך': 'Deletes it from the entire document',
  'יצירת כותרת עליונה ריקה. לעריכתה — לחיצה כפולה על אזור הכותרת':
    'Creates an empty header. Double-click the header area to edit it',
  'יצירת כותרת תחתונה ריקה. לעריכתה — לחיצה כפולה על אזור הכותרת':
    'Creates an empty footer. Double-click the footer area to edit it',
  'למסמך יש כותרת עליונה. לחיצה כפולה על אזור הכותרת פותחת אותה לעריכה':
    'The document has a header. Double-click the header area to edit it',
  'למסמך יש כותרת תחתונה. לחיצה כפולה על אזור הכותרת פותחת אותה לעריכה':
    'The document has a footer. Double-click the footer area to edit it',
  'טקסט': 'Text',
  'מספר עמוד': 'Page Number',
  'הכנסת שדה מספר עמוד במקום הסמן': 'Insert a page number field at the cursor',
  'מספר העמודים במסמך': 'Number of pages in the document',
  'מתעדכן לפי העמוד שהשדה נמצא בו': 'Updates according to the page the field is on',
  'לצירוף „עמוד X מתוך Y” יש להקליד את המילים ולהוסיף את שני השדות':
    'For “Page X of Y”, type the words and insert both fields',
  'תאריך ושעה': 'Date & Time',
  'הכנסת שדה תאריך שמתעדכן, בפורמט יום/חודש/שנה':
    'Insert an auto-updating date field, in day/month/year format',
  'עדכן שדות': 'Update Fields',
  'חישוב מחדש של כל השדות במסמך, כמו F9 ב-Word':
    'Recalculate all fields in the document, like F9 in Word',
  'אין במסמך שדות לעדכן': 'There are no fields in the document to update',
  'סימנייה': 'Bookmark',
  'סימון הפסקה שבה הסמן בשם, לניווט ולהפניות מתוך Word':
    'Mark the paragraph where the cursor is with a name, for navigation and cross-references from Word',
  'התחל בעמוד חדש': 'Page Break',
  'הפסקה שבה הסמן תתחיל בראש עמוד חדש':
    'The paragraph where the cursor will start at the top of a new page',

  // ── לשונית „פריסה” ─────────────────────────────────────────────────
  'הגדרת עמוד': 'Page Setup',
  'שוליים': 'Margins',
  'הגדרת שולי הדף (רגיל, צר, רחב)': 'Set the page margins (normal, narrow, wide)',
  'כיוון': 'Orientation',
  'כיוון הדף: לאורך או לרוחב': 'Page orientation: portrait or landscape',
  'גודל': 'Size',
  'בחירת גודל נייר (A4, Letter)': 'Choose paper size (A4, Letter)',
  'פיצול הטקסט לשתי עמודות או יותר': 'Split the text into two or more columns',
  'מקטע': 'Section',
  'אין במסמך מקטע נוסף — הקישור נוגע רק במקטעים שאחרי הראשון':
    'There is no additional section — linking only affects sections after the first',
  'הכותרות של המקטעים הבאים יהיו זהות לאלה של המקטע שלפניהם':
    'The headers of the following sections will match those of the section before them',
  'גבולות עמוד': 'Page Borders',
  'מסגרת סביב העמוד': 'A border around the page',
  'מספרי שורות': 'Line Numbers',
  'מספור השורות בשולי הדף': 'Number the lines in the page margin',
  'מספור עמודים': 'Page Numbering',
  'תבנית מספרי העמודים ומספר ההתחלה': 'The page number format and starting number',
  'יישור אנכי': 'Vertical Alignment',
  'מיקום הטקסט בגובה העמוד': 'Positioning of the text along the page height',
  'ברירות מחדל': 'Defaults',
  'גופן וגודל ברירת המחדל של המסמך כולו': 'Default font and size for the whole document',
  'עמודים': 'Pages',
  'כותרת עליונה ותחתונה': 'Header & Footer',
  'מרחק הכותרת': 'Header Distance',
  'מרחק הכותרת העליונה והתחתונה מקצה הדף':
    'Distance of the header and footer from the edge of the page',
  'שונה בעמוד ראשון': 'Different First Page',
  'לעמוד הראשון תהיה כותרת משלו': 'The first page will have its own header',
  'שונה בעמודים זוגיים ואי-זוגיים': 'Different Odd & Even Pages',
  'כותרת אחת לעמודים הזוגיים ואחרת לאי-זוגיים':
    'One header for even pages and another for odd pages',

  // ── לשונית „הפניות” ────────────────────────────────────────────────
  'תוכן עניינים': 'Table of Contents',
  'יצירת תוכן עניינים אוטומטי': 'Create an automatic table of contents',
  'הוספת תוכן עניינים למסמך': 'Insert a table of contents into the document',
  'סמן ערך': 'Mark Entry',
  'סימון טקסט שייכנס לתוכן העניינים': 'Mark text to be included in the table of contents',
  'עדכן טבלה': 'Update Table',
  'בניית תוכן העניינים מחדש מהכותרות שבמסמך':
    'Rebuild the table of contents from the headings in the document',
  'אין במסמך תוכן עניינים לעדכן': 'There is no table of contents in the document to update',
  'התאמה אישית': 'Customize',
  'רמות הכותרות שייכללו, והאם הערכים יהיו קישורים':
    'Which heading levels to include, and whether entries will be links',
  'אין במסמך תוכן עניינים להתאים':
    'There is no table of contents in the document to customize',
  'הסר': 'Remove',
  'מחיקת תוכן העניינים מהמסמך': 'Delete the table of contents from the document',
  'אין במסמך תוכן עניינים להסיר': 'There is no table of contents in the document to remove',
  'הערות שוליים': 'Footnotes',
  'הערת שוליים': 'Footnote',
  'הוספת הערת שוליים בתחתית העמוד': 'Insert a footnote at the bottom of the page',
  'הערת סיום': 'Endnote',
  'הוספת הערת סיום בסוף המסמך': 'Insert an endnote at the end of the document',
  'נהל הערות': 'Manage Notes',
  'עריכה והסרה של הערות השוליים והערות הסיום שבמסמך':
    'Edit and remove the footnotes and endnotes in the document',
  'אין במסמך הערות לנהל': 'There are no notes in the document to manage',
  'פעולה על הערה עדיין בעבודה — ההוספה תיפתח כשהיא תסתיים':
    'A note operation is still running — management opens when it finishes',
  'הפניות מקושרות': 'Cross-references',
  'עדכן הפניות': 'Update References',
  'חישוב מחדש של ההפניות המקושרות במסמך':
    'Recalculate the linked references in the document',
  'אין במסמך הפניות מקושרות לעדכן':
    'There are no linked references in the document to update',
  'מפתח': 'Index',
  'סמן ערך למפתח': 'Mark Index Entry',
  'סימון הטקסט שנבחר כערך במפתח': 'Mark the selected text as an index entry',
  'הוסף מפתח': 'Insert Index',
  'הוספת מפתח הערכים בסוף המסמך': 'Insert the index at the end of the document',
  'עדכן מפתח': 'Update Index',
  'בניית המפתח מחדש מהערכים שסומנו במסמך':
    'Rebuild the index from the entries marked in the document',
  'אין במסמך מפתח לעדכן': 'There is no index in the document to update',
  'הגדרות מפתח': 'Index Settings',
  'מספר הטורים של המפתח, והאם תת-הערכים רצופים':
    'The index column count, and whether sub-entries run on',
  'אין במסמך מפתח להתאים': 'There is no index in the document to customize',
  'הסר מפתח': 'Remove Index',
  'מחיקת המפתח מהמסמך. הערכים שסומנו נשארים':
    'Delete the index from the document. Marked entries remain',
  'אין במסמך מפתח להסיר': 'There is no index in the document to remove',
  'ציטוטים וביבליוגרפיה': 'Citations & Bibliography',
  'ציטוט מהקורא': 'Citation from the Reader',
  'הכנסת הקטע המסומן בקורא של אוצריא, עם המקור, במיקום הסמן':
    'Insert the passage selected in the Otzaria reader, with its source, at the cursor',
  'יש לפתוח מסמך שאפשר לכתוב בו': 'Open a writable document first',
  'הוסף ציטוט': 'Add Citation',
  'הוספת ציטוט למקור במקום הסמן': 'Insert a citation to a source at the cursor',
  'נהל מקורות': 'Manage Sources',
  'הוספה, עריכה ומחיקה של המקורות שבמסמך':
    'Add, edit, and delete the sources in the document',
  'ביבליוגרפיה': 'Bibliography',
  'הוספת רשימת המקורות בסוף המסמך': 'Insert the list of sources at the end of the document',
  'עדכן ביבליוגרפיה': 'Update Bibliography',
  'בניית הביבליוגרפיה מחדש מהמקורות שבמסמך':
    'Rebuild the bibliography from the sources in the document',
  'אין במסמך ביבליוגרפיה לעדכן': 'There is no bibliography in the document to update',
  'הסר ביבליוגרפיה': 'Remove Bibliography',
  'מחיקת הביבליוגרפיה מהמסמך. המקורות עצמם נשארים':
    'Delete the bibliography from the document. The sources themselves remain',
  'אין במסמך ביבליוגרפיה להסיר': 'There is no bibliography in the document to remove',
  'כיתובים': 'Captions',
  'הוסף כיתוב': 'Insert Caption',
  'הוספת כיתוב ממוספר לתמונה, לטבלה או לתרשים':
    'Insert a numbered caption for a picture, table, or chart',
  'המסמך עדיין נטען': 'The document is still loading',
  // ── לשונית „סקירה” ─────────────────────────────────────────────────
  'הגהה': 'Proofing',
  'בדיקת איות': 'Spelling Check',
  'בדיקת איות בעברית — תתווסף עם המילון התורני, בשלב נפרד':
    'Hebrew spelling check — will be added with the Torah dictionary, in a separate phase',
  'תגובה חדשה': 'New Comment',
  'הוספת תגובה — תתווסף בשלב הבא, יחד עם זהות המחבר ופאנל התגובות':
    'Adding comments — coming in the next phase, together with author identity and the comments panel',
  'תגובות': 'Comments',
  'מעקב אחר שינויים': 'Tracking',
  'עקוב אחר שינויים': 'Track Changes',
  'כיבוי מצב מעקב אחר שינויים': 'Turn off track changes',
  'הפעלת מצב מעקב אחר שינויים במסמך': 'Turn on track changes for the document',
  'שינויים': 'Changes',
  'קבל שינוי': 'Accept Change',
  'קבלת השינוי הנוכחי': 'Accept the current change',
  'דחה שינוי': 'Reject Change',
  'דחיית השינוי הנוכחי': 'Reject the current change',
  'קבל את כל השינויים': 'Accept All Changes',
  'קבלת כל השינויים במסמך': 'Accept all changes in the document',
  'דחה את כל השינויים': 'Reject All Changes',
  'דחיית כל השינויים במסמך': 'Reject all changes in the document',
  'הגנה': 'Protection',
  'הגבל עריכה': 'Restrict Editing',
  'הפעולה מתבצעת…': 'The operation is in progress…',
  'לחץ שוב לאישור: המסמך יינעל לקריאה בלבד (ניתן לביטול מכאן)':
    'Click again to confirm: the document will be locked to read-only (can be undone here)',
  'ביטול ההגבלה — המסמך יחזור לעריכה מלאה':
    'Remove restriction — the document returns to full editing',
  'הצג את המסמך במצב „קריאה בלבד". ניתן לבטל מכאן בכל עת.':
    'View the document in “read-only” mode. Can be undone here at any time.',

  // ── לשונית „תצוגה” ─────────────────────────────────────────────────
  'תצוגות': 'Views',
  'מצב מיקוד': 'Focus Mode',
  'מצב קריאה ומיקוד ללא הסחות דעת': 'Reading and focus mode without distractions',
  'סרגל': 'Ruler',
  'הצג או הסתר את סרגל המידות': 'Show or hide the ruler',
  'סימני עיצוב': 'Formatting Marks',
  'הצג סימני פסקאות ותווים נסתרים': 'Show paragraph marks and hidden characters',
  'גודל אמיתי': 'Actual Size',
  'הצג את המסמך בגודלו האמיתי (100%)': 'View the document at actual size (100%)',
  'שינוי גודל תצוגה': 'Zoom',
  'התאם את תצוגת העמוד לרוחב החלון': 'Fit the page view to the window width',
  'רוחב עמוד': 'Page Width',

  // ── לשונית „אוצריא” ────────────────────────────────────────────────
  'אוצריא': 'Otzaria',
  'פתח ספרייה': 'Open Library',
  'פתיחת ספריית הספרים של אוצריא': 'Open the Otzaria book library',
  'זמין רק כשהעורך פועל בתוך אוצריא': 'Available only when the editor runs inside Otzaria',
  'חיפוש באוצריא': 'Search in Otzaria',
  'חיפוש הטקסט המסומן במסמך בכל ספריות אוצריא':
    'Search the selected text in all Otzaria libraries',
  'יש לפתוח מסמך ולסמן בו את הטקסט לחיפוש':
    'Open a document and select the text to search',
  'סגנון תורני': 'Torah Style',
  'חידוש': 'Chiddush',
  'קושיא': 'Kushya',
  'תירוץ': 'Terutz',
  'סגנונות תורניים יתווספו בשלב הבא — אין למנוע דרך ציבורית ליצור סגנון פסקה חדש במסמך':
    'Torah styles will be added in a later phase — the engine has no public way to create a new paragraph style in the document',

  // ── בורר הצבעים (ColorPickerPopover) ───────────────────────────────
  'בחירת צבע': 'Pick a color',
  'ללא צבע': 'No color',
  'צבעי ערכת נושא': 'Theme Colors',
  'צבעים רגילים': 'Standard Colors',
  'צבעים נוספים...': 'More colors...',

  // ── גלריית הסגנונות (StyleGallery / engine/style-gallery) ─────────
  'רגיל': 'Normal',
  'ללא מרווח': 'No Spacing',
  'גוף טקסט': 'Body Text',
  'כותרת': 'Title',
  'כותרת משנה': 'Subtitle',
  'כותרת 1': 'Heading 1',
  'כותרת 2': 'Heading 2',
  'כותרת 3': 'Heading 3',
  'כותרת 4': 'Heading 4',
  'כותרת 5': 'Heading 5',
  'כותרת 6': 'Heading 6',
  'כותרת 7': 'Heading 7',
  'כותרת 8': 'Heading 8',
  'כותרת 9': 'Heading 9',
  'ציטוט': 'Quote',
  'ציטוט מודגש': 'Intense Quote',
  'פסקת רשימה': 'List Paragraph',
  'כתובית': 'Caption',
  'חזק': 'Strong',
  'הדגשה': 'Emphasis',
  'הדגשה עדינה': 'Subtle Emphasis',
  'הדגשה מודגשת': 'Intense Emphasis',
  'הפניה עדינה': 'Subtle Reference',
  'הפניה מודגשת': 'Intense Reference',
  'שם ספר': 'Book Title',
  'טקסט הערת שוליים': 'Footnote Text',
  'טקסט הערת סיום': 'Endnote Text',
  'טקסט הערה': 'Comment Text',
  'היפר-קישור': 'Hyperlink',
  'הסגנונות הקודמים': 'Previous styles',
  'הסגנונות הבאים': 'Next styles',
};

/**
 * המחרוזת שתוצג: התרגום לאנגלית כששפת המשתמש אנגלית, ואחרת המקור העברי.
 *
 * נקראת מהתבניות ומה־computed של רכיבי הרצועה; הקריאה קוראת את `locale`
 * בתוך ה-render, ולכן הממשק מתעדכן גם אם השפה תיקבע אחרי ההרכבה הראשונה.
 */
export function menuString(hebrew: string): string {
  if (locale.value !== 'en') return hebrew;
  return EN[hebrew] ?? hebrew;
}
