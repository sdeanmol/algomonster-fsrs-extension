/**
 * @file Interactive Chip-Based Tag Input Control with Autocomplete (Preact)
 * @module features/common/utils/tagInput
 * @context Shared across Content Script Review Overlays and Dashboard Edit Modals
 * @description Transforms standard HTML input elements into interactive chip tag lists
 * supporting autocomplete suggestion dropdowns, keyboard navigation (Enter, Comma, Backspace, Arrow keys),
 * and bidirectional value synchronization with the underlying input element.
 */

import { h, render, Fragment, JSX } from 'preact';
import { useState, useEffect, useRef, useCallback } from 'preact/hooks';
import { UIUtils } from './uiUtils';

/**
 * Configuration options for initializing a `TagInputControl`.
 */
export interface TagInputOptions {
    /** Asynchronous or synchronous provider returning available tag suggestions for autocomplete */
    getSuggestions?: () => string[] | Promise<string[]>;
    /** Placeholder text displayed when no tag chips are present */
    placeholder?: string;
    /** Callback triggered whenever tags are added or removed */
    onTagsChange?: (tags: string[]) => void;
    /** Maximum number of tags allowed */
    maxTags?: number;
    /** Whether the tag input is disabled */
    disabled?: boolean;
}

/**
 * Preact Component for rendering an individual tag chip.
 */
export function TagChip({
    tag,
    onRemove
}: {
    tag: string;
    onRemove: () => void;
}): JSX.Element {
    return (
        <span className="tag-chip">
            <span className="tag-chip-text">{tag}</span>
            <span
                className="tag-chip-remove"
                role="button"
                aria-label={`Remove tag ${tag}`}
                tabIndex={-1}
                onClick={(e) => {
                    e.stopPropagation();
                    onRemove();
                }}
            >
                <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
            </span>
        </span>
    );
}

/**
 * Preact Component for rendering the tag chips list.
 */
export function TagChipsList({
    tags,
    onRemove
}: {
    tags: string[];
    onRemove: (index: number) => void;
}): JSX.Element {
    return (
        <Fragment>
            {tags.map((tag, idx) => (
                <TagChip key={`${tag}-${idx}`} tag={tag} onRemove={() => onRemove(idx)} />
            ))}
        </Fragment>
    );
}

/**
 * Preact Component for rendering autocomplete suggestion list.
 */
export function TagSuggestionsList({
    suggestions,
    query,
    highlightedIndex,
    onHover,
    onSelect
}: {
    suggestions: string[];
    query: string;
    highlightedIndex: number;
    onHover: (index: number) => void;
    onSelect: (suggestion: string) => void;
}): JSX.Element {
    return (
        <Fragment>
            {suggestions.map((suggestion, idx) => {
                const matchPos = suggestion.toLowerCase().indexOf(query.toLowerCase());
                let content: JSX.Element | string;
                if (matchPos >= 0) {
                    const before = suggestion.substring(0, matchPos);
                    const match = suggestion.substring(matchPos, matchPos + query.length);
                    const after = suggestion.substring(matchPos + query.length);
                    content = (
                        <Fragment>
                            {before}
                            <strong className="tag-match">{match}</strong>
                            {after}
                        </Fragment>
                    );
                } else {
                    content = suggestion;
                }
                return (
                    <div
                        key={suggestion}
                        className={`tag-suggestion-item ${idx === highlightedIndex ? 'highlighted' : ''}`}
                        onMouseEnter={() => onHover(idx)}
                        onClick={(e) => {
                            e.stopPropagation();
                            onSelect(suggestion);
                        }}
                    >
                        {content}
                    </div>
                );
            })}
        </Fragment>
    );
}

/**
 * Props for declarative TagInput component.
 */
export interface TagInputProps {
    tags: string[];
    onChange: (tags: string[]) => void;
    getSuggestions?: () => string[] | Promise<string[]>;
    placeholder?: string;
    disabled?: boolean;
    maxTags?: number;
}

