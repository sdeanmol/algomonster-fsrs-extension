/**
 * @file Interactive Chip-Based Tag Input Control with Autocomplete
 * @module features/common/utils/tagInput
 * @context Shared across Content Script Review Overlays and Dashboard Edit Modals
 * @description Transforms standard HTML input elements into interactive chip tag lists
 * supporting autocomplete suggestion dropdowns, keyboard navigation (Enter, Comma, Backspace, Arrow keys),
 * and bidirectional value synchronization with the underlying input element.
 */

import { Logger } from '@common/logger';
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
}

/**
 * Interactive tag input controller wrapping an HTMLInputElement.
 */
export class TagInputControl {
    /** Target hidden input element being wrapped */
    private targetInput: HTMLInputElement;
    /** Configuration options */
    private options: TagInputOptions;
    /** Current array of tag strings */
    private tags: string[] = [];
    
    /** Main outer wrapper element */
    private wrapperEl!: HTMLDivElement;
    /** Container holding rendered tag chip elements */
    private chipsContainerEl!: HTMLDivElement;
    /** Inline text input for typing new tags */
    private inlineInputEl!: HTMLInputElement;
    /** Dropdown container rendering autocomplete suggestions */
    private dropdownEl!: HTMLDivElement;
    
    /** Current active list of filtered autocomplete suggestions */
    private suggestions: string[] = [];
    /** Currently selected index in the suggestion dropdown */
    private highlightedIndex: number = -1;
    /** Whether the autocomplete dropdown is visible */
    private isOpen: boolean = false;
    /** Original property descriptor of the input's `value` attribute */
    private originalValueDescriptor: PropertyDescriptor | undefined;

    /**
     * Initializes a new TagInputControl instance, building the DOM structure
     * and intercepting the input element's value getter/setter.
     * @param targetInput - Target HTML input element to enhance.
     * @param options - Configuration options for autocomplete and callbacks.
     */
    private constructor(targetInput: HTMLInputElement, options: TagInputOptions = {}) {
        this.targetInput = targetInput;
        this.options = options;

        this.initDOM();
        this.interceptValueProperty();
        this.syncFromTargetInput();
        this.bindEvents();
    }

    /**
     * Attaches a TagInputControl instance to a target input element, or retrieves
     * an existing instance if already attached.
     * @param targetInput - The HTMLInputElement to convert into chip tags.
     * @param options - Autocomplete and configuration options.
     * @returns The active TagInputControl instance.
     * @example
     * ```ts
     * const control = TagInputControl.attach(tagsInputElement, {
     *     getSuggestions: () => ['Array', 'Dynamic Programming', 'Graph', 'Tree'],
     *     onTagsChange: (tags) => console.log('Updated tags:', tags)
     * });
     * ```
     */
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

    /**
     * Builds and mounts the chip container, inline input, and dropdown elements next to the target input.
     */
    private initDOM(): void {
        // Hide target input visually while preserving form/DOM structure
        this.targetInput.style.display = 'none';
        this.targetInput.setAttribute('tabindex', '-1');

        // Create main wrapper
        this.wrapperEl = document.createElement('div');
        this.wrapperEl.className = 'tag-input-wrapper';

        // Container holding tag chip elements
        this.chipsContainerEl = document.createElement('div');
        this.chipsContainerEl.className = 'tag-chips-container';

        // Inline text input for typing new tags
        this.inlineInputEl = document.createElement('input');
        this.inlineInputEl.type = 'text';
        this.inlineInputEl.className = 'tag-inline-input';
        this.inlineInputEl.placeholder = this.options.placeholder || this.targetInput.placeholder || 'Add tags (comma or Enter)...';

        // Dropdown menu for autocomplete suggestions
        this.dropdownEl = document.createElement('div');
        this.dropdownEl.className = 'tag-autocomplete-dropdown';
        this.dropdownEl.style.display = 'none';

        // Assemble structure
        this.wrapperEl.appendChild(this.chipsContainerEl);
        this.wrapperEl.appendChild(this.inlineInputEl);
        this.wrapperEl.appendChild(this.dropdownEl);

        // Insert wrapper next to target input
        if (this.targetInput.parentNode) {
            this.targetInput.parentNode.insertBefore(this.wrapperEl, this.targetInput.nextSibling);
        }
    }

    /**
     * Intercepts `targetInput.value` getters and setters to mirror changes between
     * the underlying text value and chip array.
     */
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

    /**
     * Synchronizes current tags from the target input's native value string.
     */
    public syncFromTargetInput(): void {
        const currentVal = this.originalValueDescriptor?.get
            ? this.originalValueDescriptor.get.call(this.targetInput)
            : this.targetInput.value;
        this.setTagsFromString(currentVal || '', false);
    }

