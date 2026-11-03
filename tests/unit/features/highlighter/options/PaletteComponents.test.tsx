import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { h, render } from 'preact';
import { PaletteEditorSlots, PalettesList, Palette } from '../../../../../features/highlighter/options/highlightOptions';

describe('Palette Preact Components', () => {
    let container: HTMLElement;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    afterEach(() => {
        render(null, container);
        container.remove();
    });

    it('renders editor slots with color pickers and hex inputs', () => {
        const handleChange = jest.fn();
        const handleDelete = jest.fn();
        const colors = ['#f1c40f', '#3498db'];

        render(
            <PaletteEditorSlots
                colors={colors}
                onColorChange={handleChange}
                onDeleteSlot={handleDelete}
            />,
            container
        );

        const rows = container.querySelectorAll('.slot-row');
        expect(rows.length).toBe(2);

        const pickers = container.querySelectorAll('.color-picker');
        expect(pickers.length).toBe(2);

        const deleteBtns = container.querySelectorAll('.btn-danger');
        expect(deleteBtns.length).toBe(2);
        (deleteBtns[0] as HTMLButtonElement).click();
        expect(handleDelete).toHaveBeenCalledWith(0);
    });

    it('renders palette cards with active badge, edit, and delete actions', () => {
        const handleActivate = jest.fn();
        const handleEdit = jest.fn();
        const handleDelete = jest.fn();

        const palettes: Palette[] = [
            { name: 'Default', colors: ['#f1c40f', '#e74c3c'] },
            { name: 'Custom', colors: ['#2ecc71'] }
        ];

        render(
            <PalettesList
                palettes={palettes}
                activePaletteIndex={0}
                onActivate={handleActivate}
                onEdit={handleEdit}
                onDelete={handleDelete}
            />,
            container
        );

        const cards = container.querySelectorAll('.palette-card');
        expect(cards.length).toBe(2);
        expect(cards[0].classList.contains('active')).toBe(true);
        expect(cards[0].querySelector('.active-tag')?.textContent).toBe('Active');

        // Card 1 is active, should not have activate button
        expect(cards[0].querySelector('.btn-action-activate')).toBeNull();

        // Card 2 is inactive, should have activate button
        const activateBtn = cards[1].querySelector('.btn-action-activate') as HTMLButtonElement;
        expect(activateBtn).not.toBeNull();
        activateBtn.click();
        expect(handleActivate).toHaveBeenCalledWith(1);
    });
});

