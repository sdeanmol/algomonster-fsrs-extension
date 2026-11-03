import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { h, render } from 'preact';
import { StepIndicators } from '../../../../../features/common/welcome/welcome';

describe('StepIndicators Preact Component', () => {
    let container: HTMLElement;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    afterEach(() => {
        render(null, container);
        container.remove();
    });

    it('renders correct number of dots and marks current step as active', () => {
        const handleSelect = jest.fn();
        render(<StepIndicators currentStep={2} totalSteps={4} onSelectStep={handleSelect} />, container);

        const dots = container.querySelectorAll('.dot');
        expect(dots.length).toBe(4);

        expect(dots[0].classList.contains('active')).toBe(false);
        expect(dots[1].classList.contains('active')).toBe(true);
        expect(dots[1].getAttribute('aria-current')).toBe('step');

        (dots[2] as HTMLDivElement).click();
        expect(handleSelect).toHaveBeenCalledWith(3);
    });
});

