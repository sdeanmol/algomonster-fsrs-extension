/**
 * @file tests/unit/features/tracker/config/FSRSConfigComponents.test.tsx
 * @description Unit tests for FSRS configuration Preact sub-components.
 */

import { h, render } from 'preact';
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

jest.mock('@open-spaced-repetition/binding/dynamic-wasi', () => ({
  FSRS: jest.fn().mockImplementation(() => ({
    compute_weights: jest.fn()
  }))
}));

import {
    WeightInputCard,
    WeightsInputsGrid,
    TagProfilesList,
    ModeToggle,
    PresetChips
} from '../../../../../features/tracker/config/fsrsConfig';

describe('FSRS Config Preact Components', () => {
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

    describe('WeightInputCard', () => {
        it('renders weight index, tooltip info, and numeric input', () => {
            const onChange = jest.fn();
            render(
                <WeightInputCard
                    index={3}
                    value={5.8}
                    detail={{
                        title: 'Initial Stability (Easy)',
                        purpose: 'Initial interval for easy ratings',
                        significance: 'Gives effortless cards larger gap'
                    }}
                    onChange={onChange}
                />,
                container
            );

            expect(container.querySelector('.weight-index')?.textContent).toBe('w3');
            expect(container.querySelector('.weight-tooltip-title')?.textContent).toBe('Initial Stability (Easy)');

            const input = container.querySelector('#weight-input-3') as HTMLInputElement;
            expect(input).not.toBeNull();
            expect(input.value).toBe('5.8');

            input.value = '6.2';
            input.dispatchEvent(new Event('input', { bubbles: true }));
            expect(onChange).toHaveBeenCalledWith(3, 6.2);
        });
    });

    describe('WeightsInputsGrid', () => {
        it('renders all 17 weight inputs', () => {
            const weights = Array(17).fill(1.0);
            render(
                <WeightsInputsGrid
                    weights={weights}
                    defaultWeights={weights}
                    helpDetails={[]}
                />,
                container
            );

            const inputs = container.querySelectorAll('.weight-num-input');
            expect(inputs.length).toBe(17);
        });
    });

    describe('TagProfilesList', () => {
        it('renders empty message when no profiles exist', () => {
            render(<TagProfilesList topicWeights={{}} onDeleteProfile={jest.fn()} />, container);

            expect(container.textContent).toContain('No custom profiles saved yet');
        });

        it('renders tag badges, weights list, and handles delete button click', () => {
            const onDeleteProfile = jest.fn();
            const profiles = {
                dp: [0.4, 0.6, 2.4, 5.8, 4.93, 0.94, 0.86, 0.01, 1.49, 0.14, 0.94, 2.18, 0.05, 0.34, 1.26, 0.29, 2.61]
            };

            render(<TagProfilesList topicWeights={profiles} onDeleteProfile={onDeleteProfile} />, container);

            const badge = container.querySelector('.profile-tag-badge');
            expect(badge?.textContent).toBe('dp');

            const deleteBtn = container.querySelector('.delete-profile-btn') as HTMLElement;
            expect(deleteBtn).not.toBeNull();
            deleteBtn.click();
            expect(onDeleteProfile).toHaveBeenCalledWith('dp');
        });
    });

    describe('ModeToggle', () => {
        it('renders simple and advanced buttons and emits selection', () => {
            const onSelectMode = jest.fn();
            render(<ModeToggle currentMode="simple" onSelectMode={onSelectMode} />, container);

            const simpleBtn = container.querySelector('#mode-simple-btn') as HTMLElement;
            const advancedBtn = container.querySelector('#mode-advanced-btn') as HTMLElement;

            expect(simpleBtn.classList.contains('active')).toBe(true);
            expect(advancedBtn.classList.contains('active')).toBe(false);

            advancedBtn.click();
            expect(onSelectMode).toHaveBeenCalledWith('advanced');
        });
    });

    describe('PresetChips', () => {
        it('renders retention presets and highlights active preset', () => {
            const onSelectRetention = jest.fn();
            render(<PresetChips currentRetention={0.90} onSelectRetention={onSelectRetention} />, container);

            const chips = container.querySelectorAll('.preset-chip');
            expect(chips.length).toBe(4);

            // Optimal (90%) should be active
            const optimalChip = container.querySelector('[data-retention="0.9"]') as HTMLElement;
            expect(optimalChip?.classList.contains('active')).toBe(true);

            // Click intensive preset
            const intensiveChip = container.querySelector('[data-retention="0.95"]') as HTMLElement;
            intensiveChip.click();
            expect(onSelectRetention).toHaveBeenCalledWith(0.95);
        });
    });
});
