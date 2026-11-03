/**
 * @file tests/unit/features/highlighter/HighlighterTooltip.test.tsx
 * @description Unit tests for Preact highlighter tooltip sub-components and container view.
 */

import { h, render } from 'preact';
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import {
    HighlighterTypeSelector,
    HighlighterSwatches,
    HighlighterColorPicker,
    HighlighterDeleteButton,
    HighlighterNotesSection,
    HighlighterTooltipView
} from '../../../../features/highlighter/highlighter';
import { HighlightMark } from '../../../../types/domain';

describe('Highlighter Preact Tooltip Components', () => {
    let container: HTMLDivElement;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    afterEach(() => {
        render(null, container);
        container.remove();
        jest.restoreAllMocks();
    });

    describe('HighlighterTypeSelector', () => {
        it('renders radio buttons for highlight and underline', () => {
            const onSelectType = jest.fn();
            render(<HighlighterTypeSelector activeType="highlight" onSelectType={onSelectType} />, container);

            const buttons = container.querySelectorAll('.algo-type-btn');
            expect(buttons.length).toBe(2);
            expect(buttons[0].textContent).toBe('Highlight');
            expect(buttons[1].textContent).toBe('Underline');
            expect(buttons[0].getAttribute('aria-checked')).toBe('true');
            expect(buttons[1].getAttribute('aria-checked')).toBe('false');
        });

        it('calls onSelectType when button is clicked or keyed', () => {
            const onSelectType = jest.fn();
            render(<HighlighterTypeSelector activeType="highlight" onSelectType={onSelectType} />, container);

            const buttons = container.querySelectorAll('.algo-type-btn');
            buttons[1].dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
            expect(onSelectType).toHaveBeenCalledWith('underline');

            buttons[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
            expect(onSelectType).toHaveBeenCalledWith('highlight');

            buttons[1].dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
            expect(onSelectType).toHaveBeenCalledWith('underline');
        });
    });

    describe('HighlighterSwatches', () => {
        const paletteColors = ['#ff0000', '#00ff00', '#0000ff'];
        const defaultColor = '#ffff00';

        it('renders all palette swatches and the default swatch', () => {
            const onSelectColor = jest.fn();
            render(
                <HighlighterSwatches
                    paletteColors={paletteColors}
                    defaultHighlightColor={defaultColor}
                    currentColor="#ff0000"
                    onSelectColor={onSelectColor}
                />,
                container
            );

            const swatches = container.querySelectorAll('.algo-color-swatch');
            expect(swatches.length).toBe(4); // 3 palette + 1 default
            expect(swatches[0].classList.contains('active')).toBe(true);

            const defaultSwatch = container.querySelector('#algo-default-color-swatch');
            expect(defaultSwatch).not.toBeNull();
            expect(defaultSwatch?.getAttribute('data-default-color')).toBe(defaultColor);
        });

        it('handles mousedown and keyboard selection on swatches', () => {
            const onSelectColor = jest.fn();
            render(
                <HighlighterSwatches
                    paletteColors={paletteColors}
                    defaultHighlightColor={defaultColor}
                    currentColor={null}
                    onSelectColor={onSelectColor}
                />,
                container
            );

            const swatches = container.querySelectorAll('.algo-color-swatch');
            swatches[1].dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
            expect(onSelectColor).toHaveBeenCalledWith('#00ff00');

            swatches[2].dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
            expect(onSelectColor).toHaveBeenCalledWith('#0000ff');
        });

        it('supports ArrowRight and ArrowLeft keyboard navigation', () => {
            const onSelectColor = jest.fn();
            render(
                <HighlighterSwatches
                    paletteColors={paletteColors}
                    defaultHighlightColor={defaultColor}
                    currentColor={null}
                    onSelectColor={onSelectColor}
                />,
                container
            );

            const swatches = container.querySelectorAll('.algo-color-swatch');
            const focusSpy = jest.spyOn(swatches[1] as HTMLElement, 'focus');
            swatches[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
            expect(focusSpy).toHaveBeenCalled();

            const focusPrevSpy = jest.spyOn(swatches[0] as HTMLElement, 'focus');
            swatches[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
            expect(focusPrevSpy).toHaveBeenCalled();
        });
    });

    describe('HighlighterColorPicker', () => {
        it('renders color input and handles input/change events', () => {
            const onColorInput = jest.fn();
            const onColorChange = jest.fn();
            const onCacheSelection = jest.fn();
            const onBlur = jest.fn();

            render(
                <HighlighterColorPicker
                    currentColor="#123456"
                    defaultHighlightColor="#ffff00"
                    onColorInput={onColorInput}
                    onColorChange={onColorChange}
                    onCacheSelection={onCacheSelection}
                    onBlur={onBlur}
                />,
                container
            );

            const picker = container.querySelector('#algo-color-picker') as HTMLInputElement;
            expect(picker).not.toBeNull();
            expect(picker.value).toBe('#123456');

            picker.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
            expect(onCacheSelection).toHaveBeenCalled();

            picker.value = '#abcdef';
            picker.dispatchEvent(new Event('input', { bubbles: true }));
            expect(onColorInput).toHaveBeenCalledWith('#abcdef');

            picker.dispatchEvent(new Event('change', { bubbles: true }));
            expect(onColorChange).toHaveBeenCalledWith('#abcdef');

            picker.dispatchEvent(new Event('blur', { bubbles: true }));
            expect(onBlur).toHaveBeenCalled();
        });
    });

    describe('HighlighterDeleteButton', () => {
        it('renders delete icon and triggers onDelete', () => {
            const onDelete = jest.fn();
            render(<HighlighterDeleteButton onDelete={onDelete} />, container);

            const deleteBtn = container.querySelector('.algo-delete-btn') as HTMLElement;
            expect(deleteBtn).not.toBeNull();

            deleteBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
            expect(onDelete).toHaveBeenCalledTimes(1);

            deleteBtn.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
            expect(onDelete).toHaveBeenCalledTimes(2);

            deleteBtn.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
            expect(onDelete).toHaveBeenCalledTimes(3);
        });
    });

    describe('HighlighterNotesSection', () => {
        const mark: HighlightMark = {
            id: 'mark_test_1',
            createdAt: 1000,
            url: 'https://example.com/test',
            text: 'highlighted phrase',
            color: '#ff0000',
            note: 'existing note',
            category: 'Key Insight'
        };

        it('renders category options, note input, and link button', () => {
            const onSaveCategory = jest.fn();
            const onSaveNote = jest.fn();
            const onLinkCard = jest.fn();

            render(
                <HighlighterNotesSection
                    mark={mark}
                    onSaveCategory={onSaveCategory}
                    onSaveNote={onSaveNote}
                    onLinkCard={onLinkCard}
                />,
                container
            );

            const select = container.querySelector('.algo-category-select') as HTMLSelectElement;
            expect(select).not.toBeNull();
            expect(select.value).toBe('Key Insight');

            select.value = 'Gotcha';
            select.dispatchEvent(new Event('change', { bubbles: true }));
            expect(onSaveCategory).toHaveBeenCalledWith('Gotcha');

            const noteInput = container.querySelector('.algo-note-input') as HTMLInputElement;
            expect(noteInput).not.toBeNull();
            expect(noteInput.value).toBe('existing note');

            noteInput.value = 'updated note';
            noteInput.dispatchEvent(new Event('input', { bubbles: true }));
            expect(onSaveNote).toHaveBeenCalledWith('updated note');

            const linkBtn = container.querySelector('.algo-link-btn') as HTMLElement;
            expect(linkBtn).not.toBeNull();
            linkBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            expect(onLinkCard).toHaveBeenCalled();
        });
    });

    describe('HighlighterTooltipView', () => {
        it('renders new highlight mode without delete or notes section', () => {
            render(
                <HighlighterTooltipView
                    existingMarkId={null}
                    currentColor={null}
                    activeType="highlight"
                    paletteColors={['#ff0000']}
                    defaultHighlightColor="#ffff00"
                    mark={undefined}
                    onSelectType={jest.fn()}
                    onSelectColor={jest.fn()}
                    onColorInput={jest.fn()}
                    onColorChange={jest.fn()}
                    onColorBlur={jest.fn()}
                    onCacheSelection={jest.fn()}
                    onDelete={jest.fn()}
                    onSaveCategory={jest.fn()}
                    onSaveNote={jest.fn()}
                    onLinkCard={jest.fn()}
                />,
                container
            );

            expect(container.querySelector('.algo-type-selector')).not.toBeNull();
            expect(container.querySelector('#algo-color-picker')).not.toBeNull();
            expect(container.querySelector('.algo-delete-btn')).toBeNull();
            expect(container.querySelector('.algo-note-section')).toBeNull();
        });

        it('renders existing highlight edit mode with delete and notes section', () => {
            const mark: HighlightMark = {
                id: 'mark_1',
                createdAt: 100,
                url: 'https://example.com',
                text: 'sample',
                color: '#ff0000',
                note: 'note text',
                category: 'Gotcha'
            };

            render(
                <HighlighterTooltipView
                    existingMarkId="mark_1"
                    currentColor="#ff0000"
                    activeType="highlight"
                    paletteColors={['#ff0000']}
                    defaultHighlightColor="#ffff00"
                    mark={mark}
                    onSelectType={jest.fn()}
                    onSelectColor={jest.fn()}
                    onColorInput={jest.fn()}
                    onColorChange={jest.fn()}
                    onColorBlur={jest.fn()}
                    onCacheSelection={jest.fn()}
                    onDelete={jest.fn()}
                    onSaveCategory={jest.fn()}
                    onSaveNote={jest.fn()}
                    onLinkCard={jest.fn()}
                />,
                container
            );

            expect(container.querySelector('.algo-type-selector')).toBeNull();
            expect(container.querySelector('#algo-color-picker')).not.toBeNull();
            expect(container.querySelector('.algo-delete-btn')).not.toBeNull();
            expect(container.querySelector('.algo-note-section')).not.toBeNull();
        });
    });
});

