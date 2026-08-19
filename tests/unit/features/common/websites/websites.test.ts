import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import WhitelistedWebsitesManager from '../../../../../features/common/websites/websites';
import { UIUtils } from '../../../../../features/common/utils/uiUtils';

describe('WhitelistedWebsitesManager', () => {
    let manager: WhitelistedWebsitesManager;

    beforeEach(() => {
        document.body.innerHTML = `
            <ul id="whitelisted-sites-list"></ul>
            <input id="domain-input" value="https://google.com" />
            <button id="add-domain-btn"></button>
            <div id="status-toast"></div>
            <button id="back-to-popup-btn"></button>
            <button id="restore-defaults-btn"></button>
        `;

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
    });

    afterEach(() => {
        jest.clearAllMocks();
        document.body.innerHTML = '';
    });

    it('initializes and binds events correctly', () => {
        const spyLoad = jest.spyOn(manager, 'loadAndRenderSites').mockImplementation(() => {});
        manager.init();
        expect(spyLoad).toHaveBeenCalled();

        // Test back button
        const backBtn = document.getElementById('back-to-popup-btn')!;
        const windowCloseSpy = jest.spyOn(window, 'close').mockImplementation(() => {});
        backBtn.click();
        expect(windowCloseSpy).toHaveBeenCalled();

        // Test add domain button
        const addSpy = jest.spyOn(manager, 'handleAddWebsite').mockImplementation(() => {});
        document.getElementById('add-domain-btn')!.click();
        expect(addSpy).toHaveBeenCalled();

        // Test domain input enter keypress
        const input = document.getElementById('domain-input')!;
        input.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter' }));
        expect(addSpy).toHaveBeenCalledTimes(2);

        input.dispatchEvent(new KeyboardEvent('keypress', { key: 'a' }));
        expect(addSpy).toHaveBeenCalledTimes(2); // no increase

        // Test restore defaults button
        const restoreSpy = jest.spyOn(manager, 'restoreDefaults').mockImplementation(() => {});
        document.getElementById('restore-defaults-btn')!.click();
        expect(restoreSpy).toHaveBeenCalled();
    });

    it('loads and renders sites correctly when custom site present', () => {
        jest.spyOn(chrome.storage.local, 'get').mockImplementation((keys: any, callback: any) => {
            callback({
                whitelistedWebsites: [
                    { domain: 'leetcode.com', isDefault: true },
                    { domain: 'custom.com', isDefault: false }
                ]
            });
        });

        manager.loadAndRenderSites();

        const list = document.getElementById('whitelisted-sites-list');
        expect(list?.innerHTML).toContain('leetcode.com');
        expect(list?.innerHTML).toContain('custom.com');

        // Test clicking delete site button
        const delBtn = list?.querySelector('.delete-site-btn[data-site="custom.com"]') as HTMLElement;
        const delSpy = jest.spyOn(manager, 'handleDeleteWebsite').mockImplementation(() => {});
        delBtn?.click();
        expect(delSpy).toHaveBeenCalledWith('custom.com');
    });

    it('renders empty message when whitelistedWebsites is empty array', () => {
        jest.spyOn(chrome.storage.local, 'get').mockImplementation((keys: any, callback: any) => {
            callback({ whitelistedWebsites: [] });
        });

        manager.loadAndRenderSites();
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
        const input = document.getElementById('domain-input') as HTMLInputElement;
        input.value = 'www.mycustomsite.com';

        manager.handleAddWebsite();

        expect(chrome.permissions.request).toHaveBeenCalledWith(
            { origins: ['*://*.mycustomsite.com/*'] },
            expect.any(Function)
        );
        expect(chrome.scripting.registerContentScripts).toHaveBeenCalled();
    });

    it('handles adding new website when permission is declined', () => {
        (chrome.permissions.request as jest.Mock).mockImplementation((opts: any, cb: any) => cb(false));
        const input = document.getElementById('domain-input') as HTMLInputElement;
        input.value = 'declinedsite.com';

        manager.handleAddWebsite();
        expect(document.getElementById('status-toast')?.textContent).toBe("Permission request was declined.");
    });

    it('returns early when add website input is empty', () => {
        const input = document.getElementById('domain-input') as HTMLInputElement;
        input.value = '   ';
        manager.handleAddWebsite();
        expect(chrome.permissions.request).not.toHaveBeenCalled();
    });

    it('shows toast for invalid domain', () => {
        const input = document.getElementById('domain-input') as HTMLInputElement;
        input.value = 'http://';

        manager.handleAddWebsite();
        expect(document.getElementById('status-toast')?.textContent).toBe("Please enter a valid URL or domain.");
    });

    it('shows toast for duplicate domain', () => {
        jest.spyOn(chrome.storage.local, 'get').mockImplementation((keys: any, callback: any) => {
            callback({
                whitelistedWebsites: [{ domain: 'duplicate.com', isDefault: false }]
            });
        });
        const input = document.getElementById('domain-input') as HTMLInputElement;
        input.value = 'duplicate.com';

        manager.handleAddWebsite();
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

        manager.restoreDefaults();
        expect(document.getElementById('status-toast')?.textContent).toBe("Default platforms restored!");
    });

    it('shows and automatically hides toast after duration', () => {
        jest.useFakeTimers();
        UIUtils.showToast('Test Toast');
        const toast = document.getElementById('status-toast')!;
        expect(toast.textContent).toBe('Test Toast');
        expect(toast.className).toBe('toast show');

        jest.advanceTimersByTime(2600);
        expect(toast.className).toBe('toast');
        jest.useRealTimers();
    });
});

