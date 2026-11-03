import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { h, render } from 'preact';
import { WhitelistedSitesList, WhitelistedSite } from '../../../../../features/common/websites/websites';

describe('WhitelistedSitesList Preact Component', () => {
    let container: HTMLElement;

    beforeEach(() => {
        container = document.createElement('ul');
        document.body.appendChild(container);
    });

    afterEach(() => {
        render(null, container);
        container.remove();
    });

    it('renders empty message when no sites are configured', () => {
        render(<WhitelistedSitesList sites={[]} onDelete={jest.fn()} />, container);
        expect(container.textContent).toContain('No whitelisted websites. Add one to get started!');
    });

    it('renders site rows with monograms, badges, and fires onDelete when clicked', () => {
        const handleDelete = jest.fn();
        const testSites: WhitelistedSite[] = [
            { domain: 'leetcode.com', isDefault: true },
            { domain: 'myplatform.org', isDefault: false }
        ];

        render(<WhitelistedSitesList sites={testSites} onDelete={handleDelete} />, container);

        const items = container.querySelectorAll('li');
        expect(items.length).toBe(2);

        // First item check (default)
        expect(items[0].textContent).toContain('L');
        expect(items[0].textContent).toContain('leetcode.com');
        expect(items[0].textContent).toContain('Default');

        // Second item check (custom)
        expect(items[1].textContent).toContain('M');
        expect(items[1].textContent).toContain('myplatform.org');
        expect(items[1].textContent).not.toContain('Default');

        // Click delete on second item
        const deleteBtn = items[1].querySelector('.delete-site-btn') as HTMLButtonElement;
        expect(deleteBtn).not.toBeNull();
        deleteBtn.click();
        expect(handleDelete).toHaveBeenCalledWith('myplatform.org');
    });
});

