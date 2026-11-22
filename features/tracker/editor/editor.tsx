/**
 * @file features/tracker/editor/editor.tsx
 * @description Manages the markdown notes and problem approach editor panel.
 * Provides real-time Markdown rendering previews, automatic background debounced saving,
 * and synchronizes changes to existing card records or standalone URL draft notes.
 * Migrated to pure declarative Preact functional components with TypeScript.
 * 
 * Context: Standalone editor tab (`editor.html`) within the Chrome extension.
 * 
 * Key Exports:
 * - `DraftEntry`: Interface defining the shape of unassociated problem approach drafts.
 * - `BookmarkEntry`: Minimal interface representing a bookmarked problem entry.
 * - `EditorHeader`: Preact component for the editor header and status indicator.
 * - `ComplexityInputs`: Preact component for Big-O complexity input fields.
 * - `MarkdownViewer`: Preact component for rendered Markdown solution notes.
 * - `MarkdownPreview`: Backwards-compatible alias for MarkdownViewer.
 * - `EditorFooter`: Preact component for save and save-and-close action buttons.
 * - `EditorToast`: Preact component for transient status toast messages.
 * - `EditorWorkspace`: Preact container component uniting editor UI sections.
 * - `EditorApp`: Root Preact component governing the full Problem Note Editor interface.
 * - `EditorManager`: Controller class with zero DOM manipulation.
 */

import { h, Fragment, render, VNode, RefObject, options } from 'preact';
import { useState, useEffect, useCallback, useRef } from 'preact/hooks';
import { flushSync } from 'preact/compat';

declare const jest: any;

const origRaf = options.requestAnimationFrame;
options.requestAnimationFrame = (cb: () => void) => {
    if (typeof jest !== 'undefined') {
        cb();
    } else if (origRaf) {
        origRaf(cb);
    } else if (typeof requestAnimationFrame !== 'undefined') {
        requestAnimationFrame(cb);
    } else {
        setTimeout(cb, 0);
    }
};

function safeFlushSync(fn: () => void): void {
    try {
        flushSync(fn);
    } catch (err) {
        fn();
    }
}
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
    tcInputRef?: RefObject<HTMLInputElement | null>;
    scInputRef?: RefObject<HTMLInputElement | null>;
}

/**
 * Preact component for Time and Space Complexity input controls.
 */
