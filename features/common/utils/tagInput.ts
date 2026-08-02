import { Logger } from '@common/logger';

export interface TagInputOptions {
    getSuggestions?: () => string[] | Promise<string[]>;
    placeholder?: string;
    onTagsChange?: (tags: string[]) => void;
}

/**
 * @file features/common/utils/tagInput.ts
 * @description Transforms standard text inputs into interactive chip-based tag controls
 * complete with database autocomplete suggestions, keyboard navigation, and seamless property value synchronization.
 */
export class TagInputControl {
    private targetInput: HTMLInputElement;
    private options: TagInputOptions;
    private tags: string[] = [];
    
    private wrapperEl!: HTMLDivElement;
    private chipsContainerEl!: HTMLDivElement;
    private inlineInputEl!: HTMLInputElement;
    private dropdownEl!: HTMLDivElement;
    
    private suggestions: string[] = [];
    private highlightedIndex: number = -1;
    private isOpen: boolean = false;
    private originalValueDescriptor: PropertyDescriptor | undefined;

    private constructor(targetInput: HTMLInputElement, options: TagInputOptions = {}) {
        this.targetInput = targetInput;
        this.options = options;

        this.initDOM();
        this.interceptValueProperty();
        this.syncFromTargetInput();
        this.bindEvents();
    }

    /**
     * Attaches or retrieves a TagInputControl instance on the target input element.
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
            Logger.error('TagInputControl', 'Could not intercept value descriptor', { err });
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

    public setTagsFromString(val: string, triggerEvents: boolean = true): void {
        const parts = val.split(',').map(s => s.trim()).filter(s => s.length > 0);
        this.setTags(parts, triggerEvents);
    }

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

    private removeTagAt(index: number): void {
        if (index < 0 || index >= this.tags.length) return;
        const updated = [...this.tags];
        updated.splice(index, 1);
        this.setTags(updated, true);
        this.inlineInputEl.focus();
    }

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
            Logger.error('TagInputControl', 'Error fetching autocomplete suggestions', { err });
            this.closeDropdown();
        }
    }

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

    private navigateDropdown(dir: number): void {
        if (!this.isOpen || this.suggestions.length === 0) return;
        this.highlightedIndex = (this.highlightedIndex + dir + this.suggestions.length) % this.suggestions.length;
        this.updateDropdownHighlight();
    }

    private closeDropdown(): void {
        this.dropdownEl.style.display = 'none';
        this.dropdownEl.innerHTML = '';
        this.isOpen = false;
        this.highlightedIndex = -1;
        this.suggestions = [];
    }

    private escapeHtml(str: string): string {
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
}
