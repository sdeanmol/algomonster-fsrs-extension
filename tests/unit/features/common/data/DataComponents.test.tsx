/**
 * @file tests/unit/features/common/data/DataComponents.test.tsx
 * @description Unit tests for Data Dashboard Preact sub-components.
 */

import { h, render } from 'preact';
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import {
    CardsTableEmptyState,
    CardsTableRow,
    CardsTable,
    BulkActionsBar
} from '../../../../../features/common/data/data';
import { Card } from '../../../../../types/domain';

describe('Data Dashboard Preact Components', () => {
    let container: HTMLDivElement;

    const mockCard: Card = {
        id: 'c1',
        problemTitle: 'Two Sum',
        problemUrl: 'https://leetcode.com/problems/two-sum',
        tags: ['array', 'hash-table'],
        due: Date.now() - 1000,
        stability: 2.5,
        difficulty: 3.2,
        reps: 4,
        lapses: 1,
        state: 1
    } as unknown as Card;

    const mockLeechCard: Card = {
        id: 'c2',
        problemTitle: 'LRU Cache',
        problemUrl: 'https://leetcode.com/problems/lru-cache',
        tags: ['design'],
        due: Date.now() + 86400000,
        stability: 1.2,
        difficulty: 8.0,
        reps: 6,
        lapses: 4,
        state: 3
    } as unknown as Card;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    afterEach(() => {
        render(null, container);
        container.remove();
        jest.restoreAllMocks();
    });

    describe('CardsTableEmptyState', () => {
        it('renders empty notice without clear button when filter is inactive', () => {
            render(<CardsTableEmptyState isFilterActive={false} />, container);

            expect(container.querySelector('h4')?.textContent).toBe('No Patterns Found');
            expect(container.querySelector('#empty-clear-filters-btn')).toBeNull();
        });

        it('renders clear filters button and emits onClearFilters when filter is active', () => {
            const onClear = jest.fn();
            render(<CardsTableEmptyState isFilterActive={true} onClearFilters={onClear} />, container);

            expect(container.querySelector('h4')?.textContent).toBe('No Matching Patterns');
            const clearBtn = container.querySelector('#empty-clear-filters-btn') as HTMLElement;
            expect(clearBtn).not.toBeNull();
            clearBtn.click();
            expect(onClear).toHaveBeenCalled();
        });
    });

    describe('CardsTableRow', () => {
        it('renders card fields, badges, and action buttons', () => {
            const onToggleCheck = jest.fn();
            const onEdit = jest.fn();
            const onDelete = jest.fn();

            const table = document.createElement('table');
            const tbody = document.createElement('tbody');
            table.appendChild(tbody);
            container.appendChild(table);

            render(
                <CardsTableRow
                    card={mockCard}
                    isChecked={false}
                    showLapses={true}
                    stateLabel="Learning"
                    onToggleCheck={onToggleCheck}
                    onEdit={onEdit}
                    onDelete={onDelete}
                />,
                tbody
            );

            expect(tbody.textContent).toContain('Two Sum');
            expect(tbody.textContent).toContain('array');
            expect(tbody.textContent).toContain('Due Now');
            expect(tbody.textContent).toContain('Learning');

            const checkbox = tbody.querySelector('.row-checkbox') as HTMLInputElement;
            expect(checkbox).not.toBeNull();
            expect(checkbox.checked).toBe(false);

            checkbox.checked = true;
            checkbox.dispatchEvent(new Event('change', { bubbles: true }));
            expect(onToggleCheck).toHaveBeenCalledWith('c1', true);

            const editBtn = tbody.querySelector('.edit-card-btn') as HTMLElement;
            editBtn.click();
            expect(onEdit).toHaveBeenCalledWith('c1');

            const deleteBtn = tbody.querySelector('.delete-card-btn') as HTMLElement;
            deleteBtn.click();
            expect(onDelete).toHaveBeenCalledWith('c1');
        });

        it('renders leech badge when lapses >= 3', () => {
            const table = document.createElement('table');
            const tbody = document.createElement('tbody');
            table.appendChild(tbody);
            container.appendChild(table);

            render(
                <CardsTableRow
                    card={mockLeechCard}
                    isChecked={true}
                    showLapses={true}
                    stateLabel="Relearning"
                />,
                tbody
            );

            expect(tbody.querySelector('.badge-leech')).not.toBeNull();
            expect(tbody.querySelector('tr')?.classList.contains('row-leech')).toBe(true);
            expect(tbody.querySelector('tr')?.classList.contains('row-selected')).toBe(true);
        });
    });

    describe('CardsTable', () => {
        it('renders empty state when cards array is empty', () => {
            render(
                <CardsTable
                    cards={[]}
                    selectedCardIds={new Set()}
                    getStateLabel={() => 'New'}
                />,
                container
            );

            expect(container.querySelector('.empty-state-card')).not.toBeNull();
            expect(container.querySelector('table')).toBeNull();
        });

        it('renders table headers and multiple rows with select-all checkbox', () => {
            const onToggleSelectAll = jest.fn();
            render(
                <CardsTable
                    cards={[mockCard, mockLeechCard]}
                    selectedCardIds={new Set(['c1'])}
                    getStateLabel={(s) => s === 1 ? 'Learning' : 'Review'}
                    onToggleSelectAll={onToggleSelectAll}
                />,
                container
            );

            expect(container.querySelector('table')).not.toBeNull();
            const rows = container.querySelectorAll('tbody tr');
            expect(rows.length).toBe(2);

            const selectAll = container.querySelector('#select-all-checkbox') as HTMLInputElement;
            expect(selectAll).not.toBeNull();
            expect(selectAll.checked).toBe(false);

            selectAll.checked = true;
            selectAll.dispatchEvent(new Event('change', { bubbles: true }));
            expect(onToggleSelectAll).toHaveBeenCalledWith(true);
        });
    });

    describe('BulkActionsBar', () => {
        it('renders bulk count and buttons and emits actions', () => {
            const onDelete = jest.fn();
            const onRetag = jest.fn();
            const onReschedule = jest.fn();
            const onDeselect = jest.fn();

            render(
                <BulkActionsBar
                    selectedCount={3}
                    onDelete={onDelete}
                    onRetag={onRetag}
                    onReschedule={onReschedule}
                    onDeselect={onDeselect}
                />,
                container
            );

            const bar = container.querySelector('#bulk-actions-bar') as HTMLElement;
            expect(bar).not.toBeNull();
            expect(bar.style.display).toBe('flex');
            expect(container.querySelector('#bulk-count')?.textContent).toBe('3');

            (container.querySelector('#bulk-delete-btn') as HTMLElement).click();
            expect(onDelete).toHaveBeenCalled();

            (container.querySelector('#bulk-retag-btn') as HTMLElement).click();
            expect(onRetag).toHaveBeenCalled();

            (container.querySelector('#bulk-reschedule-btn') as HTMLElement).click();
            expect(onReschedule).toHaveBeenCalled();

            (container.querySelector('#bulk-deselect-btn') as HTMLElement).click();
            expect(onDeselect).toHaveBeenCalled();
        });

        it('hides when selectedCount is 0', () => {
            render(
                <BulkActionsBar
                    selectedCount={0}
                    onDelete={jest.fn()}
                    onRetag={jest.fn()}
                    onReschedule={jest.fn()}
                    onDeselect={jest.fn()}
                />,
                container
            );

            const bar = container.querySelector('#bulk-actions-bar') as HTMLElement;
            expect(bar.style.display).toBe('none');
        });
    });
});

