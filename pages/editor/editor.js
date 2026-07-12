let problemUrl = '';
let cleanUrl = '';
let isCardExisting = false;
let autoSaveTimer = null;

document.addEventListener('DOMContentLoaded', () => {
    // 1. Parse URL Parameter
    const params = new URLSearchParams(window.location.search);
    problemUrl = params.get('url') || '';
    cleanUrl = problemUrl.split('?')[0].split('#')[0];

    if (!problemUrl) {
        document.getElementById('problem-title').textContent = "Error: No URL provided";
        document.getElementById('save-status').textContent = "Failed to load";
        return;
    }

    // 2. Load Content
    chrome.storage.local.get(['fsrsCards', 'bookmarks', 'approachDrafts'], (result) => {
        const cards = result.fsrsCards || [];
        const bookmarks = result.bookmarks || [];
        const drafts = result.approachDrafts || {};

        const card = cards.find(c => c.problemUrl.split('?')[0].split('#')[0] === cleanUrl);
        document.getElementById('problem-url').textContent = problemUrl;

        if (card) {
            isCardExisting = true;
            document.getElementById('problem-title').textContent = card.title || "FSRS Insights";
            document.getElementById('editor-textarea').value = card.approach || "";
            document.getElementById('save-status').textContent = "Loaded FSRS card";
        } else {
            isCardExisting = false;
            const bookmark = bookmarks.find(b => b.url.split('?')[0].split('#')[0] === cleanUrl);
            document.getElementById('problem-title').textContent = (bookmark && bookmark.title) || getCleanDisplayUrl(problemUrl);
            document.getElementById('editor-textarea').value = drafts[cleanUrl] || "";
            document.getElementById('save-status').textContent = "Loaded draft notes";
        }
    });

    // 3. Register Event Listeners
    const textarea = document.getElementById('editor-textarea');
    textarea.addEventListener('input', () => {
        document.getElementById('save-status').textContent = "Typing...";
        clearTimeout(autoSaveTimer);
        autoSaveTimer = setTimeout(() => {
            saveContent(() => {
                document.getElementById('save-status').textContent = "Changes saved automatically";
            });
        }, 300);
    });

    // Explicit Save Button
    document.getElementById('save-btn').addEventListener('click', () => {
        saveContent(() => {
            showToast("Progress saved!");
        });
    });

    // Save & Close Button
    document.getElementById('save-close-btn').addEventListener('click', () => {
        saveContent(() => {
            window.close();
        });
    });

    // Header Back / Close Button
    document.getElementById('header-back-btn').addEventListener('click', () => {
        saveContent(() => {
            window.close();
        });
    });

    // Save on tab exit/close
    window.addEventListener('pagehide', () => {
        saveContent();
    });
    window.addEventListener('beforeunload', () => {
        saveContent();
    });
});

function saveContent(callback) {
    const text = document.getElementById('editor-textarea').value;
    
    chrome.storage.local.get(['fsrsCards', 'approachDrafts'], (result) => {
        if (isCardExisting) {
            const cards = result.fsrsCards || [];
            const index = cards.findIndex(c => c.problemUrl.split('?')[0].split('#')[0] === cleanUrl);
            if (index > -1) {
                cards[index].approach = text;
                chrome.storage.local.set({ fsrsCards: cards }, () => {
                    if (callback) callback();
                });
            } else {
                if (callback) callback();
            }
        } else {
            const drafts = result.approachDrafts || {};
            drafts[cleanUrl] = text;
            chrome.storage.local.set({ approachDrafts: drafts }, () => {
                if (callback) callback();
            });
        }
    });
}

function getCleanDisplayUrl(url) {
    try {
        const u = new URL(url);
        return u.hostname + u.pathname;
    } catch (e) {
        return url;
    }
}

function showToast(message) {
    const toast = document.getElementById('status-toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 2000);
}
