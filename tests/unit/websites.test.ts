import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import WhitelistedWebsitesManager from '../../features/common/websites/websites';

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

    it('loads and renders sites correctly', () => {
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
    });

    it('handles adding new website successfully', () => {
        const input = document.getElementById('domain-input') as HTMLInputElement;
        input.value = 'mycustomsite.com';
        
        manager.handleAddWebsite();

        expect(chrome.permissions.request).toHaveBeenCalled();
        expect(chrome.scripting.registerContentScripts).toHaveBeenCalled();
    });

    it('shows toast for invalid domain', () => {
        const input = document.getElementById('domain-input') as HTMLInputElement;
        input.value = 'invalid uri string';
        
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

    it('restores default platforms', () => {
        jest.spyOn(chrome.storage.local, 'get').mockImplementation((keys: any, callback: any) => {
            callback({
                whitelistedWebsites: [{ domain: 'custom.com', isDefault: false }]
            });
        });
        
        manager.restoreDefaults();
        expect(document.getElementById('status-toast')?.textContent).toBe("Default platforms restored!");
    });
});