    /**
     * Retrieves a copy of the current tag list.
     * @returns Array of tag strings.
     */
    public getTags(): string[] {
        return [...this.tags];
    }

    /**
     * Sets the active tags from an array of strings, normalizing whitespace,
     * removing duplicates, updating chips, and triggering change events.
     * @param newTags - Array of candidate tag names.
     * @param triggerEvents - Whether to dispatch DOM input/change events.
     */
    public setTags(newTags: string[], triggerEvents: boolean = true): void {
        // Deduplicate and clean tags
        const cleaned: string[] = [];
        const seen = new Set<string>();
        for (const t of newTags) {
            const trimmed = t.trim();
            if (trimmed && !seen.has(trimmed.toLowerCase())) {
                seen.add(trimmed.toLowerCase());
                cleaned.push(trimmed);
            }
        }

        this.tags = cleaned;
        this.renderChips();

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

    /**
     * Sets tags by parsing a comma-separated string.
     * @param val - Comma-delimited tag string (e.g. "Array, Hash Table, Math").
     * @param triggerEvents - Whether to dispatch DOM change events.
     */
    public setTagsFromString(val: string, triggerEvents: boolean = true): void {
        const parts = val.split(',').map(s => s.trim()).filter(s => s.length > 0);
        this.setTags(parts, triggerEvents);
    }

    /**
     * Re-renders tag chip elements in the chips container.
     */
    private renderChips(): void {
        this.chipsContainerEl.innerHTML = '';
        this.tags.forEach((tag, index) => {
            const chip = document.createElement('span');
            chip.className = 'tag-chip';

            const label = document.createElement('span');
            label.className = 'tag-chip-text';
            label.textContent = tag;

            const removeBtn = document.createElement('span');
            removeBtn.className = 'tag-chip-remove';
            removeBtn.setAttribute('role', 'button');
            removeBtn.setAttribute('aria-label', `Remove tag ${tag}`);
            removeBtn.setAttribute('tabindex', '-1');
            removeBtn.innerHTML = `<svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.removeTagAt(index);
            });

            chip.appendChild(label);
            chip.appendChild(removeBtn);
            this.chipsContainerEl.appendChild(chip);
        });

        if (this.tags.length > 0) {
            this.inlineInputEl.placeholder = '';
        } else {
            this.inlineInputEl.placeholder = this.options.placeholder || this.targetInput.placeholder || 'Add tags (comma or Enter)...';
        }
    }

    /**
     * Adds a new tag to the collection if not already present.
     * @param tagText - Tag string to insert.
     * @returns True if the tag was added, false if empty or duplicate.
     */
    private addTag(tagText: string): boolean {
        const trimmed = tagText.trim();
        if (!trimmed) return false;

        const exists = this.tags.some(t => t.toLowerCase() === trimmed.toLowerCase());
        if (exists) {
            this.inlineInputEl.value = '';
            this.closeDropdown();
            return false;
        }

        this.setTags([...this.tags, trimmed], true);
        this.inlineInputEl.value = '';
        this.closeDropdown();
        return true;
    }

    /**
     * Removes the tag chip at the given index.
     * @param index - Index in the `tags` array to remove.
     */
    private removeTagAt(index: number): void {
        if (index < 0 || index >= this.tags.length) return;
        const updated = [...this.tags];
        updated.splice(index, 1);
        this.setTags(updated, true);
        this.inlineInputEl.focus();
    }

    /**
     * Attaches keyboard navigation and click listeners to the inline input and document.
     */
    private bindEvents(): void {
        // Wrapper click focuses inline text input
        this.wrapperEl.addEventListener('click', () => {
            this.inlineInputEl.focus();
        });

        // Keydown handling for Enter, Comma, Backspace, Navigation
        this.inlineInputEl.addEventListener('keydown', (e: KeyboardEvent) => {
            const val = this.inlineInputEl.value;

            if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault();
                if (this.isOpen && this.highlightedIndex >= 0 && this.highlightedIndex < this.suggestions.length) {
                    this.addTag(this.suggestions[this.highlightedIndex]);
                } else if (val.trim()) {
                    this.addTag(val);
                }
            } else if (e.key === 'Backspace' && !val && this.tags.length > 0) {
                e.preventDefault();
                this.removeTagAt(this.tags.length - 1);
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (!this.isOpen) {
                    this.triggerAutocomplete();
                } else {
                    this.navigateDropdown(1);
                }
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (this.isOpen) {
                    this.navigateDropdown(-1);
                }
            } else if (e.key === 'Escape') {
                if (this.isOpen) {
                    e.preventDefault();
                    this.closeDropdown();
                }
            } else if (e.key === 'Tab') {
                if (this.isOpen && this.highlightedIndex >= 0 && this.highlightedIndex < this.suggestions.length) {
                    e.preventDefault();
                    this.addTag(this.suggestions[this.highlightedIndex]);
                } else if (val.trim()) {
                    this.addTag(val);
                }
            }
        });

        // Input event for autocomplete search
        this.inlineInputEl.addEventListener('input', () => {
            this.triggerAutocomplete();
        });

        // Paste event handling for comma separated strings
        this.inlineInputEl.addEventListener('paste', (e: ClipboardEvent) => {
            const pasted = e.clipboardData?.getData('text');
            if (pasted && pasted.includes(',')) {
                e.preventDefault();
                const pastedTags = pasted.split(',').map(s => s.trim()).filter(s => s.length > 0);
                this.setTags([...this.tags, ...pastedTags], true);
                this.inlineInputEl.value = '';
                this.closeDropdown();
            }
        });

        // Close dropdown on click outside
        document.addEventListener('click', (e: MouseEvent) => {
            if (!this.wrapperEl.contains(e.target as Node)) {
                this.closeDropdown();
            }
        });
    }

    /**
     * Executes autocomplete query against `options.getSuggestions()` and displays matching dropdown.
     * @async
     */
    private async triggerAutocomplete(): Promise<void> {
        const query = this.inlineInputEl.value.trim().toLowerCase();
        if (!query || !this.options.getSuggestions) {
            this.closeDropdown();
            return;
        }

        try {
            const rawSuggestions = await Promise.resolve(this.options.getSuggestions());
            const currentTagSet = new Set(this.tags.map(t => t.toLowerCase()));

            this.suggestions = (rawSuggestions || []).filter(tag => {
                const trimmed = tag.trim();
                return trimmed.length > 0 &&
                    !currentTagSet.has(trimmed.toLowerCase()) &&
                    trimmed.toLowerCase().includes(query);
            }).slice(0, 8); // Top 8 suggestions

            if (this.suggestions.length > 0) {
                this.highlightedIndex = 0;
                this.renderDropdown(query);
            } else {
                this.closeDropdown();
            }
        } catch (err) {
            UIUtils.catchError('TagInputControl', 'Error fetching autocomplete suggestions', err);
            this.closeDropdown();
        }
    }

    /**
     * Renders autocomplete suggestion items with matched text highlighting.
     * @param query - Search substring being matched.
     */
    private renderDropdown(query: string): void {
        this.dropdownEl.innerHTML = '';
        this.suggestions.forEach((suggestion, idx) => {
            const item = document.createElement('div');
            item.className = `tag-suggestion-item ${idx === this.highlightedIndex ? 'highlighted' : ''}`;
            
            // Highlight matching portion
            const matchPos = suggestion.toLowerCase().indexOf(query.toLowerCase());
            if (matchPos >= 0) {
                const before = suggestion.substring(0, matchPos);
                const match = suggestion.substring(matchPos, matchPos + query.length);
                const after = suggestion.substring(matchPos + query.length);
                item.innerHTML = `${this.escapeHtml(before)}<strong class="tag-match">${this.escapeHtml(match)}</strong>${this.escapeHtml(after)}`;
            } else {
                item.textContent = suggestion;
            }

            item.addEventListener('mouseenter', () => {
                this.highlightedIndex = idx;
                this.updateDropdownHighlight();
            });

            item.addEventListener('click', (e) => {
                e.stopPropagation();
                this.addTag(suggestion);
            });

            this.dropdownEl.appendChild(item);
        });

        this.dropdownEl.style.display = 'block';
        this.isOpen = true;
    }

    /**
     * Updates visual `.highlighted` CSS class across dropdown items.
     */
    private updateDropdownHighlight(): void {
        const items = this.dropdownEl.querySelectorAll('.tag-suggestion-item');
        items.forEach((el, idx) => {
            if (idx === this.highlightedIndex) {
                el.classList.add('highlighted');
            } else {
                el.classList.remove('highlighted');
            }
        });
    }

    /**
     * Moves highlighted suggestion index up or down by step.
     * @param dir - Direction step (+1 or -1).
     */
    private navigateDropdown(dir: number): void {
        if (!this.isOpen || this.suggestions.length === 0) return;
        this.highlightedIndex = (this.highlightedIndex + dir + this.suggestions.length) % this.suggestions.length;
        this.updateDropdownHighlight();
    }

    /**
     * Closes and resets the autocomplete dropdown.
     */
    private closeDropdown(): void {
        this.dropdownEl.style.display = 'none';
        this.dropdownEl.innerHTML = '';
        this.isOpen = false;
        this.highlightedIndex = -1;
        this.suggestions = [];
    }

    /**
     * Escapes HTML characters in text for safe string interpolation.
     * @param str - Input string.
     * @returns Escaped HTML string.
     */
    private escapeHtml(str: string): string {
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
}
