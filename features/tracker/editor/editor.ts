/**
 * @file features/tracker/editor/editor.ts
 * @description Manages the markdown notes editor panel.
 * Provides real-time rendering previews, auto-save triggers,
 * and updates review card approach files or fallback draft directories.
 */
import { Markdown } from '@common/markdown';
import { Logger } from '@common/logger';
import { Card, StorageData } from '../../../types/domain';

interface DraftEntry {
    approach?: string;
    timeComplexity?: string;
    spaceComplexity?: string;
    [key: string]: unknown;
}

interface BookmarkEntry {
    url: string;
    title?: string;
}

export class EditorManager {
    problemUrl: string;
    cleanUrl: string;
    cardId: string;
    isCardExisting: boolean;
    autoSaveTimer: ReturnType<typeof setTimeout> | null;
    isPreviewMode: boolean;

    constructor() {
        this.problemUrl = '';
        this.cleanUrl = '';
        this.cardId = '';
        this.isCardExisting = false;
        this.autoSaveTimer = null;
        this.isPreviewMode = false;
    }

    /**
     * Initializes parameters and binds element events.
     */
    init(): void {
        try {
            // 1. Parse URL Parameter
            const params = new URLSearchParams(window.location.search);
            this.problemUrl = params.get('url') || '';
            this.cardId = params.get('cardId') || '';
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
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('EditorManager', `Failed to initialize EditorManager: ${errorMessage}`, { err });
            // Comment: Non-fatal initialization error recovery
        }
    }

    /**
     * Retrieves current FSRS cards, drafts, and bookmarks to fill editor textfields.
     */
    loadContent(): void {
        try {
            chrome.storage.local.get(['fsrsCards', 'bookmarks', 'approachDrafts'], (result: StorageData & { bookmarks?: BookmarkEntry[]; approachDrafts?: Record<string, DraftEntry | string> }) => {
                try {
                    const cards: Card[] = result.fsrsCards || [];
                    const bookmarks: BookmarkEntry[] = result.bookmarks || [];
                    const drafts: Record<string, DraftEntry | string> = result.approachDrafts || {};

                    let card: Card | undefined;
                    if (this.cardId) {
                        card = cards.find((c: Card) => c.id === this.cardId);
                    }
                    if (!card && this.cleanUrl) {
                        card = cards.find((c: Card) => c.problemUrl && c.problemUrl.split('?')[0].split('#')[0] === this.cleanUrl);
                    }

                    const urlEl = document.getElementById('problem-url');
                    const titleEl = document.getElementById('problem-title');
                    const textarea = document.getElementById('editor-textarea') as HTMLTextAreaElement | null;
                    const tcInput = document.getElementById('time-complexity-input') as HTMLInputElement | null;
                    const scInput = document.getElementById('space-complexity-input') as HTMLInputElement | null;
                    const statusEl = document.getElementById('save-status');

                    if (urlEl) urlEl.textContent = this.problemUrl;

                    if (card) {
                        this.isCardExisting = true;
                        if (!this.cardId && card.id) this.cardId = card.id;
                        if (titleEl) titleEl.textContent = card.problemTitle || (card as Card & { title?: string }).title || "FSRS Insights";
                        if (textarea) textarea.value = card.approach || "";
                        if (tcInput) tcInput.value = (card as Card & { timeComplexity?: string }).timeComplexity || "";
                        if (scInput) scInput.value = (card as Card & { spaceComplexity?: string }).spaceComplexity || "";
                        if (statusEl) statusEl.textContent = "Loaded FSRS card";
                    } else {
                        this.isCardExisting = false;
                        const bookmark = bookmarks.find((b: BookmarkEntry) => b.url.split('?')[0].split('#')[0] === this.cleanUrl);
                        if (titleEl) titleEl.textContent = (bookmark && bookmark.title) || this.getCleanDisplayUrl(this.problemUrl);
                        
                        const draftVal = drafts[this.cleanUrl];
                        let draftText = "";
                        let tc = "";
                        let sc = "";
                        if (draftVal) {
                            if (typeof draftVal === 'object' && draftVal !== null) {
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
                } catch (innerErr) {
                    const errorMessage = innerErr instanceof Error ? innerErr.message : String(innerErr);
                    Logger.error('Editor', `Error populating editor content: ${errorMessage}`, { innerErr });
                }
            });
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('Editor', `Failed to load storage in Editor loadContent: ${errorMessage}`, { err });
        }
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
                    const win = window as unknown as { AlgoRecall?: { Markdown?: typeof Markdown } };
                    editorPreview.innerHTML = win.AlgoRecall?.Markdown
                        ? win.AlgoRecall.Markdown.render(text)
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
        try {
            const text = (document.getElementById('editor-textarea') as HTMLTextAreaElement)?.value || '';
            const tc = (document.getElementById('time-complexity-input') as HTMLInputElement)?.value.trim() || '';
            const sc = (document.getElementById('space-complexity-input') as HTMLInputElement)?.value.trim() || '';
            
            chrome.storage.local.get(['fsrsCards', 'approachDrafts'], (result: StorageData & { approachDrafts?: Record<string, DraftEntry> }) => {
                try {
                    if (this.isCardExisting) {
                        const cards: Card[] = result.fsrsCards || [];
                        let index = -1;
                        if (this.cardId) {
                            index = cards.findIndex((c: Card) => c.id === this.cardId);
                        }
                        if (index === -1 && this.cleanUrl) {
                            index = cards.findIndex((c: Card) => c.problemUrl && c.problemUrl.split('?')[0].split('#')[0] === this.cleanUrl);
                        }
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
                        const drafts: Record<string, DraftEntry> = result.approachDrafts || {};
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
                } catch (innerErr) {
                    const errorMessage = innerErr instanceof Error ? innerErr.message : String(innerErr);
                    Logger.error('EditorManager', `Error writing saveContent payload to storage: ${errorMessage}`, { innerErr });
                    if (callback) callback();
                }
            });
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('EditorManager', `Failed to execute saveContent: ${errorMessage}`, { err });
            if (callback) callback();
        }
    }

    /**
     * Normalizes complex raw URLs into short hostnames for labels.
     */
    getCleanDisplayUrl(url: string): string {
        try {
            const u = new URL(url);
            return u.hostname + u.pathname;
        } catch {
            return url;
        }
    }

    /**
     * Renders status feedback messages using temporary toasts.
     */
    showToast(message: string): void {
        try {
            const toast = document.getElementById('status-toast');
            if (!toast) return;
            toast.textContent = message;
            toast.classList.add('show');
            setTimeout(() => {
                toast.classList.remove('show');
            }, 2000);
        } catch {
            // Comment: Ignore toast DOM display errors
        }
    }
}

function initEditor(): void {
    try {
        const editor = new EditorManager();
        editor.init();
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        Logger.error('EditorManager', `Initialization failed: ${errorMessage}`, { err });
    }
}

if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initEditor);
    } else {
        initEditor();
    }
}
