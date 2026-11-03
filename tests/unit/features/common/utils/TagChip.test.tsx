import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { h, render } from 'preact';
import { TagChip, TagChipsList } from '../../../../../features/common/utils/tagInput';

describe('TagChip Preact Component', () => {
    let container: HTMLElement;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    afterEach(() => {
        render(null, container);
        container.remove();
    });

    it('renders tag text and triggers onRemove when remove button is clicked', () => {
        const handleRemove = jest.fn();
        render(<TagChip tag="Dynamic Programming" onRemove={handleRemove} />, container);

        const chipText = container.querySelector('.tag-chip-text');
        expect(chipText?.textContent).toBe('Dynamic Programming');

        const removeBtn = container.querySelector('.tag-chip-remove') as HTMLElement;
        expect(removeBtn).not.toBeNull();
        removeBtn.click();

        expect(handleRemove).toHaveBeenCalled();
    });

    it('renders a list of chips via TagChipsList', () => {
        const handleRemove = jest.fn();
        render(<TagChipsList tags={['Arrays', 'Binary Search']} onRemove={handleRemove} />, container);

        const chips = container.querySelectorAll('.tag-chip');
        expect(chips.length).toBe(2);
        expect(chips[0].textContent).toContain('Arrays');
        expect(chips[1].textContent).toContain('Binary Search');
    });
});

