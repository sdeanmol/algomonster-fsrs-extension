import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { h, render } from 'preact';
import { ColorFilterBubbles, HighlightCardView } from '../../../../../features/highlighter/manager/highlights';
import { HighlightMark } from '../../../../../types/domain';

describe('Highlights Preact Components', () => {
    let container: HTMLElement;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    afterEach(() => {
        render(null, container);
        container.remove();
    });

    it('renders color filter bubbles with active state and triggers toggle', () => {
        const handleToggle = jest.fn();
        render(
            <ColorFilterBubbles
                colors={['#f1c40f', '#e74c3c']}
                activeColor="#f1c40f"
                onToggleColor={handleToggle}
            />,
            container
        );

        const bubbles = container.querySelectorAll('.color-filter-bubble');
        expect(bubbles.length).toBe(2);
        expect(bubbles[0].classList.contains('active')).toBe(true);
        expect(bubbles[1].classList.contains('active')).toBe(false);

        (bubbles[1] as HTMLElement).click();
        expect(handleToggle).toHaveBeenCalledWith('#e74c3c');
    });

    it('renders highlight card with snippet, note, copy and delete actions', () => {
        const handleCopy = jest.fn();
        const handleDelete = jest.fn();
        const mark: HighlightMark = {
            id: 'mark-123',
            url: 'https://leetcode.com/problems/two-sum',
            text: 'Hash Map Solution for O(N)',
            color: '#f1c40f',
            createdAt: 1700000000000,
            type: 'highlight',
            note: 'Remember to check complement'
        } as unknown as HighlightMark;

        render(
            <HighlightCardView
                mark={mark}
                pageTitle="Two Sum"
                searchQuery="Hash Map"
                onCopy={handleCopy}
                onDelete={handleDelete}
            />,
            container
        );

        expect(container.querySelector('.highlight-text')?.textContent).toContain('Hash Map Solution for O(N)');
        expect(container.querySelector('.highlight-note-preview')?.textContent).toContain('Remember to check complement');
        expect(container.querySelector('.highlight-url')?.textContent).toContain('Two Sum');

        const copyBtn = container.querySelector('.action-btn-copy') as HTMLButtonElement;
        copyBtn.click();
        expect(handleCopy).toHaveBeenCalledWith('Hash Map Solution for O(N)');

        const deleteBtn = container.querySelector('.action-btn-delete') as HTMLButtonElement;
        deleteBtn.click();
        expect(handleDelete).toHaveBeenCalledWith('mark-123');
    });
});

