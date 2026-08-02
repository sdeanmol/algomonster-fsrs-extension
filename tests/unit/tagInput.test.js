import { TagInputControl } from '../../features/common/utils/tagInput';

describe('TagInputControl', () => {
    let inputEl;

    beforeEach(() => {
        document.body.innerHTML = `
            <div>
                <input type="text" id="fsrs-tags-input" value="Array, Dynamic Programming" />
            </div>
        `;
        inputEl = document.getElementById('fsrs-tags-input');
    });

    it('attaches to HTMLInputElement and initializes chip pills from existing value', () => {
        const control = TagInputControl.attach(inputEl);
        expect(control.getTags()).toEqual(['Array', 'Dynamic Programming']);

        const wrapper = document.querySelector('.tag-input-wrapper');
        expect(wrapper).not.toBeNull();

        const chips = document.querySelectorAll('.tag-chip');
        expect(chips.length).toBe(2);
        expect(chips[0].textContent).toContain('Array');
        expect(chips[1].textContent).toContain('Dynamic Programming');
    });

    it('updates tags when setting inputEl.value property programmatically', () => {
        const control = TagInputControl.attach(inputEl);
        inputEl.value = 'Linked List, Two Pointers';

        expect(control.getTags()).toEqual(['Linked List', 'Two Pointers']);
        const chips = document.querySelectorAll('.tag-chip');
        expect(chips.length).toBe(2);
        expect(chips[0].textContent).toContain('Linked List');
    });

    it('returns comma separated tags when reading inputEl.value property', () => {
        const control = TagInputControl.attach(inputEl);
        control.setTags(['Graph', 'BFS']);

        expect(inputEl.value).toBe('Graph, BFS');
    });

    it('adds new tag on Enter keydown in inline input', () => {
        const control = TagInputControl.attach(inputEl);
        const inlineInput = document.querySelector('.tag-inline-input');

        inlineInput.value = 'Greedy';
        inlineInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

        expect(control.getTags()).toContain('Greedy');
        expect(inputEl.value).toContain('Greedy');
    });

    it('removes tag on remove button click', () => {
        const control = TagInputControl.attach(inputEl);
        const removeBtns = document.querySelectorAll('.tag-chip-remove');
        removeBtns[0].click();

        expect(control.getTags()).toEqual(['Dynamic Programming']);
        expect(inputEl.value).toBe('Dynamic Programming');
    });

    it('filters database suggestions for autocomplete', async () => {
        const mockSuggestions = ['Array', 'Binary Search', 'Bit Manipulation', 'Backtracking'];
        const control = TagInputControl.attach(inputEl, {
            getSuggestions: () => mockSuggestions
        });

        const inlineInput = document.querySelector('.tag-inline-input');
        inlineInput.value = 'Bit';
        inlineInput.dispatchEvent(new Event('input', { bubbles: true }));

        // Wait microtask
        await Promise.resolve();

        const dropdown = document.querySelector('.tag-autocomplete-dropdown');
        expect(dropdown.style.display).toBe('block');
        const items = dropdown.querySelectorAll('.tag-suggestion-item');
        expect(items.length).toBe(1);
        expect(items[0].textContent).toBe('Bit Manipulation');
    });
});
