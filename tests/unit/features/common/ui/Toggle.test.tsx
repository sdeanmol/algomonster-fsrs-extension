import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { h, render } from 'preact';
import { Toggle } from '../../../../../features/common/ui/components/Toggle';

describe('Toggle Preact Component', () => {
    let container: HTMLElement;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    afterEach(() => {
        render(null, container);
        container.remove();
    });

    it('renders with label and fires onChange on toggle', () => {
        const handleChange = jest.fn();
        render(
            <Toggle
                id="my-toggle"
                checked={false}
                onChange={handleChange}
                label="Enable Feature"
            />,
            container
        );

        const input = container.querySelector('#my-toggle') as HTMLInputElement;
        expect(input).not.toBeNull();
        expect(input.checked).toBe(false);

        const label = container.querySelector('label[for="my-toggle"]');
        expect(label?.textContent).toBe('Enable Feature');

        input.checked = true;
        input.dispatchEvent(new Event('change', { bubbles: true }));

        expect(handleChange).toHaveBeenCalledWith(true);
    });
});

