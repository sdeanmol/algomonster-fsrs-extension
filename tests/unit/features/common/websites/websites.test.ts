import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { h, render } from 'preact';
import { act } from 'preact/test-utils';
import { WhitelistedWebsitesManager, WebsitesApp } from '../../../../../features/common/websites/websites';
import { UIUtils } from '../../../../../features/common/utils/uiUtils';

describe('WhitelistedWebsitesManager & WebsitesApp', () => {
    let manager: WhitelistedWebsitesManager;
    let container: HTMLElement;

    beforeEach(async () => {
        container = document.createElement('div');
        document.body.appendChild(container);

        (global as any).mockStorage = {
            whitelistedWebsites: []
        };
        
        manager = new WhitelistedWebsitesManager();
        
        (global.chrome as any).permissions = {
            request: jest.fn((options: any, callback: any) => callback(true)),
            remove: jest.fn((options: any, callback: any) => callback(true))
        };
        (global.chrome as any).scripting = {
            registerContentScripts: jest.fn((scripts: any, callback: any) => callback && callback()),
            unregisterContentScripts: jest.fn((options: any, callback: any) => callback && callback())
        };

        await act(async () => {
            render(h(WebsitesApp, { manager }), container);
            await Promise.resolve();
        });
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.clearAllMocks();
        render(null, container);
        container.remove();
        document.body.innerHTML = '';
    });

    it('initializes and binds events correctly', () => {
        const spyLoad = jest.spyOn(manager, 'loadAndRenderSites');
        manager.loadAndRenderSites();
        expect(spyLoad).toHaveBeenCalled();

        // Test back button
        const backBtn = document.getElementById('back-to-popup-btn')!;
        const windowCloseSpy = jest.spyOn(window, 'close').mockImplementation(() => {});
        backBtn.click();
        expect(windowCloseSpy).toHaveBeenCalled();

        // Test add domain button
        const addSpy = jest.spyOn(manager, 'handleAddWebsite');
        const input = document.getElementById('domain-input') as HTMLInputElement;
        input.value = 'https://google.com';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        document.getElementById('add-domain-btn')!.click();
        expect(addSpy).toHaveBeenCalled();

        // Test domain input enter keypress
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        expect(addSpy).toHaveBeenCalledTimes(2);

        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
        expect(addSpy).toHaveBeenCalledTimes(2); // no increase

        // Test restore defaults button
        const restoreSpy = jest.spyOn(manager, 'restoreDefaults');
        document.getElementById('restore-defaults-btn')!.click();
        expect(restoreSpy).toHaveBeenCalled();
    });

    it('loads and renders sites correctly when custom site present', async () => {
        jest.spyOn(chrome.storage.local, 'get').mockImplementation((keys: any, callback: any) => {
            callback({
                whitelistedWebsites: [
                    { domain: 'leetcode.com', isDefault: true },
                    { domain: 'custom.com', isDefault: false }
                ]
            });
        });

        manager.loadAndRenderSites();
        await new Promise((resolve) => setTimeout(resolve, 0));

        const list = document.getElementById('whitelisted-sites-list');
        expect(list?.innerHTML).toContain('leetcode.com');
        expect(list?.innerHTML).toContain('custom.com');

        // Test clicking delete site button
        const delBtn = list?.querySelector('.delete-site-btn[data-site="custom.com"]') as HTMLElement;
        const delSpy = jest.spyOn(manager, 'handleDeleteWebsite');
        delBtn?.click();
        expect(delSpy).toHaveBeenCalledWith('custom.com');
    });

    it('renders empty message when whitelistedWebsites is empty array', async () => {
        jest.spyOn(chrome.storage.local, 'get').mockImplementation((keys: any, callback: any) => {
            callback({ whitelistedWebsites: [] });
        });

        manager.loadAndRenderSites();
        await new Promise((resolve) => setTimeout(resolve, 0));
        const list = document.getElementById('whitelisted-sites-list');
        expect(list?.innerHTML).toContain('No whitelisted websites');
    });

    it('initializes default sites when whitelistedWebsites is undefined', () => {
        const setSpy = jest.spyOn(chrome.storage.local, 'set');
        jest.spyOn(chrome.storage.local, 'get').mockImplementation((keys: any, callback: any) => {
            callback({});
        });

        manager.loadAndRenderSites();
        expect(setSpy).toHaveBeenCalledWith(expect.objectContaining({
            whitelistedWebsites: expect.arrayContaining([expect.objectContaining({ domain: 'algo.monster' })])
        }), expect.any(Function));
    });

    it('handles adding new website with www. prefix', () => {
        manager.handleAddWebsite('www.mycustomsite.com');

        expect(chrome.permissions.request).toHaveBeenCalledWith(
            { origins: ['*://*.mycustomsite.com/*'] },
            expect.any(Function)
        );
        expect(chrome.scripting.registerContentScripts).toHaveBeenCalledWith([
            expect.objectContaining({
                id: 'site-mycustomsite-com',
                matches: ['*://*.mycustomsite.com/*'],
                js: [
                    "features/common/marked.min.js",
                    "dist/fsrsScheduler.bundle.js",
                    "content/content.js"
                ],
                css: ["features/highlighter/style.css"]
            })
        ], expect.any(Function));
    });

    it('handles adding new website when permission is declined', () => {
        (chrome.permissions.request as jest.Mock).mockImplementation((opts: any, cb: any) => cb(false));
        act(() => {
            manager.handleAddWebsite('declinedsite.com');
        });
        expect(document.getElementById('status-toast')?.textContent).toBe("Permission request was declined.");
    });

    it('returns early when add website input is empty', () => {
        manager.handleAddWebsite('   ');
        expect(chrome.permissions.request).not.toHaveBeenCalled();
    });

    it('shows toast for invalid domain', () => {
        act(() => {
            manager.handleAddWebsite('http://');
        });
        expect(document.getElementById('status-toast')?.textContent).toBe("Please enter a valid URL or domain.");
    });

    it('shows toast for duplicate domain', () => {
        jest.spyOn(chrome.storage.local, 'get').mockImplementation((keys: any, callback: any) => {
            callback({
                whitelistedWebsites: [{ domain: 'duplicate.com', isDefault: false }]
            });
        });
        act(() => {
            manager.handleAddWebsite('duplicate.com');
        });
        expect(document.getElementById('status-toast')?.textContent).toBe("Website is already whitelisted.");
    });

    it('deletes custom website with unregister content scripts and permission removal', () => {
        jest.spyOn(chrome.storage.local, 'get').mockImplementation((keys: any, callback: any) => {
            callback({
                whitelistedWebsites: [{ domain: 'custom.com', isDefault: false }]
            });
        });
        const setSpy = jest.spyOn(chrome.storage.local, 'set');

        manager.handleDeleteWebsite('custom.com');

        expect(chrome.scripting.unregisterContentScripts).toHaveBeenCalledWith({ ids: ['site-custom-com'] }, expect.any(Function));
        expect(chrome.permissions.remove).toHaveBeenCalledWith({ origins: ['*://*.custom.com/*'] }, expect.any(Function));
        expect(setSpy).toHaveBeenCalledWith({ whitelistedWebsites: [] }, expect.any(Function));
    });

    it('deletes default website directly without script unregistration', () => {
        jest.spyOn(chrome.storage.local, 'get').mockImplementation((keys: any, callback: any) => {
            callback({
                whitelistedWebsites: [{ domain: 'leetcode.com', isDefault: true }]
            });
        });
        const setSpy = jest.spyOn(chrome.storage.local, 'set');

        manager.handleDeleteWebsite('leetcode.com');

        expect(chrome.scripting.unregisterContentScripts).not.toHaveBeenCalled();
        expect(setSpy).toHaveBeenCalledWith({ whitelistedWebsites: [] }, expect.any(Function));
    });

    it('does nothing when deleting non-existent site', () => {
        jest.spyOn(chrome.storage.local, 'get').mockImplementation((keys: any, callback: any) => {
            callback({ whitelistedWebsites: [] });
        });
        const setSpy = jest.spyOn(chrome.storage.local, 'set');

        manager.handleDeleteWebsite('nonexistent.com');
        expect(setSpy).not.toHaveBeenCalled();
    });

    it('restores default platforms', () => {
        jest.spyOn(chrome.storage.local, 'get').mockImplementation((keys: any, callback: any) => {
            callback({
                whitelistedWebsites: [{ domain: 'custom.com', isDefault: false }]
            });
        });

        act(() => {
            manager.restoreDefaults();
        });
        expect(document.getElementById('status-toast')?.textContent).toBe("Default platforms restored!");
    });

    it('shows and automatically hides toast after duration', () => {
        try {
            jest.useFakeTimers();
            act(() => {
                UIUtils.showToast('Test Toast');
            });
            const toast = document.getElementById('status-toast')!;
            expect(toast.textContent).toBe('Test Toast');
            expect(toast.className).toBe('toast show');

            act(() => {
                jest.advanceTimersByTime(2600);
            });
            expect(toast.className).toBe('toast');
        } finally {
            jest.useRealTimers();
        }
    });
});