/**
 * Pure Preact TagInput functional component.
 */
export function TagInput({
    tags,
    onChange,
    getSuggestions,
    placeholder = 'Add tags (comma or Enter)...',
    disabled = false,
    maxTags
}: TagInputProps): JSX.Element {
    const [inputValue, setInputValue] = useState<string>('');
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
    const [isOpen, setIsOpen] = useState<boolean>(false);

    const wrapperRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const suggestionsRef = useRef<string[]>([]);
    const highlightedIndexRef = useRef<number>(-1);
    const isOpenRef = useRef<boolean>(false);
    const autocompleteSeqRef = useRef<number>(0);

    const closeDropdown = useCallback(() => {
        isOpenRef.current = false;
        highlightedIndexRef.current = -1;
        suggestionsRef.current = [];
        setIsOpen(false);
        setHighlightedIndex(-1);
        setSuggestions([]);
    }, []);

    const addTag = useCallback((tagText: string): boolean => {
        const trimmed = tagText.trim();
        if (!trimmed) return false;
        if (maxTags !== undefined && tags.length >= maxTags) return false;

        const exists = tags.some((t) => t.toLowerCase() === trimmed.toLowerCase());
        if (exists) {
            setInputValue('');
            if (inputRef.current) inputRef.current.value = '';
            closeDropdown();
            return false;
        }

        onChange([...tags, trimmed]);
        setInputValue('');
        if (inputRef.current) inputRef.current.value = '';
        closeDropdown();
        return true;
    }, [tags, maxTags, onChange, closeDropdown]);

    const removeTagAt = useCallback((index: number) => {
        if (index < 0 || index >= tags.length) return;
        const updated = [...tags];
        updated.splice(index, 1);
        onChange(updated);
        inputRef.current?.focus();
    }, [tags, onChange]);

    const triggerAutocomplete = useCallback(async (queryText?: string) => {
        const text = queryText !== undefined ? queryText : (inputRef.current?.value || inputValue);
        const query = text.trim().toLowerCase();
        if (!query || !getSuggestions) {
            closeDropdown();
            return;
        }

        const seq = ++autocompleteSeqRef.current;

        try {
            const rawSuggestions = await Promise.resolve(getSuggestions());
            if (seq !== autocompleteSeqRef.current) {
                return;
            }

            const currentTagSet = new Set(tags.map((t) => t.toLowerCase()));
            const filtered = (rawSuggestions || []).filter((tag) => {
                const trimmed = tag.trim();
                return (
                    trimmed.length > 0 &&
                    !currentTagSet.has(trimmed.toLowerCase()) &&
                    (!query || trimmed.toLowerCase().includes(query))
                );
            }).slice(0, 8);

            if (filtered.length > 0) {
                suggestionsRef.current = filtered;
                highlightedIndexRef.current = 0;
                isOpenRef.current = true;
                setSuggestions(filtered);
                setHighlightedIndex(0);
                setIsOpen(true);
            } else {
                closeDropdown();
            }
        } catch (err) {
            if (seq === autocompleteSeqRef.current) {
                UIUtils.catchError('TagInput', 'Error fetching autocomplete suggestions', err);
                closeDropdown();
            }
        }
    }, [inputValue, getSuggestions, tags, closeDropdown]);

    const handleKeyDown = (e: KeyboardEvent) => {
        const target = e.currentTarget as HTMLInputElement | null;
        const val = target?.value || inputValue;

        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            const currSuggestions = suggestionsRef.current;
            const currIndex = highlightedIndexRef.current;
            if (isOpenRef.current && currIndex >= 0 && currIndex < currSuggestions.length) {
                addTag(currSuggestions[currIndex]);
            } else if (val.trim()) {
                addTag(val);
            }
        } else if (e.key === 'Backspace' && !val && tags.length > 0) {
            e.preventDefault();
            removeTagAt(tags.length - 1);
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (!isOpenRef.current) {
                triggerAutocomplete(val);
            } else if (suggestionsRef.current.length > 0) {
                const next = (highlightedIndexRef.current + 1) % suggestionsRef.current.length;
                highlightedIndexRef.current = next;
                setHighlightedIndex(next);
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (isOpenRef.current && suggestionsRef.current.length > 0) {
                const prev = (highlightedIndexRef.current - 1 + suggestionsRef.current.length) % suggestionsRef.current.length;
                highlightedIndexRef.current = prev;
                setHighlightedIndex(prev);
            }
        } else if (e.key === 'Escape') {
            if (isOpenRef.current) {
                e.preventDefault();
                closeDropdown();
            }
        } else if (e.key === 'Tab') {
            const currSuggestions = suggestionsRef.current;
            const currIndex = highlightedIndexRef.current;
            if (isOpenRef.current && currIndex >= 0 && currIndex < currSuggestions.length) {
                e.preventDefault();
                addTag(currSuggestions[currIndex]);
            } else if (val.trim()) {
                addTag(val);
            }
        }
    };

    const handleInput = (e: Event) => {
        const val = (e.currentTarget as HTMLInputElement).value;
        setInputValue(val);
        if (!val.trim()) {
            closeDropdown();
        } else {
            triggerAutocomplete(val);
        }
    };

    const handlePaste = (e: ClipboardEvent) => {
        const pasted = e.clipboardData?.getData('text');
        if (pasted && pasted.includes(',')) {
            e.preventDefault();
            const pastedTags = pasted.split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0);
            const cleaned = [...tags];
            const seen = new Set(tags.map((t) => t.toLowerCase()));
            for (const t of pastedTags) {
                if (maxTags !== undefined && cleaned.length >= maxTags) {
                    break;
                }
                if (!seen.has(t.toLowerCase())) {
                    seen.add(t.toLowerCase());
                    cleaned.push(t);
                }
            }
            onChange(cleaned);
            setInputValue('');
            if (inputRef.current) inputRef.current.value = '';
            closeDropdown();
        }
    };

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
                closeDropdown();
            }
        };
        document.addEventListener('click', handleClickOutside);
        return () => {
            document.removeEventListener('click', handleClickOutside);
        };
    }, [closeDropdown]);

    return (
        <div
            ref={wrapperRef}
            className="tag-input-wrapper"
            onClick={() => inputRef.current?.focus()}
        >
            <div className="tag-chips-container">
                <TagChipsList tags={tags} onRemove={removeTagAt} />
            </div>
            <input
                ref={inputRef}
                type="text"
                className="tag-inline-input"
                placeholder={tags.length === 0 ? placeholder : ''}
                disabled={disabled}
                onInput={handleInput}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
            />
            <div
                ref={dropdownRef}
                className="tag-autocomplete-dropdown"
                style={{ display: isOpen ? 'block' : 'none' }}
            >
                {isOpen && (
                    <TagSuggestionsList
                        suggestions={suggestions}
                        query={inputValue.trim()}
                        highlightedIndex={highlightedIndex}
                        onHover={(idx) => {
                            highlightedIndexRef.current = idx;
                            setHighlightedIndex(idx);
                        }}
                        onSelect={addTag}
                    />
                )}
            </div>
        </div>
    );
}

