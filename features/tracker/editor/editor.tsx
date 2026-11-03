/**
 * @file features/tracker/editor/editor.tsx
 * @description Manages the markdown notes and problem approach editor panel.
 * Provides real-time Markdown rendering previews, automatic background debounced saving,
 * and synchronizes changes to existing card records or standalone URL draft notes.
 * Migrated to Preact with TypeScript for modular, accessible editor view components.
 * 
 * Context: Standalone editor tab (`editor.html`) within the Chrome extension.
 * 
 * Key Exports:
 * - `DraftEntry`: Interface defining the shape of unassociated problem approach drafts.
 * - `BookmarkEntry`: Minimal interface representing a bookmarked problem entry.
 * - `EditorHeader`: Preact component for the editor header and status indicator.
 * - `ComplexityInputs`: Preact component for Big-O complexity input fields.
 * - `MarkdownPreview`: Preact component for rendered Markdown solution notes.
 * - `EditorFooter`: Preact component for save and save-and-close action buttons.
 * - `EditorToast`: Preact component for transient status toast messages.
 * - `EditorWorkspace`: Preact container component uniting editor UI sections.
 * - `EditorManager`: Main editor controller class handling DOM events, previews, and persistence.
 */

import { h, Fragment, render, VNode } from 'preact';
import { Markdown } from '@common/markdown';
import { Logger } from '@common/logger';
import { UIUtils } from '@common/utils/uiUtils';
import { Card, StorageData } from '../../../types/domain';

/**
 * Shape of an uncommitted approach draft stored for a problem URL without an existing card.
 */
export interface DraftEntry {
    /** Markdown text describing the algorithmic approach or solution notes. */
    approach?: string;
    /** Big-O time complexity notation (e.g., 'O(N log N)'). */
    timeComplexity?: string;
    /** Big-O space complexity notation (e.g., 'O(1)'). */
    spaceComplexity?: string;
    /** Catch-all for forward compatibility with future metadata. */
    [key: string]: unknown;
}

/**
 * Minimal representation of a bookmarked problem entry for title resolution.
 */
export interface BookmarkEntry {
    /** Target URL of the bookmarked problem. */
    url: string;
    /** Optional friendly title of the bookmarked page. */
    title?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// PREACT UI COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

export interface EditorHeaderProps {
    title: string;
    url: string;
    saveStatus: string;
    isPreviewMode: boolean;
    onTogglePreview: () => void;
    onClose: () => void;
}

/**
 * Preact component for the top navigation header, problem title, preview toggle, and save status indicator.
 */
export function EditorHeader({
    title,
    url,
    saveStatus,
    isPreviewMode,
    onTogglePreview,
    onClose
}: EditorHeaderProps): VNode {
    return (
        <div className="editor-header">
            <div className="header-left">
                <button
                    type="button"
                    className="back-arrow"
                    id="header-back-btn"
                    title="Close and return"
                    onClick={onClose}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onClose();
                        }
                    }}
                >
                    <svg
                        className="svg-icon"
                        viewBox="0 0 24 24"
                        style={{ marginRight: '4px', width: '12px', height: '12px' }}
                        aria-hidden="true"
                    >
                        <line x1="19" y1="12" x2="5" y2="12" />
                        <polyline points="12 19 5 12 12 5" />
                    </svg>
                    Close
                </button>
                <div className="title-info">
                    <div className="algorecall-brand-badge brand-badge-sm">
                        <svg className="svg-icon logo-icon algorecall-brand-icon" viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-2.5 2.5C6 22 4 19.5 4 17c0-1.5 1-2.5 1-3.5 0-1-1-2-1-3.5 0-2.5 2-5 5.5-6z" />
                            <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 2.5 2.5C18 22 20 19.5 20 17c0-1.5-1-2.5-1-3.5 0-1 1-2 1-3.5 0-2.5-2-5-5.5-6z" />
                            <path d="M12 8h2M12 12h3M12 16h2M10 8h2M9 12h3M10 16h2" />
                        </svg>
                        <span className="algorecall-brand-name">AlgoRecall</span>
                    </div>
                    <h2 id="problem-title">{title || 'Loading problem details...'}</h2>
                    <span id="problem-url" className="url-subtext">{url || 'Loading URL...'}</span>
                </div>
            </div>
            <div className="header-right">
                <button
                    id="preview-toggle-btn"
                    className="btn btn-secondary btn-sm"
                    title="Toggle Markdown Preview"
                    aria-label="Toggle Markdown Preview"
                    onClick={onTogglePreview}
                >
                    {isPreviewMode ? (
                        <Fragment>
                            <svg className="svg-icon" viewBox="0 0 24 24" style={{ width: '13px', height: '13px', stroke: 'currentColor' }} aria-hidden="true">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg> Edit
                        </Fragment>
                    ) : (
                        <Fragment>
                            <svg className="svg-icon" viewBox="0 0 24 24" style={{ width: '13px', height: '13px', stroke: 'currentColor' }} aria-hidden="true">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                <circle cx="12" cy="12" r="3" />
                            </svg> Preview
                        </Fragment>
                    )}
                </button>
                <span id="save-status" className="status-indicator" aria-live="polite">
                    {saveStatus || 'Loading FSRS data...'}
                </span>
            </div>
        </div>
    );
}