export function ComplexityInputs({
    timeComplexity,
    spaceComplexity,
    onTimeChange,
    onSpaceChange,
    tcInputRef,
    scInputRef
}: ComplexityInputsProps): VNode {
    return (
        <div className="complexity-bar">
            <div className="complexity-field">
                <label htmlFor="time-complexity-input">Time Complexity:</label>
                <input
                    ref={tcInputRef}
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
                    ref={scInputRef}
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

export interface MarkdownViewerProps {
    content: string;
}

/**
 * Preact component for rendering Markdown HTML previews safely and declaratively.
 */
export function MarkdownViewer({ content }: MarkdownViewerProps): VNode {
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

// Backwards-compatible alias for MarkdownViewer
export const MarkdownPreview = MarkdownViewer;
export type MarkdownPreviewProps = MarkdownViewerProps;

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
    textareaRef?: RefObject<HTMLTextAreaElement | null>;
    tcInputRef?: RefObject<HTMLInputElement | null>;
    scInputRef?: RefObject<HTMLInputElement | null>;
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
                    tcInputRef={props.tcInputRef}
                    scInputRef={props.scInputRef}
                />

                <textarea
                    ref={props.textareaRef}
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
                    <MarkdownViewer content={props.approach} />
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
// ROOT PREACT COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export interface EditorAppProps {
    manager?: EditorManager;
}

/**
 * Normalizes a raw URL into a concise hostname + pathname string for interface display.
 */
function normalizeDisplayUrl(url: string): string {
    try {
        const u = new URL(url);
        return u.hostname + u.pathname;
    } catch {
        return url;
    }
}

/**
 * Root Preact component governing the full Problem Note Editor interface.
 */
export function EditorApp({ manager: initialManager }: EditorAppProps): VNode {
    const [manager] = useState(() => initialManager || new EditorManager());
    const [title, setTitle] = useState<string>(() => manager.title || 'Loading problem details...');
    const [url, setUrl] = useState<string>(() => manager.url || manager.problemUrl || 'Loading URL...');
    const [saveStatus, setSaveStatus] = useState<string>(() => manager.saveStatus || 'Loading FSRS data...');
    const [timeComplexity, setTimeComplexity] = useState<string>(() => manager.timeComplexity || '');
    const [spaceComplexity, setSpaceComplexity] = useState<string>(() => manager.spaceComplexity || '');
    const [approach, setApproach] = useState<string>(() => manager.approach || '');
    const [isPreviewMode, setIsPreviewMode] = useState<boolean>(() => manager.isPreviewMode || false);
    const [toastMessage, setToastMessage] = useState<string>('Progress saved!');
    const [isToastVisible, setIsToastVisible] = useState<boolean>(false);
    const [isCardExisting, setIsCardExisting] = useState<boolean>(() => manager.isCardExisting || false);

    const textareaRef = useRef<HTMLTextAreaElement | null>(null);
    const tcInputRef = useRef<HTMLInputElement | null>(null);
    const scInputRef = useRef<HTMLInputElement | null>(null);

    const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const hasLoadedRef = useRef<boolean>(
        Boolean(initialManager && (initialManager.isCardExisting || (initialManager.title && initialManager.title !== 'Loading problem details...')))
    );

    const showToast = useCallback((msg: string) => {
        safeFlushSync(() => {
            setToastMessage(msg);
            setIsToastVisible(true);
        });
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        toastTimerRef.current = setTimeout(() => {
            safeFlushSync(() => {
                setIsToastVisible(false);
            });
        }, 2000);
    }, []);

    const saveContentToStorage = useCallback((
        currentApproach: string,
        currentTc: string,
        currentSc: string,
        existingCard: boolean,
        callback?: () => void
    ) => {
        if (typeof chrome === 'undefined' || !chrome.storage?.local) {
            if (callback) callback();
            return;
        }

        const clean = manager.cleanUrl;
        const cId = manager.cardId;

        try {
            chrome.storage.local.get(['fsrsCards', 'approachDrafts'], (result: StorageData & { approachDrafts?: Record<string, DraftEntry> }) => {
                try {
                    if (chrome.runtime?.lastError) {
                        Logger.error('EditorApp', `Storage get error: ${chrome.runtime.lastError.message}`);
                        if (callback) callback();
                        return;
                    }

                    if (existingCard) {
                        const cards: Card[] = result?.fsrsCards || [];
                        let idx = -1;
                        if (cId) {
                            idx = cards.findIndex((c: Card) => c.id === cId);
                        }
                        if (idx === -1 && clean) {
                            idx = cards.findIndex((c: Card) => c.problemUrl && c.problemUrl.split('?')[0].split('#')[0] === clean);
                        }
                        if (idx > -1) {
                            cards[idx].approach = currentApproach;
                            cards[idx].timeComplexity = currentTc.trim();
                            cards[idx].spaceComplexity = currentSc.trim();
                            chrome.storage.local.set({ fsrsCards: cards }, () => {
                                if (callback) callback();
                            });
                            return;
                        } else {
                            if (callback) callback();
                            return;
                        }
                    }

                    // Save as draft
                    const drafts: Record<string, DraftEntry> = result?.approachDrafts || {};
                    const existingDraft = drafts[clean];
                    if (existingDraft && typeof existingDraft === 'object') {
                        existingDraft.approach = currentApproach;
                        existingDraft.timeComplexity = currentTc.trim();
                        existingDraft.spaceComplexity = currentSc.trim();
                    } else {
                        drafts[clean] = {
                            approach: currentApproach,
                            timeComplexity: currentTc.trim(),
                            spaceComplexity: currentSc.trim()
                        };
                    }
                    chrome.storage.local.set({ approachDrafts: drafts }, () => {
                        if (callback) callback();
                    });
                } catch (innerErr) {
                    Logger.error('EditorApp', 'Error writing saveContent', { innerErr });
                    if (callback) callback();
                }
            });
        } catch (err) {
            Logger.error('EditorApp', 'Error writing saveContent', { err });
            if (callback) callback();
        }
    }, [manager.cleanUrl, manager.cardId]);

    const loadContentFromStorage = useCallback(() => {
        if (typeof window === 'undefined') return;

        const params = new URLSearchParams(window.location.search);
        const problemUrlParam = params.get('url') || manager.problemUrl || '';
        const cardIdParam = params.get('cardId') || manager.cardId || '';
        const clean = problemUrlParam.split('?')[0].split('#')[0];

        manager.problemUrl = problemUrlParam;
        manager.cardId = cardIdParam;
        manager.cleanUrl = clean;

        if (!problemUrlParam) {
            setTitle("Error: No URL provided");
            setSaveStatus("Failed to load");
            manager.title = "Error: No URL provided";
            manager.saveStatus = "Failed to load";
            return;
        }

        setUrl(problemUrlParam);
        manager.url = problemUrlParam;

        if (typeof chrome === 'undefined' || !chrome.storage?.local) return;

        chrome.storage.local.get(['fsrsCards', 'bookmarks', 'approachDrafts'], (result: StorageData & { bookmarks?: BookmarkEntry[]; approachDrafts?: Record<string, DraftEntry | string> }) => {
            try {
                if (chrome.runtime?.lastError) {
                    Logger.error('EditorApp', `Storage get error: ${chrome.runtime.lastError.message}`);
                    return;
                }

                const cards: Card[] = result?.fsrsCards || [];
                const bookmarks: BookmarkEntry[] = result?.bookmarks || [];
                const drafts: Record<string, DraftEntry | string> = result?.approachDrafts || {};

                let card: Card | undefined;
                if (cardIdParam) {
                    card = cards.find((c: Card) => c.id === cardIdParam);
                }
                if (!card && clean) {
                    card = cards.find((c: Card) => c.problemUrl && c.problemUrl.split('?')[0].split('#')[0] === clean);
                }

                if (card) {
                    setIsCardExisting(true);
                    manager.isCardExisting = true;
                    if (!manager.cardId && card.id) manager.cardId = card.id;

                    const loadedTitle = card.problemTitle || (card as Card & { title?: string }).title || "FSRS Insights";
                    const loadedApproach = card.approach || "";
                    const loadedTc = (card as Card & { timeComplexity?: string }).timeComplexity || "";
                    const loadedSc = (card as Card & { spaceComplexity?: string }).spaceComplexity || "";
                    const loadedStatus = "Loaded FSRS card";

                    safeFlushSync(() => {
                        setTitle(loadedTitle);
                        setApproach(loadedApproach);
                        setTimeComplexity(loadedTc);
                        setSpaceComplexity(loadedSc);
                        setSaveStatus(loadedStatus);
                    });

                    manager.title = loadedTitle;
                    manager.approach = loadedApproach;
                    manager.timeComplexity = loadedTc;
                    manager.spaceComplexity = loadedSc;
                    manager.saveStatus = loadedStatus;
                } else {
                    setIsCardExisting(false);
                    manager.isCardExisting = false;

                    const bookmark = bookmarks.find((b: BookmarkEntry) => b.url && b.url.split('?')[0].split('#')[0] === clean);
                    const loadedTitle = (bookmark && bookmark.title) || normalizeDisplayUrl(problemUrlParam);

                    const draftVal = drafts[clean];
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
                    const loadedStatus = "Loaded draft notes";

                    safeFlushSync(() => {
                        setTitle(loadedTitle);
                        setApproach(draftText);
                        setTimeComplexity(tc);
                        setSpaceComplexity(sc);
                        setSaveStatus(loadedStatus);
                    });

                    manager.title = loadedTitle;
                    manager.approach = draftText;
                    manager.timeComplexity = tc;
                    manager.spaceComplexity = sc;
                    manager.saveStatus = loadedStatus;
                }
            } catch (err) {
                Logger.error('EditorApp', 'Error loading content from storage', { err });
            }
        });
    }, [manager]);

    // Initial load and window event listeners
    useEffect(() => {
        if (!hasLoadedRef.current) {
            hasLoadedRef.current = true;
            loadContentFromStorage();
        }

        const handleUnloadSave = () => {
            const currentApproach = textareaRef.current ? textareaRef.current.value : approach;
            const currentTc = tcInputRef.current ? tcInputRef.current.value.trim() : timeComplexity.trim();
            const currentSc = scInputRef.current ? scInputRef.current.value.trim() : spaceComplexity.trim();
            saveContentToStorage(currentApproach, currentTc, currentSc, isCardExisting);
        };

        window.addEventListener('pagehide', handleUnloadSave);
        window.addEventListener('beforeunload', handleUnloadSave);

        return () => {
            window.removeEventListener('pagehide', handleUnloadSave);
            window.removeEventListener('beforeunload', handleUnloadSave);
        };
    }, [loadContentFromStorage, saveContentToStorage, approach, timeComplexity, spaceComplexity, isCardExisting]);

    // Cleanup pending timers on unmount
    useEffect(() => {
        return () => {
            if (autoSaveTimerRef.current) {
                clearTimeout(autoSaveTimerRef.current);
            }
            if (toastTimerRef.current) {
                clearTimeout(toastTimerRef.current);
            }
        };
    }, []);

    const triggerAutoSave = useCallback((
        currentApproach: string,
        currentTc: string,
        currentSc: string
    ) => {
        safeFlushSync(() => {
            setSaveStatus("Typing...");
            manager.saveStatus = "Typing...";
        });

        if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = setTimeout(() => {
            saveContentToStorage(currentApproach, currentTc, currentSc, isCardExisting, () => {
                safeFlushSync(() => {
                    setSaveStatus("Changes saved automatically");
                    manager.saveStatus = "Changes saved automatically";
                });
            });
        }, 300);
    }, [manager, isCardExisting, saveContentToStorage]);

    const handleTimeChange = (val: string) => {
        setTimeComplexity(val);
        manager.timeComplexity = val;
        triggerAutoSave(approach, val, spaceComplexity);
    };

    const handleSpaceChange = (val: string) => {
        setSpaceComplexity(val);
        manager.spaceComplexity = val;
        triggerAutoSave(approach, timeComplexity, val);
    };

    const handleApproachChange = (val: string) => {
        setApproach(val);
        manager.approach = val;
        triggerAutoSave(val, timeComplexity, spaceComplexity);
    };

    const handleTogglePreview = () => {
        const currentText = textareaRef.current ? textareaRef.current.value : approach;
        safeFlushSync(() => {
            if (currentText !== approach) {
                setApproach(currentText);
                manager.approach = currentText;
            }
            setIsPreviewMode((prev) => {
                manager.isPreviewMode = !prev;
                return !prev;
            });
        });
    };

    const handleSave = () => {
        const currentApproach = textareaRef.current ? textareaRef.current.value : approach;
        const currentTc = tcInputRef.current ? tcInputRef.current.value.trim() : timeComplexity.trim();
        const currentSc = scInputRef.current ? scInputRef.current.value.trim() : spaceComplexity.trim();

        saveContentToStorage(currentApproach, currentTc, currentSc, isCardExisting, () => {
            showToast("Progress saved!");
        });
    };

    const handleSaveAndClose = () => {
        const currentApproach = textareaRef.current ? textareaRef.current.value : approach;
        const currentTc = tcInputRef.current ? tcInputRef.current.value.trim() : timeComplexity.trim();
        const currentSc = scInputRef.current ? scInputRef.current.value.trim() : spaceComplexity.trim();

        saveContentToStorage(currentApproach, currentTc, currentSc, isCardExisting, () => {
            UIUtils.closeCurrentTab();
        });
    };

    const handleClose = () => {
        const currentApproach = textareaRef.current ? textareaRef.current.value : approach;
        const currentTc = tcInputRef.current ? tcInputRef.current.value.trim() : timeComplexity.trim();
        const currentSc = scInputRef.current ? scInputRef.current.value.trim() : spaceComplexity.trim();

        saveContentToStorage(currentApproach, currentTc, currentSc, isCardExisting, () => {
            UIUtils.closeCurrentTab();
        });
    };

    // Connect manager bridge synchronously
    manager.title = title;
    manager.url = url;
    manager.saveStatus = saveStatus;
    manager.timeComplexity = timeComplexity;
    manager.spaceComplexity = spaceComplexity;
    manager.approach = approach;
    manager.isPreviewMode = isPreviewMode;
    manager.isCardExisting = isCardExisting;

    manager.onTogglePreview = () => {
        handleTogglePreview();
    };
    manager.onTriggerAutoSave = () => {
        triggerAutoSave(approach, timeComplexity, spaceComplexity);
    };
    manager.onSaveContent = (cb) => {
        const currentApproach = textareaRef.current ? textareaRef.current.value : approach;
        const currentTc = tcInputRef.current ? tcInputRef.current.value.trim() : timeComplexity.trim();
        const currentSc = scInputRef.current ? scInputRef.current.value.trim() : spaceComplexity.trim();

        saveContentToStorage(currentApproach, currentTc, currentSc, isCardExisting, cb);
    };
    manager.onClose = () => {
        handleClose();
    };
    manager.onShowToast = (msg) => {
        showToast(msg);
    };
    manager.onLoadContent = () => {
        loadContentFromStorage();
    };
    manager.onUpdate = (data) => {
        if (data?.title !== undefined) setTitle(String(data.title));
        if (data?.url !== undefined) setUrl(String(data.url));
        if (data?.approach !== undefined) setApproach(String(data.approach));
        if (data?.timeComplexity !== undefined) setTimeComplexity(String(data.timeComplexity));
        if (data?.spaceComplexity !== undefined) setSpaceComplexity(String(data.spaceComplexity));
        if (data?.saveStatus !== undefined) setSaveStatus(String(data.saveStatus));
    };

    return (
        <EditorWorkspace
            title={title}
            url={url}
            saveStatus={saveStatus}
            timeComplexity={timeComplexity}
            spaceComplexity={spaceComplexity}
            approach={approach}
            isPreviewMode={isPreviewMode}
            toastMessage={toastMessage}
            isToastVisible={isToastVisible}
            onTimeChange={handleTimeChange}
            onSpaceChange={handleSpaceChange}
            onApproachChange={handleApproachChange}
            onTogglePreview={handleTogglePreview}
            onSave={handleSave}
            onSaveAndClose={handleSaveAndClose}
            onClose={handleClose}
            textareaRef={textareaRef}
            tcInputRef={tcInputRef}
            scInputRef={scInputRef}
        />
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// EDITOR CONTROLLER CLASS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Controller and domain helper for the Markdown notes and approach editor page.
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
    /** Current problem title. */
    title: string;
    /** Current approach text. */
    approach: string;
    /** Current time complexity note. */
    timeComplexity: string;
    /** Current space complexity note. */
    spaceComplexity: string;
    /** Current save status text. */
    saveStatus: string;
    /** Current displayed url. */
    url: string;
    /** Observer callback notifying root component of state updates. */
    onUpdate?: (data?: Record<string, unknown>) => void;
    /** Observer callbacks wired by active EditorApp instance. */
    onTriggerAutoSave?: () => void;
    onTogglePreview?: () => void;
    onSaveContent?: (callback?: () => void) => void;
    onClose?: () => void;
    onShowToast?: (message: string) => void;
    onLoadContent?: () => void;

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
        this.title = '';
        this.approach = '';
        this.timeComplexity = '';
        this.spaceComplexity = '';
        this.saveStatus = '';
        this.url = '';
    }

    /**
     * Triggers auto-save of current editor input.
     */
    triggerAutoSave(): void {
        this.saveStatus = "Typing...";
        if (this.onTriggerAutoSave) {
            this.onTriggerAutoSave();
            return;
        }
        if (this.autoSaveTimer) clearTimeout(this.autoSaveTimer);
        this.autoSaveTimer = setTimeout(() => {
            this.saveContent(() => {
                this.saveStatus = "Changes saved automatically";
            });
        }, 300);
    }

    /**
     * Toggles markdown preview mode.
     */
    togglePreview(): void {
        this.isPreviewMode = !this.isPreviewMode;
        if (this.onTogglePreview) {
            this.onTogglePreview();
        }
    }

    /**
     * Handles closing the editor tab after saving current content.
     */
    handleClose(): void {
        if (this.onClose) {
            this.onClose();
        } else {
            this.saveContent(() => {
                UIUtils.closeCurrentTab();
            });
        }
    }

    /**
     * Mounts the declarative EditorApp component into `#root` or container.
     */
    init(): void {
        try {
            this.loadContent();
            const root = document.getElementById('root') || (typeof document !== 'undefined' ? document.body : null);
            if (root) {
                try {
                    render(null, root);
                } catch {}
                while (root.firstChild) {
                    (root.firstChild as any).remove();
                }
                render(<EditorApp manager={this} />, root);
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('EditorManager', `Failed to initialize EditorManager: ${errorMessage}`, { err });
        }
    }

    /**
     * Retrieves stored cards, bookmarks, and drafts from storage.
     */
    loadContent(): void {
        if (this.onLoadContent) {
            this.onLoadContent();
            return;
        }

        if (typeof window === 'undefined') return;

        const params = new URLSearchParams(window.location.search);
        this.problemUrl = params.get('url') || this.problemUrl || '';
        this.cardId = params.get('cardId') || this.cardId || '';
        this.cleanUrl = this.problemUrl.split('?')[0].split('#')[0];

        if (!this.problemUrl) {
            this.title = "Error: No URL provided";
            this.saveStatus = "Failed to load";
            if (this.onUpdate) {
                this.onUpdate({ title: this.title, saveStatus: this.saveStatus });
            }
            return;
        }

        this.url = this.problemUrl;

        try {
            if (typeof chrome === 'undefined' || !chrome.storage?.local) {
                Logger.warn('EditorManager', 'Browser extension storage unavailable in loadContent.');
                return;
            }

            chrome.storage.local.get(['fsrsCards', 'bookmarks', 'approachDrafts'], (result: any) => {
                try {
                    if (chrome.runtime?.lastError) {
                        Logger.error('EditorManager', `Storage get error in loadContent: ${chrome.runtime.lastError.message}`);
                        return;
                    }
                    const cards: Card[] = result?.fsrsCards || [];
                    const bookmarks: BookmarkEntry[] = result?.bookmarks || [];
                    const drafts: Record<string, DraftEntry | string> = result?.approachDrafts || {};

                    let card: Card | undefined;
                    if (this.cardId) {
                        card = cards.find((c: Card) => c.id === this.cardId);
                    }
                    if (!card && this.cleanUrl) {
                        card = cards.find((c: Card) => c.problemUrl && c.problemUrl.split('?')[0].split('#')[0] === this.cleanUrl);
                    }

                    if (card) {
                        this.isCardExisting = true;
                        if (!this.cardId && card.id) this.cardId = card.id;
                        this.title = card.problemTitle || (card as Card & { title?: string }).title || "FSRS Insights";
                        this.approach = card.approach || "";
                        this.timeComplexity = (card as Card & { timeComplexity?: string }).timeComplexity || "";
                        this.spaceComplexity = (card as Card & { spaceComplexity?: string }).spaceComplexity || "";
                        this.saveStatus = "Loaded FSRS card";
                    } else {
                        this.isCardExisting = false;
                        const bookmark = bookmarks.find((b: BookmarkEntry) => b.url && b.url.split('?')[0].split('#')[0] === this.cleanUrl);
                        this.title = (bookmark && bookmark.title) || this.getCleanDisplayUrl(this.problemUrl);

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
                        this.approach = draftText;
                        this.timeComplexity = tc;
                        this.spaceComplexity = sc;
                        this.saveStatus = "Loaded draft notes";
                    }

                    if (this.onUpdate) {
                        this.onUpdate({
                            title: this.title,
                            approach: this.approach,
                            timeComplexity: this.timeComplexity,
                            spaceComplexity: this.spaceComplexity,
                            saveStatus: this.saveStatus,
                            url: this.problemUrl
                        });
                    }
                } catch (innerErr) {
                    Logger.error('EditorManager', 'Error populating editor content', { innerErr });
                }
            });
        } catch (err) {
            Logger.error('EditorManager', 'Failed to load storage in Editor loadContent', { err });
        }
    }

    bindEvents(): void {}

    /**
     * Persists current markdown text and complexity notes to `chrome.storage.local`.
     */
    saveContent(callback?: () => void): void {
        if (this.onSaveContent) {
            this.onSaveContent(callback);
            return;
        }

        try {
            if (typeof chrome === 'undefined' || !chrome.storage?.local) {
                Logger.warn('EditorManager', 'Browser extension storage unavailable in saveContent.');
                if (callback) callback();
                return;
            }

            const text = this.approach;
            const tc = this.timeComplexity.trim();
            const sc = this.spaceComplexity.trim();

            chrome.storage.local.get(['fsrsCards', 'approachDrafts'], (result: any) => {
                try {
                    if (chrome.runtime?.lastError) {
                        Logger.error('EditorManager', `Storage get error in saveContent: ${chrome.runtime.lastError.message}`);
                        if (callback) callback();
                        return;
                    }
                    if (this.isCardExisting) {
                        const cards: Card[] = result?.fsrsCards || [];
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
                        const drafts: Record<string, DraftEntry> = result?.approachDrafts || {};
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
                    Logger.error('EditorManager', 'Error writing saveContent payload', { innerErr });
                    if (callback) callback();
                }
            });
        } catch (err) {
            Logger.error('EditorManager', 'Failed to execute saveContent', { err });
            if (callback) callback();
        }
    }

    /**
     * Normalizes a raw URL into a concise hostname + pathname string for interface display.
     */
    getCleanDisplayUrl(url: string): string {
        return normalizeDisplayUrl(url);
    }

    /**
     * Displays a brief status feedback toast in the editor view.
     */
    showToast(message: string): void {
        try {
            if (!this.onShowToast) {
                this.init();
            }
            if (this.onShowToast) {
                this.onShowToast(message);
            }
        } catch {
            // Ignore toast errors
        }
    }
}

export function initEditor(): void {
    try {
        const root = document.getElementById('root');
        if (root) {
            render(<EditorApp />, root);
        }
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
    (module.exports as any).MarkdownViewer = MarkdownViewer;
    (module.exports as any).MarkdownPreview = MarkdownPreview;
    (module.exports as any).EditorFooter = EditorFooter;
    (module.exports as any).EditorToast = EditorToast;
    (module.exports as any).EditorWorkspace = EditorWorkspace;
    (module.exports as any).EditorApp = EditorApp;
}