/**
 * Interactive tag input controller wrapping an HTMLInputElement.
 * Uses declarative Preact TagInput component under the hood while maintaining
 * bidirectional synchronization with the host HTMLInputElement.
 */
export class TagInputControl {
    private targetInput: HTMLInputElement;
    public options: TagInputOptions;
    private tags: string[] = [];
    private container: HTMLDivElement;
    private originalValueDescriptor: PropertyDescriptor | undefined;

    private constructor(targetInput: HTMLInputElement, options: TagInputOptions = {}) {
        this.targetInput = targetInput;
        this.options = options;

        this.targetInput.style.display = 'none';
        this.targetInput.setAttribute('tabindex', '-1');

        this.container = document.createElement('div');
        if (this.targetInput.parentNode) {
            this.targetInput.parentNode.insertBefore(this.container, this.targetInput.nextSibling);
        }

        this.interceptValueProperty();
        this.syncFromTargetInput();
    }

    public static attach(targetInput: HTMLInputElement, options: TagInputOptions = {}): TagInputControl {
        const existing = (targetInput as unknown as { __tagInputControl?: TagInputControl }).__tagInputControl;
        if (existing) {
            if (options.getSuggestions) existing.options.getSuggestions = options.getSuggestions;
            existing.syncFromTargetInput();
            return existing;
        }

        const instance = new TagInputControl(targetInput, options);
        (targetInput as unknown as { __tagInputControl?: TagInputControl }).__tagInputControl = instance;
        return instance;
    }

