/**
 * @file Interactive Chip-Based Tag Input Control with Autocomplete (Preact)
 * @module features/common/utils/tagInput
 * @context Shared across Content Script Review Overlays and Dashboard Edit Modals
 * @description Transforms standard HTML input elements into interactive chip tag lists
 * supporting autocomplete suggestion dropdowns, keyboard navigation (Enter, Comma, Backspace, Arrow keys),
 * and bidirectional value synchronization with the underlying input element.
 */

import { h, Fragment, JSX } from 'preact';
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
    showCreateOption = false,
    onHover,
    onSelect
}: {
    suggestions: string[];
    query: string;
    highlightedIndex: number;
    showCreateOption?: boolean;
    onHover: (index: number) => void;
    onSelect: (suggestion: string) => void;
}): JSX.Element {
    return (
        <Fragment>
            {suggestions.map((suggestion, idx) => {
                const matchPos = query ? suggestion.toLowerCase().indexOf(query.toLowerCase()) : -1;
                let content: JSX.Element | string;
                if (query && matchPos >= 0) {
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
                        onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onSelect(suggestion);
                        }}
                    >
                        {content}
                    </div>
                );
            })}
            {showCreateOption && query && (
                <div
                    className="tag-create-item"
                    onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onSelect(query);
                    }}
                >
                    <span className="tag-create-plus">+</span> Create <strong>&ldquo;{query}&rdquo;</strong>
                </div>
            )}
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

    const [showCreateOption, setShowCreateOption] = useState<boolean>(false);

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
        setShowCreateOption(false);
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
        const rawQuery = text.trim();
        const query = rawQuery.toLowerCase();
        if (!getSuggestions && !rawQuery) {
            closeDropdown();
            return;
        }

        const seq = ++autocompleteSeqRef.current;

        try {
            const rawSuggestions = getSuggestions ? await Promise.resolve(getSuggestions()) : [];
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

            const hasExactMatch = (rawSuggestions || []).some(
                (t) => t.trim().toLowerCase() === query
            ) || currentTagSet.has(query);

            const canCreate = Boolean(rawQuery && !hasExactMatch);

            if (filtered.length > 0 || canCreate) {
                const nextHighlighted = filtered.length > 0 ? 0 : -1;
                suggestionsRef.current = filtered;
                highlightedIndexRef.current = nextHighlighted;
                isOpenRef.current = true;
                setSuggestions(filtered);
                setHighlightedIndex(nextHighlighted);
                setShowCreateOption(canCreate);
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
        triggerAutocomplete(val);
    };

    const handleFocus = () => {
        triggerAutocomplete();
    };

    const handleBlur = () => {
        const val = (inputRef.current?.value || inputValue).trim();
        if (val) {
            addTag(val);
        }
        closeDropdown();
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
        window.addEventListener('click', handleClickOutside);
        return () => {
            window.removeEventListener('click', handleClickOutside);
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
                onFocus={handleFocus}
                onBlur={handleBlur}
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
                        showCreateOption={showCreateOption}
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
 * Re-export legacy DOM adapter for backwards compatibility with input bindings.
 */
export { TagInputControl } from './tagInputAdapter';
