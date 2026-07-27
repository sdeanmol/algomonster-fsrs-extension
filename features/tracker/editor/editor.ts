/**
 * @file features/tracker/editor/editor.ts
 * @description Manages the markdown notes editor panel.
 * Provides real-time rendering previews, auto-save triggers,
 * and updates review card approach files or fallback draft directories.
 */
import { Markdown } from '@common/markdown';

class EditorManager {
    problemUrl: string;
    cleanUrl: string;
    isCardExisting: boolean;
    autoSaveTimer: ReturnType<typeof setTimeout> | null;
    isPreviewMode: boolean;

    constructor() {
        this.problemUrl = '';
        this.cleanUrl = '';
        this.isCardExisting = false;
        this.autoSaveTimer = null;
        this.isPreviewMode = false;
    }

    /**
     * Initializes parameters and binds element events.
     */
    init(): void {
        // 1. Parse URL Parameter
        const params = new URLSearchParams(window.location.search);
        this.problemUrl = params.get('url') || '';
        this.cleanUrl = this.problemUrl.split('?')[0].split('#')[0];

        const titleEl = document.getElementById('problem-title');
        const statusEl = document.getElementById('save-status');

        if (!this.problemUrl) {
            if (titleEl) titleEl.textContent = "Error: No URL provided";
            if (statusEl) statusEl.textContent = "Failed to load";
            return;
        }

        // 2. Load Content
        this.loadContent();

        // 3. Register Event Listeners
        this.bindEvents();
    }

    /**
     * Retrieves current FSRS cards, drafts, and bookmarks to fill editor textfields.
     */
    loadContent(): void {
        chrome.storage.local.get(['fsrsCards', 'bookmarks', 'approachDrafts'], (result: { [key: string]: any }) => {
            const cards = result.fsrsCards || [];
            const bookmarks = result.bookmarks || [];
            const drafts = result.approachDrafts || {};

            const card = cards.find((c: any) => c.problemUrl.split('?')[0].split('#')[0] === this.cleanUrl);
            const urlEl = document.getElementById('problem-url');
            const titleEl = document.getElementById('problem-title');
            const textarea = document.getElementById('editor-textarea') as HTMLTextAreaElement | null;
            const tcInput = document.getElementById('time-complexity-input') as HTMLInputElement | null;
            const scInput = document.getElementById('space-complexity-input') as HTMLInputElement | null;
            const statusEl = document.getElementById('save-status');

            if (urlEl) urlEl.textContent = this.problemUrl;

            if (card) {
                this.isCardExisting = true;
                if (titleEl) titleEl.textContent = card.title || "FSRS Insights";
                if (textarea) textarea.value = card.approach || "";
                if (tcInput) tcInput.value = card.timeComplexity || "";
                if (scInput) scInput.value = card.spaceComplexity || "";
                if (statusEl) statusEl.textContent = "Loaded FSRS card";
            } else {
                this.isCardExisting = false;
                const bookmark = bookmarks.find((b: any) => b.url.split('?')[0].split('#')[0] === this.cleanUrl);
                if (titleEl) titleEl.textContent = (bookmark && bookmark.title) || this.getCleanDisplayUrl(this.problemUrl);
                
                const draftVal = drafts[this.cleanUrl];
                let draftText = "";
                let tc = "";
                let sc = "";
                if (draftVal) {
                    if (typeof draftVal === 'object') {
                        draftText = draftVal.approach || "";
                        tc = draftVal.timeComplexity || "";
                        sc = draftVal.spaceComplexity || "";
                    } else {
                        draftText = draftVal;
                    }
                }
                if (textarea) textarea.value = draftText;
                if (tcInput) tcInput.value = tc;
                if (scInput) scInput.value = sc;
                if (statusEl) statusEl.textContent = "Loaded draft notes";
            }
        });
    }

