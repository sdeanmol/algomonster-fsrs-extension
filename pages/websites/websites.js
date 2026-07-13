const defaultSites = [
    "algo.monster",
    "systemdesignschool.io",
    "codeforces.com",
    "leetcode.com",
    "codechef.com",
    "atcoder.jp",
    "hackerrank.com",
    "hackerearth.com",
    "codewars.com",
    "codingame.com"
];

document.addEventListener('DOMContentLoaded', () => {
    // Render default sites list
    renderDefaultSites();

    // Render custom sites list
    loadAndRenderCustomSites();

    // Close button
    document.getElementById('back-to-popup-btn').addEventListener('click', () => {
        window.close();
    });

    // Add website domain
    document.getElementById('add-domain-btn').addEventListener('click', handleAddWebsite);
    
    // Allow pressing Enter key in text input
    document.getElementById('domain-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleAddWebsite();
    });
});

function renderDefaultSites() {
    const list = document.getElementById('default-sites-list');
    if (!list) return;
    list.innerHTML = defaultSites.map(site => {
        const monogram = site.substring(0, 1).toUpperCase();
        return `
            <li>
                <div class="site-name-wrapper">
                    <div class="site-icon-fallback">${monogram}</div>
                    <span>${site}</span>
                </div>
                <span class="site-badge protected">Default</span>
            </li>
        `;
    }).join('');
}

function loadAndRenderCustomSites() {
    const list = document.getElementById('custom-sites-list');
    if (!list) return;

    chrome.storage.local.get(['customWebsites'], (result) => {
        const customSites = result.customWebsites || [];
        if (customSites.length === 0) {
            list.innerHTML = `<li style="justify-content: center; color: var(--md-text-low); font-style: italic;">No custom websites authorized yet.</li>`;
            return;
        }

        list.innerHTML = customSites.map(site => {
            const monogram = site.substring(0, 1).toUpperCase();
            return `
                <li>
                    <div class="site-name-wrapper">
                        <div class="site-icon-fallback" style="color: var(--md-success); border-color: rgba(30, 142, 62, 0.15);">${monogram}</div>
                        <span>${site}</span>
                    </div>
                    <button class="delete-site-btn" data-site="${site}" title="Revoke permissions and delete website">
                        <svg class="svg-icon" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                    </button>
                </li>
            `;
        }).join('');

        // Link delete buttons
        document.querySelectorAll('.delete-site-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const button = e.currentTarget;
                const site = button.getAttribute('data-site');
                handleDeleteWebsite(site);
            });
        });
    });
}

function handleAddWebsite() {
    const input = document.getElementById('domain-input');
    let value = input.value.trim().toLowerCase();
    if (!value) return;

    // Normalize value to a clean hostname
    try {
        if (!value.startsWith('http://') && !value.startsWith('https://')) {
            value = 'https://' + value;
        }
        const url = new URL(value);
        let hostname = url.hostname;
        // strip leading www.
        if (hostname.startsWith('www.')) {
            hostname = hostname.substring(4);
        }

        if (!hostname) {
            showToast("Invalid domain name.");
            return;
        }

        // Check if already in default or custom list
        if (defaultSites.includes(hostname)) {
            showToast("This is a default whitelisted platform!");
            return;
        }

        chrome.storage.local.get(['customWebsites'], (result) => {
            const customSites = result.customWebsites || [];
            if (customSites.includes(hostname)) {
                showToast("Website is already whitelisted.");
                return;
            }

            // Request host permission
            const originPattern = `*://*.${hostname}/*`;

            chrome.permissions.request({
                origins: [originPattern]
            }, (granted) => {
                if (chrome.runtime.lastError) {
                    console.error(chrome.runtime.lastError.message);
                    showToast("Error requesting domain permission.");
                    return;
                }

                if (granted) {
                    // Register content script dynamically
                    chrome.scripting.registerContentScripts([
                        {
                            id: `site-${hostname.replace(/[^a-z0-9]/g, '-')}`,
                            matches: [originPattern],
                            js: ["content/fsrs.js", "content/content.js"],
                            css: ["content/style.css"],
                            runAt: "document_idle",
                            allFrames: true
                        }
                    ], () => {
                        if (chrome.runtime.lastError) {
                            console.error("Script registration error:", chrome.runtime.lastError.message);
                        }

                        // Save to storage
                        customSites.push(hostname);
                        chrome.storage.local.set({ customWebsites: customSites }, () => {
                            input.value = '';
                            loadAndRenderCustomSites();
                            showToast(`Authorized & Whitelisted: ${hostname}`);
                        });
                    });
                } else {
                    showToast("Permission request was declined.");
                }
            });
        });
    } catch (e) {
        showToast("Please enter a valid URL or domain.");
    }
}

function handleDeleteWebsite(site) {
    const originPattern = `*://*.${site}/*`;
    const scriptId = `site-${site.replace(/[^a-z0-9]/g, '-')}`;

    // 1. Unregister content scripts
    chrome.scripting.unregisterContentScripts({
        ids: [scriptId]
    }, () => {
        // Safe check: ignore errors if script wasn't registered
        if (chrome.runtime.lastError) {
            console.warn("Script unregister warning:", chrome.runtime.lastError.message);
        }

        // 2. Remove origin permission
        chrome.permissions.remove({
            origins: [originPattern]
        }, (removed) => {
            if (chrome.runtime.lastError) {
                console.warn("Permission remove warning:", chrome.runtime.lastError.message);
            }

            // 3. Remove from storage
            chrome.storage.local.get(['customWebsites'], (result) => {
                let customSites = result.customWebsites || [];
                customSites = customSites.filter(s => s !== site);

                chrome.storage.local.set({ customWebsites: customSites }, () => {
                    loadAndRenderCustomSites();
                    showToast(`Removed access for: ${site}`);
                });
            });
        });
    });
}

function showToast(msg) {
    const toast = document.getElementById('status-toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.className = 'toast show';
    setTimeout(() => {
        toast.className = 'toast';
    }, 2500);
}