export interface ComplexityInputsProps {
    timeComplexity: string;
    spaceComplexity: string;
    onTimeChange: (val: string) => void;
    onSpaceChange: (val: string) => void;
}

/**
 * Preact component for Time and Space Complexity input controls.
 */
export function ComplexityInputs({
    timeComplexity,
    spaceComplexity,
    onTimeChange,
    onSpaceChange
}: ComplexityInputsProps): VNode {
    return (
        <div className="complexity-bar">
            <div className="complexity-field">
                <label htmlFor="time-complexity-input">Time Complexity:</label>
                <input
                    type="text"
                    id="time-complexity-input"
                    placeholder="Time complexity"
                    className="input-field"
                    value={timeComplexity}
                    onInput={(e) => onTimeChange((e.target as HTMLInputElement).value)}
                />
            </div>
            <div className="complexity-field">
                <label htmlFor="space-complexity-input">Space Complexity:</label>
                <input
                    type="text"
                    id="space-complexity-input"
                    placeholder="Space complexity"
                    className="input-field"
                    value={spaceComplexity}
                    onInput={(e) => onSpaceChange((e.target as HTMLInputElement).value)}
                />
            </div>
        </div>
    );
}

export interface MarkdownPreviewProps {
    content: string;
}

/**
 * Preact component for rendering Markdown HTML previews.
 */
export function MarkdownPreview({ content }: MarkdownPreviewProps): VNode {
    if (!content || !content.trim()) {
        return (
            <p className="editor-preview-empty">
                <em>No content to preview. Switch to Edit mode to jot down notes.</em>
            </p>
        );
    }

    const win = typeof window !== 'undefined' ? (window as unknown as { AlgoRecall?: { Markdown?: typeof Markdown } }) : undefined;
    const renderFn = win?.AlgoRecall?.Markdown?.render || Markdown.render;
    const renderedHtml = renderFn(content);

    return <div dangerouslySetInnerHTML={{ __html: renderedHtml }} />;
}

export interface EditorFooterProps {
    onSave: () => void;
    onSaveAndClose: () => void;
}

/**
 * Preact component for Save and Save & Close action buttons in the editor footer.
 */
export function EditorFooter({ onSave, onSaveAndClose }: EditorFooterProps): VNode {
    return (
        <div className="editor-footer">
            <div className="footer-actions">
                <button id="save-btn" className="btn btn-secondary" onClick={onSave}>
                    <svg className="svg-icon" viewBox="0 0 24 24" style={{ width: '14px', height: '14px', stroke: 'currentColor' }} aria-hidden="true">
                        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                        <polyline points="17 21 17 13 7 13 7 21" />
                        <polyline points="7 3 7 8 15 8" />
                    </svg>
                    Save Progress
                </button>
                <button id="save-close-btn" className="btn btn-primary" onClick={onSaveAndClose}>
                    <svg className="svg-icon" viewBox="0 0 24 24" style={{ width: '14px', height: '14px', stroke: 'currentColor' }} aria-hidden="true">
                        <polyline points="20 6 9 17 4 12" />
                    </svg>
                    Save & Close
                </button>
            </div>
        </div>
    );
}

export interface EditorToastProps {
    message: string;
    show: boolean;
}

/**
 * Preact component for transient status toast notices.
 */
export function EditorToast({ message, show }: EditorToastProps): VNode {
    return (
        <div id="status-toast" className={`toast ${show ? 'show' : ''}`}>
            {message}
        </div>
    );
}

export interface EditorWorkspaceProps {
    title: string;
    url: string;
    saveStatus: string;
    timeComplexity: string;
    spaceComplexity: string;
    approach: string;
    isPreviewMode: boolean;
    toastMessage: string;
    isToastVisible: boolean;
    onTimeChange: (val: string) => void;
    onSpaceChange: (val: string) => void;
    onApproachChange: (val: string) => void;
    onTogglePreview: () => void;
    onSave: () => void;
    onSaveAndClose: () => void;
    onClose: () => void;
}

/**
 * Preact container component uniting the header, workspace, and footer sections.
 */