    private interceptValueProperty(): void {
        const self = this;
        this.originalValueDescriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');

        try {
            Object.defineProperty(this.targetInput, 'value', {
                get() {
                    return self.tags.join(', ');
                },
                set(val: string) {
                    self.setTagsFromString(val, false);
                    if (self.originalValueDescriptor?.set) {
                        self.originalValueDescriptor.set.call(this, val);
                    }
                },
                configurable: true
            });
        } catch (err) {
            UIUtils.catchError('TagInputControl', 'Could not intercept value descriptor', err);
        }
    }

    public syncFromTargetInput(): void {
        const currentVal = this.originalValueDescriptor?.get
            ? this.originalValueDescriptor.get.call(this.targetInput)
            : this.targetInput.value;
        this.setTagsFromString(currentVal || '', false);
    }

    public getTags(): string[] {
        return [...this.tags];
    }

    public setTags(newTags: string[], triggerEvents: boolean = true): void {
        const cleaned: string[] = [];
        const seen = new Set<string>();
        for (const t of newTags) {
            if (this.options.maxTags !== undefined && cleaned.length >= this.options.maxTags) {
                break;
            }
            const trimmed = t.trim();
            if (trimmed && !seen.has(trimmed.toLowerCase())) {
                seen.add(trimmed.toLowerCase());
                cleaned.push(trimmed);
            }
        }

        this.tags = cleaned;
        this.renderUI();

        if (this.originalValueDescriptor?.set) {
            this.originalValueDescriptor.set.call(this.targetInput, this.tags.join(', '));
        }

        if (triggerEvents) {
            this.targetInput.dispatchEvent(new Event('input', { bubbles: true }));
            this.targetInput.dispatchEvent(new Event('change', { bubbles: true }));
            if (this.options.onTagsChange) {
                this.options.onTagsChange(this.getTags());
            }
        }
    }

    public setTagsFromString(val: string, triggerEvents: boolean = true): void {
        const parts = val.split(',').map((s) => s.trim()).filter((s) => s.length > 0);
        this.setTags(parts, triggerEvents);
    }

    private renderUI(): void {
        render(
            <TagInput
                tags={this.tags}
                onChange={(updated) => this.setTags(updated, true)}
                getSuggestions={this.options.getSuggestions}
                placeholder={this.options.placeholder || this.targetInput.placeholder}
                maxTags={this.options.maxTags}
                disabled={this.options.disabled}
            />,
            this.container
        );
    }

    public destroy(): void {
        render(null, this.container);
        if (this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        } else if (typeof this.container.remove === 'function') {
            this.container.remove();
        }
        this.targetInput.style.display = '';
        this.targetInput.removeAttribute('tabindex');
        if (this.originalValueDescriptor) {
            Object.defineProperty(this.targetInput, 'value', this.originalValueDescriptor);
        }
        delete (this.targetInput as unknown as { __tagInputControl?: TagInputControl }).__tagInputControl;
    }
}
