/**
 * דיאלוג התיקון האוטומטי: עריכה על עותק, ושמירה רק באישור.
 */
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import AutoCorrectDialog from '../../src/ui/panels/AutoCorrectDialog.vue';
import { DEFAULT_AUTOCORRECT, DEFAULT_REPLACEMENTS, type AutoCorrectOptions } from '../../src/engine/autocorrect';

function open(options: AutoCorrectOptions = DEFAULT_AUTOCORRECT) {
  return mount(AutoCorrectDialog, {
    props: { isOpen: true, options },
    attachTo: document.body,
  });
}

const dialog = () => document.body.querySelector('.acorr-dialog') as HTMLElement;
const inputs = () => [...dialog().querySelectorAll<HTMLInputElement>('.acorr-input')];
const buttonByText = (text: string) =>
  [...dialog().querySelectorAll<HTMLButtonElement>('.acorr-btn')].find((b) => b.textContent?.trim() === text)!;
const rows = () => [...dialog().querySelectorAll('.acorr-row')];

async function typeInto(input: HTMLInputElement, value: string) {
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  await Promise.resolve();
}

describe('AutoCorrectDialog', () => {
  it('מציג את הטבלה הקיימת ומתג לכל סוג תיקון', () => {
    const wrapper = open();

    expect(rows()).toHaveLength(DEFAULT_REPLACEMENTS.length);
    expect(dialog().querySelectorAll('.acorr-check input[type="checkbox"]').length).toBeGreaterThanOrEqual(9);
    wrapper.unmount();
  });

  it('הוספת רשומה: מופיעה בטבלה, והכפתור הופך ל„עדכן” כשהדפוס קיים', async () => {
    const wrapper = open();
    const [from, to] = inputs();

    await typeInto(from, 'teh');
    await typeInto(to, 'the');
    expect(buttonByText('הוסף')).toBeTruthy();
    buttonByText('הוסף').click();
    await wrapper.vm.$nextTick();

    expect(rows()).toHaveLength(DEFAULT_REPLACEMENTS.length + 1);
    expect(buttonByText('עדכן')).toBeTruthy();
    wrapper.unmount();
  });

  it('דפוס שאינו תקין מציג הודעה ואינו מוסיף', async () => {
    const wrapper = open();
    const [from] = inputs();

    await typeInto(from, ' x');
    buttonByText('הוסף').click();
    await wrapper.vm.$nextTick();

    expect(dialog().querySelector('.acorr-message')).not.toBeNull();
    expect(rows()).toHaveLength(DEFAULT_REPLACEMENTS.length);
    wrapper.unmount();
  });

  it('מחיקה: בחירת שורה ואז „מחק” מסירה אותה', async () => {
    const wrapper = open();

    (rows()[0] as HTMLButtonElement).click();
    await wrapper.vm.$nextTick();
    buttonByText('מחק').click();
    await wrapper.vm.$nextTick();

    expect(rows()).toHaveLength(DEFAULT_REPLACEMENTS.length - 1);
    wrapper.unmount();
  });

  it('אישור פולט עותק מעודכן, ואינו משנה את ההגדרות שהתקבלו', async () => {
    const wrapper = open();
    const [from, to] = inputs();
    await typeInto(from, 'teh');
    await typeInto(to, 'the');
    buttonByText('הוסף').click();
    await wrapper.vm.$nextTick();

    buttonByText('אישור').click();
    await wrapper.vm.$nextTick();

    const emitted = wrapper.emitted('apply')![0][0] as AutoCorrectOptions;
    expect(emitted.replacements).toContainEqual({ from: 'teh', to: 'the' });
    expect(DEFAULT_AUTOCORRECT.replacements).toBe(DEFAULT_REPLACEMENTS);
    wrapper.unmount();
  });

  it('ביטול סוגר בלי להחיל', async () => {
    const wrapper = open();

    buttonByText('ביטול').click();
    await wrapper.vm.$nextTick();

    expect(wrapper.emitted('apply')).toBeUndefined();
    expect(wrapper.emitted('close')).toBeTruthy();
    wrapper.unmount();
  });

  it('מתג ראשי כבוי מנטרל את שתי הקבוצות', async () => {
    const wrapper = open({ ...DEFAULT_AUTOCORRECT, enabled: false });

    const groups = [...dialog().querySelectorAll<HTMLFieldSetElement>('fieldset')];
    expect(groups.length).toBe(2);
    expect(groups.every((group) => group.disabled)).toBe(true);
    wrapper.unmount();
  });

  it('פתיחה מחדש מאפסת טיוטה שלא אושרה', async () => {
    const wrapper = open();
    const [from] = inputs();
    await typeInto(from, 'abc');

    await wrapper.setProps({ isOpen: false });
    await wrapper.setProps({ isOpen: true });

    expect(inputs()[0].value).toBe('');
    wrapper.unmount();
  });
});