export function EditorWorkspace(props: EditorWorkspaceProps): VNode {
    return (
        <div className="editor-container">
            <EditorHeader
                title={props.title}
                url={props.url}
                saveStatus={props.saveStatus}
                isPreviewMode={props.isPreviewMode}
                onTogglePreview={props.onTogglePreview}
                onClose={props.onClose}
            />

            <div className="workspace">
                <ComplexityInputs
                    timeComplexity={props.timeComplexity}
                    spaceComplexity={props.spaceComplexity}
                    onTimeChange={props.onTimeChange}
                    onSpaceChange={props.onSpaceChange}
                />

                <textarea
                    id="editor-textarea"
                    className="fullscreen-textarea"
                    placeholder="How did you solve this pattern? Jot down your key insights, complexity analysis, approach steps...
Supports Markdown: **bold**, *italic*, `code`, ```code blocks```, ## headings, - lists"
                    style={{ display: props.isPreviewMode ? 'none' : '' }}
                    value={props.approach}
                    onInput={(e) => props.onApproachChange((e.target as HTMLTextAreaElement).value)}
                />

                <div
                    id="editor-preview"
                    className="editor-preview fsrs-markdown"
                    style={{ display: props.isPreviewMode ? 'block' : 'none' }}
                >
                    <MarkdownPreview content={props.approach} />
                </div>
            </div>

            <EditorFooter
                onSave={props.onSave}
                onSaveAndClose={props.onSaveAndClose}
            />

            <EditorToast
                message={props.toastMessage}
                show={props.isToastVisible}
            />
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// EDITOR CONTROLLER CLASS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Controller for the Markdown notes and approach editor page.
 */
export class EditorManager {
    /** Raw problem URL passed via query parameters. */
    problemUrl: string;
    /** Cleaned URL stripped of hash and query fragments. */
    cleanUrl: string;
    /** Card ID if an existing card is being edited. */
    cardId: string;
    /** Whether the edited notes belong to an existing FSRS card or a draft. */
    isCardExisting: boolean;
    /** Debounce timer reference for auto-saving typed input. */
    autoSaveTimer: ReturnType<typeof setTimeout> | null;
    /** Active toggle status between Markdown editing and rendered preview modes. */
    isPreviewMode: boolean;

    /**
     * Initializes default properties for the editor controller.
     */
    constructor() {
        this.problemUrl = '';
        this.cleanUrl = '';
        this.cardId = '';
        this.isCardExisting = false;
        this.autoSaveTimer = null;
        this.isPreviewMode = false;
    }

    /**
     * Initializes editor parameters from URL query arguments, loads content from storage,
     * and sets up UI event listeners.
     * 
     * @returns {void}
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
        }
    }

    /**
     * Retrieves stored cards, bookmarks, and drafts from `chrome.storage.local` to populate
     * the markdown textarea, complexity inputs, and title displays.
     * 
     * @returns {void}
     */
    loadContent(): void {
        try {
            if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
                Logger.warn('EditorManager', 'Browser extension storage unavailable in loadContent.');
                return;
            }
            chrome.storage.local.get(['fsrsCards', 'bookmarks', 'approachDrafts'], (result: StorageData & { bookmarks?: BookmarkEntry[]; approachDrafts?: Record<string, DraftEntry | string> }) => {
                try {
                    if (chrome.runtime?.lastError) {
                        const errorMessage = chrome.runtime.lastError.message || String(chrome.runtime.lastError);
                        Logger.error('EditorManager', `Storage get error in loadContent: ${errorMessage}`, { error: chrome.runtime.lastError });
                        return;
                    }
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
                        const bookmark = bookmarks.find((b: BookmarkEntry) => b.url && b.url.split('?')[0].split('#')[0] === this.cleanUrl);
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
                                draftText = String(draftVal);
                            }
                        }
                        if (textarea) textarea.value = draftText;
                        if (tcInput) tcInput.value = tc;
                        if (scInput) scInput.value = sc;
                        if (statusEl) statusEl.textContent = "Loaded draft notes";
                    }
                } catch (innerErr) {
                    const errorMessage = innerErr instanceof Error ? innerErr.message : String(innerErr);
                    Logger.error('EditorManager', `Error populating editor content: ${errorMessage}`, { innerErr });
                }
            });
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('EditorManager', `Failed to load storage in Editor loadContent: ${errorMessage}`, { err });
        }
    }

    /**
     * Binds input debounce triggers for auto-saving, button click handlers,
     * live Markdown preview toggling, and unload save handlers.
     * 
     * @returns {void}
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
                UIUtils.closeCurrentTab();
            });
        });

        // Header Back / Close Button
        const headerBackBtn = document.getElementById('header-back-btn');
        if (headerBackBtn) {
            const closeHandler = () => {
                this.saveContent(() => {
                    UIUtils.closeCurrentTab();
                });
            };
            headerBackBtn.addEventListener('click', closeHandler);
            headerBackBtn.addEventListener('keydown', (e: KeyboardEvent) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    closeHandler();
                }
            });
        }

        // Markdown Preview Toggle
        const previewToggleBtn = document.getElementById('preview-toggle-btn');
        const editorPreview = document.getElementById('editor-preview');

        if (previewToggleBtn && editorPreview) {
            previewToggleBtn.addEventListener('click', () => {
                this.isPreviewMode = !this.isPreviewMode;

                if (this.isPreviewMode) {
                    // Render preview via Preact MarkdownPreview component
                    const text = (document.getElementById('editor-textarea') as HTMLTextAreaElement)?.value || '';
                    render(<MarkdownPreview content={text} />, editorPreview);
                    
                    const textareaElement = document.getElementById('editor-textarea');
                    if (textareaElement) textareaElement.style.display = 'none';
                    editorPreview.style.display = 'block';
                    previewToggleBtn.innerHTML = `<svg class="svg-icon" viewBox="0 0 24 24" style="width: 13px; height: 13px; stroke: currentColor;"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg> Edit`;
                } else {
                    // Back to edit mode
                    render(null, editorPreview);
                    const textareaElement = document.getElementById('editor-textarea') as HTMLTextAreaElement | null;
                    if (textareaElement) textareaElement.style.display = '';
                    editorPreview.style.display = 'none';
                    previewToggleBtn.innerHTML = `<svg class="svg-icon" viewBox="0 0 24 24" style="width: 13px; height: 13px; stroke: currentColor;"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg> Preview`;
                    textareaElement?.focus();
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
     * Persists current markdown text and complexity notes to `chrome.storage.local`.
     * If editing an existing card, modifies the card entry in `fsrsCards`; otherwise, saves
     * into the `approachDrafts` dictionary keyed by clean problem URL.
     * 
     * @param {() => void} [callback] - Optional completion callback executed after storage write.
     * @returns {void}
     */
    saveContent(callback?: () => void): void {
        try {
            if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
                Logger.warn('EditorManager', 'Browser extension storage unavailable in saveContent.');
                if (callback) callback();
                return;
            }
            const text = (document.getElementById('editor-textarea') as HTMLTextAreaElement)?.value || '';
            const tc = (document.getElementById('time-complexity-input') as HTMLInputElement)?.value.trim() || '';
            const sc = (document.getElementById('space-complexity-input') as HTMLInputElement)?.value.trim() || '';
            
            chrome.storage.local.get(['fsrsCards', 'approachDrafts'], (result: StorageData & { approachDrafts?: Record<string, DraftEntry> }) => {
                try {
                    if (chrome.runtime?.lastError) {
                        const errorMessage = chrome.runtime.lastError.message || String(chrome.runtime.lastError);
                        Logger.error('EditorManager', `Storage get error in saveContent: ${errorMessage}`, { error: chrome.runtime.lastError });
                        if (callback) callback();
                        return;
                    }
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
                                if (chrome.runtime?.lastError) {
                                    Logger.error('EditorManager', `Storage set error in saveContent fsrsCards: ${chrome.runtime.lastError.message}`, { error: chrome.runtime.lastError });
                                }
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
                            if (chrome.runtime?.lastError) {
                                Logger.error('EditorManager', `Storage set error in saveContent approachDrafts: ${chrome.runtime.lastError.message}`, { error: chrome.runtime.lastError });
                            }
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
     * Normalizes a raw URL into a concise hostname + pathname string for interface display.
     * 
     * @param {string} url - Full URL to format.
     * @returns {string} Cleaned display string.
     */
    getCleanDisplayUrl(url: string): string {
        try {
            const u = new URL(url);
            return u.hostname + u.pathname;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.debug('EditorManager', `Fallback clean display URL on invalid URL: ${errorMessage}`, { url, err });
            return url;
        }
    }

    /**
     * Displays a brief status feedback toast in the editor view.
     * 
     * @param {string} message - Toast message text.
     * @returns {void}
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
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.debug('EditorManager', `Ignore toast DOM display error: ${errorMessage}`, { message, err });
        }
    }
}

export function initEditor(): void {
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

// Augment CommonJS exports to ensure test and module interoperability
if (typeof module !== 'undefined' && module.exports) {
    (module.exports as any).EditorManager = EditorManager;
    (module.exports as any).EditorHeader = EditorHeader;
    (module.exports as any).ComplexityInputs = ComplexityInputs;
    (module.exports as any).MarkdownPreview = MarkdownPreview;
    (module.exports as any).EditorFooter = EditorFooter;
    (module.exports as any).EditorToast = EditorToast;
    (module.exports as any).EditorWorkspace = EditorWorkspace;
}