    /**
     * Hooks listeners to editor button controls, textareas, and window lifecycle updates.
     */
    bindEvents(): void {
        const triggerAutoSave = () => {
            const statusEl = document.getElementById('save-status');
            if (statusEl) statusEl.textContent = "Typing...";
            if (this.autoSaveTimer) clearTimeout(this.autoSaveTimer);
            this.autoSaveTimer = setTimeout(() => {
                this.saveContent(() => {
                    if (statusEl) statusEl.textContent = "Changes saved automatically";
                });
            }, 300);
        };

        const textarea = document.getElementById('editor-textarea') as HTMLTextAreaElement | null;
        const tcInput = document.getElementById('time-complexity-input') as HTMLInputElement | null;
        const scInput = document.getElementById('space-complexity-input') as HTMLInputElement | null;

        textarea?.addEventListener('input', triggerAutoSave);
        tcInput?.addEventListener('input', triggerAutoSave);
        scInput?.addEventListener('input', triggerAutoSave);

        // Explicit Save Button
        document.getElementById('save-btn')?.addEventListener('click', () => {
            this.saveContent(() => {
                this.showToast("Progress saved!");
            });
        });

        // Save & Close Button
        document.getElementById('save-close-btn')?.addEventListener('click', () => {
            this.saveContent(() => {
                window.close();
            });
        });

        // Header Back / Close Button
        document.getElementById('header-back-btn')?.addEventListener('click', () => {
            this.saveContent(() => {
                window.close();
            });
        });

        // Markdown Preview Toggle
        const previewToggleBtn = document.getElementById('preview-toggle-btn');
        const editorPreview = document.getElementById('editor-preview');

        if (previewToggleBtn && editorPreview) {
            previewToggleBtn.addEventListener('click', () => {
                this.isPreviewMode = !this.isPreviewMode;

                if (this.isPreviewMode) {
                    // Render preview
                    const text = (document.getElementById('editor-textarea') as HTMLTextAreaElement)?.value || '';
                    editorPreview.innerHTML = ((window as any).AlgoRecall && (window as any).AlgoRecall.Markdown)
                        ? (window as any).AlgoRecall.Markdown.render(text)
                        : text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
                    
                    const textarea = document.getElementById('editor-textarea');
                    if (textarea) textarea.style.display = 'none';
                    editorPreview.style.display = 'block';
                    previewToggleBtn.innerHTML = `<svg class="svg-icon" viewBox="0 0 24 24" style="width: 13px; height: 13px; stroke: currentColor;"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg> Edit`;
                } else {
                    // Back to edit mode
                    const textarea = document.getElementById('editor-textarea') as HTMLTextAreaElement | null;
                    if (textarea) textarea.style.display = '';
                    editorPreview.style.display = 'none';
                    previewToggleBtn.innerHTML = `<svg class="svg-icon" viewBox="0 0 24 24" style="width: 13px; height: 13px; stroke: currentColor;"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg> Preview`;
                    textarea?.focus();
                }
            });
        }

        // Save on tab exit/close
        window.addEventListener('pagehide', () => {
            this.saveContent();
        });
        window.addEventListener('beforeunload', () => {
            this.saveContent();
        });
    }

    /**
     * Saves current text field content as card approach data or fallback drafts.
     */
    saveContent(callback?: () => void): void {
        const text = (document.getElementById('editor-textarea') as HTMLTextAreaElement)?.value || '';
        const tc = (document.getElementById('time-complexity-input') as HTMLInputElement)?.value.trim() || '';
        const sc = (document.getElementById('space-complexity-input') as HTMLInputElement)?.value.trim() || '';
        
        chrome.storage.local.get(['fsrsCards', 'approachDrafts'], (result: { [key: string]: any }) => {
            if (this.isCardExisting) {
                const cards = result.fsrsCards || [];
                const index = cards.findIndex((c: any) => c.problemUrl.split('?')[0].split('#')[0] === this.cleanUrl);
                if (index > -1) {
                    cards[index].approach = text;
                    cards[index].timeComplexity = tc;
                    cards[index].spaceComplexity = sc;
                    chrome.storage.local.set({ fsrsCards: cards }, () => {
                        if (callback) callback();
                    });
                } else {
                    if (callback) callback();
                }
            } else {
                const drafts = result.approachDrafts || {};
                const existingDraft = drafts[this.cleanUrl];
                if (existingDraft && typeof existingDraft === 'object') {
                    existingDraft.approach = text;
                    existingDraft.timeComplexity = tc;
                    existingDraft.spaceComplexity = sc;
                } else {
                    drafts[this.cleanUrl] = {
                        approach: text,
                        timeComplexity: tc,
                        spaceComplexity: sc
                    };
                }
                chrome.storage.local.set({ approachDrafts: drafts }, () => {
                    if (callback) callback();
                });
            }
        });
    }

    /**
     * Normalizes complex raw URLs into short hostnames for labels.
     */
    getCleanDisplayUrl(url: string): string {
        try {
            const u = new URL(url);
            return u.hostname + u.pathname;
        } catch (e) {
            return url;
        }
    }

    /**
     * Renders status feedback messages using temporary toasts.
     */
    showToast(message: string): void {
        const toast = document.getElementById('status-toast');
        if (!toast) return;
        toast.textContent = message;
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
        }, 2000);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const editor = new EditorManager();
    editor.init();
});
