import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { h, render } from 'preact';
import { HelpTabBar } from '../../../../../features/common/help/help';

describe('HelpTabBar Preact Component', () => {
    let container: HTMLElement;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    afterEach(() => {
        render(null, container);
        container.remove();
    });

    it('renders tabs with active state and triggers onSelect', () => {
        const handleSelect = jest.fn();
        const tabs = [
            { id: 'overview', label: 'Overview' },
            { id: 'shortcuts', label: 'Shortcuts' },
            { id: 'privacy', label: 'Privacy Policy' }
        ];

        render(<HelpTabBar tabs={tabs} activeTab="shortcuts" onSelect={handleSelect} />, container);

        const buttons = container.querySelectorAll('.tab-btn');
        expect(buttons.length).toBe(3);

        expect(buttons[0].classList.contains('active')).toBe(false);
        expect(buttons[0].getAttribute('aria-selected')).toBe('false');

        expect(buttons[1].classList.contains('active')).toBe(true);
        expect(buttons[1].getAttribute('aria-selected')).toBe('true');

        (buttons[2] as HTMLButtonElement).click();
        expect(handleSelect).toHaveBeenCalledWith('privacy');
    });
});

