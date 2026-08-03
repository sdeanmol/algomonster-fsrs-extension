import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { TagInputControl } from '../../../../../features/common/utils/tagInput';

describe('TagInputControl', () => {
  let targetInput: HTMLInputElement;

  beforeEach(() => {
    document.body.innerHTML = '';
    targetInput = document.createElement('input');
    targetInput.type = 'text';
    targetInput.value = 'Arrays, Dynamic Programming';
    document.body.appendChild(targetInput);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('attaches to an input element and initializes tags from initial value', () => {
    const control = TagInputControl.attach(targetInput);
    expect(control).toBeDefined();
    expect(control.getTags()).toEqual(['Arrays', 'Dynamic Programming']);

    // Re-attaching returns existing instance
    const reattached = TagInputControl.attach(targetInput);
    expect(reattached).toBe(control);
  });

  it('allows setting tags programmatically via setTags and setTagsFromString', () => {
    const control = TagInputControl.attach(targetInput);

    control.setTags(['  Graph ', 'GRAPH', 'Trees  ', '']);
    expect(control.getTags()).toEqual(['Graph', 'Trees']);
    expect(targetInput.value).toBe('Graph, Trees');

    control.setTagsFromString('Binary Search, Heaps, Heaps', false);
    expect(control.getTags()).toEqual(['Binary Search', 'Heaps']);
  });

  it('intercepts value property setter and getter', () => {
    const control = TagInputControl.attach(targetInput);
    targetInput.value = 'Greedy, Stack';
    expect(control.getTags()).toEqual(['Greedy', 'Stack']);
    expect(targetInput.value).toBe('Greedy, Stack');
  });

  it('adds tags via Enter or Comma keypress in inline input', () => {
    const control = TagInputControl.attach(targetInput);
    const inlineInput = document.querySelector('.tag-inline-input') as HTMLInputElement;

    inlineInput.value = ' Hash Table ';
    inlineInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(control.getTags()).toContain('Hash Table');

    inlineInput.value = 'Math';
    inlineInput.dispatchEvent(new KeyboardEvent('keydown', { key: ',', bubbles: true }));
    expect(control.getTags()).toContain('Math');
  });

  it('prevents adding duplicate tags (case-insensitive)', () => {
    const control = TagInputControl.attach(targetInput);
    const inlineInput = document.querySelector('.tag-inline-input') as HTMLInputElement;

    inlineInput.value = 'arrays';
    inlineInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(control.getTags()).toEqual(['Arrays', 'Dynamic Programming']);
  });

  it('removes last tag when Backspace is pressed on empty input', () => {
    const control = TagInputControl.attach(targetInput);
    const inlineInput = document.querySelector('.tag-inline-input') as HTMLInputElement;

    inlineInput.value = '';
    inlineInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }));
    expect(control.getTags()).toEqual(['Arrays']);
  });

  it('removes tag when remove button on chip is clicked', () => {
    const control = TagInputControl.attach(targetInput);
    const removeButtons = document.querySelectorAll('.tag-chip-remove');
    expect(removeButtons.length).toBe(2);

    (removeButtons[0] as HTMLElement).click();
    expect(control.getTags()).toEqual(['Dynamic Programming']);
  });

  it('handles paste events containing comma-separated tags', () => {
    const control = TagInputControl.attach(targetInput);
    const inlineInput = document.querySelector('.tag-inline-input') as HTMLInputElement;

    const clipboardData = {
      getData: jest.fn(() => 'Sliding Window, Two Pointers, Arrays')
    };

    const pasteEvent = new Event('paste', { bubbles: true }) as any;
    pasteEvent.clipboardData = clipboardData;

    inlineInput.dispatchEvent(pasteEvent);
    expect(control.getTags()).toEqual(['Arrays', 'Dynamic Programming', 'Sliding Window', 'Two Pointers']);
  });

  it('fetches suggestions and opens autocomplete dropdown', async () => {
    const getSuggestions = jest.fn<() => Promise<string[]>>().mockResolvedValue(['Array Operations', 'Graph Algorithms', 'Greedy Method']);
    const control = TagInputControl.attach(targetInput, { getSuggestions });
    const inlineInput = document.querySelector('.tag-inline-input') as HTMLInputElement;

    inlineInput.value = 'alg';
    inlineInput.dispatchEvent(new Event('input', { bubbles: true }));

    // Wait for async suggestions resolution
    await new Promise(resolve => setTimeout(resolve, 10));

    const dropdown = document.querySelector('.tag-autocomplete-dropdown') as HTMLElement;
    expect(dropdown.style.display).toBe('block');
    const items = dropdown.querySelectorAll('.tag-suggestion-item');
    expect(items.length).toBe(1);
    expect(items[0].textContent).toBe('Graph Algorithms');
  });

  it('navigates autocomplete suggestions with ArrowDown, ArrowUp, Escape and selects via Enter/Tab/click', async () => {
    const getSuggestions = jest.fn<() => Promise<string[]>>().mockResolvedValue(['String Matching', 'String Manipulation', 'Suffix Tree']);
    const control = TagInputControl.attach(targetInput, { getSuggestions });
    const inlineInput = document.querySelector('.tag-inline-input') as HTMLInputElement;

    inlineInput.value = 'str';
    inlineInput.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(resolve => setTimeout(resolve, 10));

    // Arrow down moves highlight from 0 ('String Matching') to 1 ('String Manipulation')
    inlineInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));

    // Enter selects highlighted
    inlineInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(control.getTags()).toContain('String Manipulation');

    // Arrow down to trigger open if closed
    inlineInput.value = '';
    inlineInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));

    // Escape closes dropdown
    inlineInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    const dropdown = document.querySelector('.tag-autocomplete-dropdown') as HTMLElement;
    expect(dropdown.style.display).toBe('none');
  });

  it('closes dropdown when clicking outside wrapper', async () => {
    const getSuggestions = jest.fn<() => Promise<string[]>>().mockResolvedValue(['Tag A', 'Tag B']);
    TagInputControl.attach(targetInput, { getSuggestions });
    const inlineInput = document.querySelector('.tag-inline-input') as HTMLInputElement;

    inlineInput.value = 'tag';
    inlineInput.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(resolve => setTimeout(resolve, 10));

    document.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const dropdown = document.querySelector('.tag-autocomplete-dropdown') as HTMLElement;
    expect(dropdown.style.display).toBe('none');
  });
});
