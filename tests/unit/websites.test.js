const WhitelistedWebsitesManager = require('../../features/common/websites/websites.js');

describe('WhitelistedWebsitesManager', () => {
    let manager;

    beforeEach(() => {
        // Mock DOM
        document.body.innerHTML = `
            <ul id="whitelisted-sites-list"></ul>
            <input id="domain-input" value="https://google.com" />
            <button id="add-domain-btn"></button>
            <div id="status-toast"></div>
            <button id="back-to-popup-btn"></button>
            <button id="restore-defaults-btn"></button>
        `;

        global.mockStorage = {
            whitelistedWebsites: []
        };
        
        manager = new WhitelistedWebsitesManager();
        
        global.chrome.permissions = {
            request: jest.fn((options, callback) => callback(true)),
            remove: jest.fn((options, callback) => callback(true))
        };
        global.chrome.scripting = {
            registerContentScripts: jest.fn((scripts, callback) => callback()),
            unregisterContentScripts: jest.fn((options, callback) => callback())
        };
        global.chrome.runtime = { lastError: null };
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('loads and renders sites correctly', () => {
        global.mockStorage = {
            whitelistedWebsites: [
                { domain: 'leetcode.com', isDefault: true },
                { domain: 'custom.com', isDefault: false }
            ]
        };

        manager.loadAndRenderSites();

        const list = document.getElementById('whitelisted-sites-list');
        expect(list.innerHTML).toContain('leetcode.com');
        expect(list.innerHTML).toContain('custom.com');
        expect(list.innerHTML).toContain('protected'); // Default badge
    });

    it('handles adding new website successfully', () => {
        const input = document.getElementById('domain-input');
        input.value = 'mycustomsite.com';
        
        manager.handleAddWebsite();

        expect(global.chrome.permissions.request).toHaveBeenCalled();
        expect(global.chrome.scripting.registerContentScripts).toHaveBeenCalled();
        expect(global.mockStorage.whitelistedWebsites.length).toBe(1);
        expect(global.mockStorage.whitelistedWebsites[0].domain).toBe('mycustomsite.com');
        expect(global.mockStorage.whitelistedWebsites[0].isDefault).toBe(false);
    });

    it('shows toast for invalid domain', () => {
        const input = document.getElementById('domain-input');
        input.value = 'invalid uri string';
        
        manager.handleAddWebsite();
        expect(document.getElementById('status-toast').textContent).toBe("Please enter a valid URL or domain.");
    });
    
    it('shows toast for duplicate domain', () => {
        global.mockStorage = {
            whitelistedWebsites: [ { domain: 'duplicate.com', isDefault: false } ]
        };
        const input = document.getElementById('domain-input');
        input.value = 'duplicate.com';
        
        manager.handleAddWebsite();
        expect(document.getElementById('status-toast').textContent).toBe("Website is already whitelisted.");
        expect(global.chrome.permissions.request).not.toHaveBeenCalled();
    });
    
    it('shows toast if permission is declined', () => {
        global.chrome.permissions.request = jest.fn((options, callback) => callback(false));
        const input = document.getElementById('domain-input');
        input.value = 'declined.com';
        
        manager.handleAddWebsite();
        expect(document.getElementById('status-toast').textContent).toBe("Permission request was declined.");
    });

    it('handles deleting a default website', () => {
        global.mockStorage = {
            whitelistedWebsites: [ { domain: 'leetcode.com', isDefault: true } ]
        };
        
        manager.handleDeleteWebsite('leetcode.com');
        
        // For default sites, it skips scripting and permissions API and just updates storage
        expect(global.chrome.scripting.unregisterContentScripts).not.toHaveBeenCalled();
        expect(global.mockStorage.whitelistedWebsites.length).toBe(0);
        expect(document.getElementById('status-toast').textContent).toContain("Removed access for: leetcode.com");
    });
    
    it('handles deleting a custom website', () => {
        global.mockStorage = {
            whitelistedWebsites: [ { domain: 'custom.com', isDefault: false } ]
        };
        
        manager.handleDeleteWebsite('custom.com');
        
        // For custom sites, it must unregister the script and remove permissions
        expect(global.chrome.scripting.unregisterContentScripts).toHaveBeenCalled();
        expect(global.chrome.permissions.remove).toHaveBeenCalled();
        expect(global.mockStorage.whitelistedWebsites.length).toBe(0);
    });

    it('restores default platforms', () => {
        global.mockStorage = {
            whitelistedWebsites: [ { domain: 'custom.com', isDefault: false } ]
        };
        
        manager.restoreDefaults();
        
        // Custom site should remain, defaults should be prepended
        expect(global.mockStorage.whitelistedWebsites.length).toBeGreaterThan(1);
        expect(global.mockStorage.whitelistedWebsites.find(s => s.domain === 'custom.com')).toBeDefined();
        expect(global.mockStorage.whitelistedWebsites.find(s => s.domain === 'leetcode.com')).toBeDefined();
        expect(document.getElementById('status-toast').textContent).toBe("Default platforms restored!");
    });
    
    it('binds events correctly', () => {
        manager.bindEvents();
        // Just triggering the events to ensure they are hooked up and don't throw
        const enterEvent = new KeyboardEvent('keypress', { key: 'Enter' });
        document.getElementById('domain-input').dispatchEvent(enterEvent);
        document.getElementById('add-domain-btn').click();
        document.getElementById('restore-defaults-btn').click();
    });
});
