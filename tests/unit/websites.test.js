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

        // Wait for asynchronous storage callback to execute
        const list = document.getElementById('whitelisted-sites-list');
        expect(list.innerHTML).toContain('leetcode.com');
        expect(list.innerHTML).toContain('custom.com');
        expect(list.innerHTML).toContain('protected'); // Default badge
    });

    it('handles adding new website', () => {
        // Mock permissions
        global.chrome.permissions = {
            request: jest.fn((options, callback) => callback(true))
        };
        global.chrome.scripting = {
            registerContentScripts: jest.fn((scripts, callback) => callback())
        };

        const input = document.getElementById('domain-input');
        input.value = 'mycustomsite.com';
        
        manager.handleAddWebsite();

        expect(global.chrome.permissions.request).toHaveBeenCalled();
        expect(global.chrome.scripting.registerContentScripts).toHaveBeenCalled();
        expect(global.mockStorage.whitelistedWebsites.length).toBe(1);
        expect(global.mockStorage.whitelistedWebsites[0].domain).toBe('mycustomsite.com');
    });
});
