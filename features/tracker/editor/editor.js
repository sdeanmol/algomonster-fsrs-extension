/**
 * @file features/tracker/editor/editor.js
 * @description Manages the markdown notes editor panel.
 * Provides real-time rendering previews, auto-save triggers,
 * and updates review card approach files or fallback draft directories.
 * Upstream dependencies: features/common/markdown.js (uses renderMarkdown).
 * Downstream dependencies: chrome.storage (reads/writes fsrsCards, approachDrafts).
 */

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
            
            const draftVal = drafts[cleanUrl];
            let draftText = "";
            if (draftVal) {
                if (typeof draftVal === 'object') {
                    draftText = draftVal.approach || "";
                } else {
                    draftText = draftVal;
                }
            }
            document.getElementById('editor-textarea').value = draftText;
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

    // R1.5: Markdown Preview Toggle
    let isPreviewMode = false;
    const previewToggleBtn = document.getElementById('preview-toggle-btn');
    const editorPreview = document.getElementById('editor-preview');

    if (previewToggleBtn && editorPreview) {
        previewToggleBtn.addEventListener('click', () => {
            isPreviewMode = !isPreviewMode;

            if (isPreviewMode) {
                // Render preview
                const text = document.getElementById('editor-textarea').value;
                editorPreview.innerHTML = typeof renderMarkdown === 'function'
                    ? renderMarkdown(text)
                    : text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
                
                document.getElementById('editor-textarea').style.display = 'none';
                editorPreview.style.display = 'block';
                previewToggleBtn.innerHTML = `<svg class="svg-icon" viewBox="0 0 24 24" style="width: 13px; height: 13px; stroke: currentColor;"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg> Edit`;
            } else {
                // Back to edit mode
                document.getElementById('editor-textarea').style.display = '';
                editorPreview.style.display = 'none';
                previewToggleBtn.innerHTML = `<svg class="svg-icon" viewBox="0 0 24 24" style="width: 13px; height: 13px; stroke: currentColor;"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg> Preview`;
                document.getElementById('editor-textarea').focus();
            }
        });
    }

    // Save on tab exit/close
    window.addEventListener('pagehide', () => {
        saveContent();
    });
    window.addEventListener('beforeunload', () => {
        saveContent();
    });
});

/**
 * Saves current text field content as card approach data or fallback drafts.
 * @param {Function} [callback] - Invoked on completed storage transactions.
 */
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
            const existingDraft = drafts[cleanUrl];
            if (existingDraft && typeof existingDraft === 'object') {
                existingDraft.approach = text;
            } else {
                drafts[cleanUrl] = text;
            }
            chrome.storage.local.set({ approachDrafts: drafts }, () => {
                if (callback) callback();
            });
        }
    });
}

/**
 * Normalizes complex raw URLs into short hostnames for labels.
 * @param {string} url - Raw URL string.
 * @returns {string} Hostname and path segments.
 */
function getCleanDisplayUrl(url) {
    try {
        const u = new URL(url);
        return u.hostname + u.pathname;
    } catch (e) {
        return url;
    }
}

/**
 * Renders status feedback messages using temporary toasts.
 * @param {string} message - Text feedback string.
 */
function showToast(message) {
    const toast = document.getElementById('status-toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 2000);
}

