import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { h, render } from 'preact';
import { WhitelistedSitesList, WhitelistedSite, WebsitesApp, WhitelistedWebsitesManager } from '../../../../../features/common/websites/websites';

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

describe('WebsitesApp Preact Component', () => {
    let container: HTMLElement;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);

        (global.chrome as any).storage = {
            local: {
                get: jest.fn((keys: any, cb: any) => cb({
                    whitelistedWebsites: [
                        { domain: 'leetcode.com', isDefault: true },
                        { domain: 'custom.io', isDefault: false }
                    ]
                })),
                set: jest.fn((data: any, cb?: any) => cb && cb())
            }
        };
    });

    afterEach(() => {
        render(null, container);
        container.remove();
        document.body.innerHTML = '';
    });

    it('renders the complete WebsitesApp UI tree', () => {
        const manager = new WhitelistedWebsitesManager();
        render(<WebsitesApp manager={manager} />, container);

        expect(container.querySelector('.algorecall-brand-name')?.textContent).toBe('AlgoRecall');
        expect(container.querySelector('#page-title')?.textContent).toBe('Active Platforms');
        expect(container.querySelector('#domain-input')).not.toBeNull();
        expect(container.querySelector('#add-domain-btn')).not.toBeNull();
        expect(container.querySelector('#restore-defaults-btn')).not.toBeNull();
        expect(container.querySelector('#whitelisted-sites-list')).not.toBeNull();
    });

    it('triggers handleAdd when add button is clicked in WebsitesApp', () => {
        const manager = new WhitelistedWebsitesManager();
        const addSpy = jest.spyOn(manager, 'handleAddWebsite').mockImplementation(() => {});

        render(<WebsitesApp manager={manager} />, container);

        const addBtn = container.querySelector('#add-domain-btn') as HTMLButtonElement;
        addBtn.click();
        expect(addSpy).toHaveBeenCalled();
    });
});

