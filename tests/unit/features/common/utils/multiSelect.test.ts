import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { MultiSelectControl } from '../../../../../features/common/utils/multiSelect';

describe('MultiSelectControl', () => {
    let selectEl: HTMLSelectElement;

    beforeEach(() => {
        document.body.innerHTML = '';
        selectEl = document.createElement('select');
        selectEl.id = 'test-select';
        selectEl.innerHTML = `
            <option value="all">All Tags</option>
            <option value="id-1">Arrays</option>
            <option value="id-2">Binary Search</option>
            <option value="id-3">Dynamic Programming</option>
        `;
        document.body.appendChild(selectEl);
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('attaches to a select element, hides it, and renders trigger button', () => {
        const control = MultiSelectControl.attach(selectEl, { placeholder: 'All Tags' });
        expect(selectEl.style.display).toBe('none');
        const trigger = document.querySelector('.multi-select-trigger') as HTMLButtonElement;
        expect(trigger).not.toBeNull();
        expect(trigger.textContent).toContain('All Tags');
        expect(MultiSelectControl.attach(selectEl)).toBe(control);
    });

    it('filters options by search query and toggles multi-selection', () => {
        const onChange = jest.fn();
        const control = MultiSelectControl.attach(selectEl, {
            placeholder: 'All Tags',
            onChange
        });

        const trigger = document.querySelector('.multi-select-trigger') as HTMLButtonElement;
        trigger.click();

        const searchInput = document.querySelector('.multi-select-search') as HTMLInputElement;
        searchInput.value = 'bin';
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));

        const visibleOptions = Array.from(document.querySelectorAll('.multi-select-option'))
            .filter(el => (el as HTMLElement).style.display !== 'none');
        expect(visibleOptions).toHaveLength(1);
        expect(visibleOptions[0].textContent).toContain('Binary Search');

        // Clear search and select two options
        searchInput.value = '';
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));

        const checkboxes = document.querySelectorAll('.multi-select-option input[type="checkbox"]') as NodeListOf<HTMLInputElement>;
        checkboxes[0].click();
        checkboxes[1].click();

        expect(control.getSelectedValues()).toEqual(['id-1', 'id-2']);
        expect(trigger.textContent).toContain('2 selected');
        expect(onChange).toHaveBeenLastCalledWith(['id-1', 'id-2']);
    });

    it('clears selections and refreshes options dynamically', () => {
        const onChange = jest.fn();
        const control = MultiSelectControl.attach(selectEl, {
            placeholder: 'All Tags',
            onChange
        });

        control.setSelectedValues(['id-1', 'id-3'], false);
        expect(control.getSelectedValues()).toEqual(['id-1', 'id-3']);

        const clearBtn = document.querySelector('.multi-select-clear-btn') as HTMLButtonElement;
        clearBtn.click();
        expect(control.getSelectedValues()).toEqual([]);
        expect(onChange).toHaveBeenLastCalledWith([]);

        // Dynamically repopulate underlying select
        control.setSelectedValues(['id-2'], false);
        selectEl.innerHTML = `
            <option value="all">All Tags</option>
            <option value="id-2">Binary Search</option>
            <option value="id-4">Graphs</option>
        `;
        control.refreshOptions();

        expect(control.getSelectedValues()).toEqual(['id-2']);
        const optionLabels = Array.from(document.querySelectorAll('.multi-select-option')).map(el => el.textContent?.trim());
        expect(optionLabels).toEqual(['Binary Search', 'Graphs']);
    });
});
