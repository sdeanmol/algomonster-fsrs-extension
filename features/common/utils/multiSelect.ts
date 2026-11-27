/**
 * @file Searchable Multi-Select Dropdown Control
 * @module features/common/utils/multiSelect
 * @context Shared across Data Manager, Popup Quick Search, Analytics, and Highlights Manager
 * @description Progressively enhances standard HTML `<select>` elements into modern searchable
 * multi-select dropdowns with checkbox options, live search filtering, and Select All / Clear actions.
 */

export interface MultiSelectOptions {
    /** Default text displayed when zero options are selected */
    placeholder?: string;
    /** Placeholder text for the search input inside the dropdown */
    searchPlaceholder?: string;
    /** Sentinel option value representing "All" (excluded from checkboxes; clears selection) */
    allValue?: string;
    /** Callback invoked whenever the selected values change */
    onChange?: (selectedValues: string[]) => void;
}

interface OptionItem {
    value: string;
    label: string;
}

/**
 * Interactive searchable multi-select controller wrapping an `HTMLSelectElement`.
 */
export class MultiSelectControl {
    private targetSelect: HTMLSelectElement;
    private options: MultiSelectOptions;
    private allValue: string;
    private items: OptionItem[] = [];
    private selectedValues: Set<string> = new Set();
    private isOpen: boolean = false;

    private wrapperEl!: HTMLDivElement;
    private triggerEl!: HTMLButtonElement;
    private labelEl!: HTMLSpanElement;
    private dropdownEl!: HTMLDivElement;
    private searchInputEl!: HTMLInputElement;
    private optionsListEl!: HTMLDivElement;

    private constructor(targetSelect: HTMLSelectElement, options: MultiSelectOptions = {}) {
        this.targetSelect = targetSelect;
        this.options = options;
        this.allValue = options.allValue ?? 'all';

        this.initDOM();
        this.refreshOptions();
        this.bindEvents();
    }

    /**
     * Attaches a `MultiSelectControl` to a target `<select>` element, or returns the existing instance.
     */
    public static attach(targetSelect: HTMLSelectElement, options: MultiSelectOptions = {}): MultiSelectControl {
        const existing = (targetSelect as unknown as { __multiSelectControl?: MultiSelectControl }).__multiSelectControl;
        if (existing) {
            if (options.onChange) existing.options.onChange = options.onChange;
            if (options.placeholder) existing.options.placeholder = options.placeholder;
            existing.refreshOptions();
            return existing;
        }

        const instance = new MultiSelectControl(targetSelect, options);
        (targetSelect as unknown as { __multiSelectControl?: MultiSelectControl }).__multiSelectControl = instance;
        return instance;
    }

    private initDOM(): void {
        this.targetSelect.style.display = 'none';
        this.targetSelect.setAttribute('tabindex', '-1');

        this.wrapperEl = document.createElement('div');
        this.wrapperEl.className = 'multi-select-wrapper';

        this.triggerEl = document.createElement('button');
        this.triggerEl.type = 'button';
        this.triggerEl.className = 'multi-select-trigger';
        this.triggerEl.setAttribute('role', 'combobox');
        this.triggerEl.setAttribute('aria-haspopup', 'listbox');
        this.triggerEl.setAttribute('aria-expanded', 'false');

        this.labelEl = document.createElement('span');
        this.labelEl.className = 'multi-select-label';

        const chevron = document.createElement('span');
        chevron.className = 'multi-select-chevron';
        chevron.setAttribute('aria-hidden', 'true');
        chevron.innerHTML = '&#9662;';

        this.triggerEl.appendChild(this.labelEl);
        this.triggerEl.appendChild(chevron);

        this.dropdownEl = document.createElement('div');
        this.dropdownEl.className = 'multi-select-dropdown';
        this.dropdownEl.style.display = 'none';

        const searchWrap = document.createElement('div');
        searchWrap.className = 'multi-select-search-wrap';

        this.searchInputEl = document.createElement('input');
        this.searchInputEl.type = 'text';
        this.searchInputEl.className = 'multi-select-search';
        this.searchInputEl.placeholder = this.options.searchPlaceholder || 'Search...';
        this.searchInputEl.setAttribute('aria-label', 'Filter options');
        searchWrap.appendChild(this.searchInputEl);

        const actionsRow = document.createElement('div');
        actionsRow.className = 'multi-select-actions';

        const selectAllBtn = document.createElement('button');
        selectAllBtn.type = 'button';
        selectAllBtn.className = 'multi-select-action-btn multi-select-all-btn';
        selectAllBtn.textContent = 'Select all';

        const clearBtn = document.createElement('button');
        clearBtn.type = 'button';
        clearBtn.className = 'multi-select-action-btn multi-select-clear-btn';
        clearBtn.textContent = 'Clear';

        actionsRow.appendChild(selectAllBtn);
        actionsRow.appendChild(clearBtn);

        this.optionsListEl = document.createElement('div');
        this.optionsListEl.className = 'multi-select-options';
        this.optionsListEl.setAttribute('role', 'listbox');
        this.optionsListEl.setAttribute('aria-multiselectable', 'true');

        this.dropdownEl.appendChild(searchWrap);
        this.dropdownEl.appendChild(actionsRow);
        this.dropdownEl.appendChild(this.optionsListEl);

        this.wrapperEl.appendChild(this.triggerEl);
        this.wrapperEl.appendChild(this.dropdownEl);

        this.targetSelect.parentNode?.insertBefore(this.wrapperEl, this.targetSelect.nextSibling);
    }

    private bindEvents(): void {
        this.triggerEl.addEventListener('click', (e: MouseEvent) => {
            e.stopPropagation();
            if (this.isOpen) {
                this.close();
            } else {
                this.open();
            }
        });

        this.searchInputEl.addEventListener('input', () => {
            this.filterOptionsDOM();
        });

        this.dropdownEl.addEventListener('click', (e: MouseEvent) => {
            e.stopPropagation();
        });

        const selectAllBtn = this.dropdownEl.querySelector('.multi-select-all-btn');
        selectAllBtn?.addEventListener('click', () => {
            const visibleCheckboxes = Array.from(
                this.optionsListEl.querySelectorAll('.multi-select-option')
            ).filter((el) => (el as HTMLElement).style.display !== 'none');

            for (const row of visibleCheckboxes) {
                const cb = row.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
                if (cb) {
                    cb.checked = true;
                    this.selectedValues.add(cb.value);
                }
            }
            this.updateTriggerLabel();
            this.emitChange();
        });

        const clearBtn = this.dropdownEl.querySelector('.multi-select-clear-btn');
        clearBtn?.addEventListener('click', () => {
            this.clear(true);
        });

        document.addEventListener('click', (e: MouseEvent) => {
            if (this.isOpen && !this.wrapperEl.contains(e.target as Node)) {
                this.close();
            }
        });

        this.wrapperEl.addEventListener('keydown', (e: KeyboardEvent) => {
            if (e.key === 'Escape' && this.isOpen) {
                this.close();
                this.triggerEl.focus();
            }
        });
    }

    /**
     * Rebuilds the checkbox options list from the underlying `<select>` element's `<option>` children,
     * preserving any currently selected values that still exist.
     */
    public refreshOptions(): void {
        const nextItems: OptionItem[] = [];
        let fallbackPlaceholder = this.options.placeholder;

        Array.from(this.targetSelect.options).forEach((opt) => {
            if (opt.value === this.allValue) {
                if (!fallbackPlaceholder && opt.textContent) {
                    fallbackPlaceholder = opt.textContent.trim();
                }
                return;
            }
            nextItems.push({
                value: opt.value,
                label: (opt.textContent || opt.value).trim()
            });
        });

        if (fallbackPlaceholder && !this.options.placeholder) {
            this.options.placeholder = fallbackPlaceholder;
        }

        this.items = nextItems;
        const validSet = new Set(nextItems.map((i) => i.value));
        for (const val of Array.from(this.selectedValues)) {
            if (!validSet.has(val)) {
                this.selectedValues.delete(val);
            }
        }

        this.renderOptionsDOM();
        this.updateTriggerLabel();
    }

    private renderOptionsDOM(): void {
        this.optionsListEl.innerHTML = '';
        if (this.items.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'multi-select-empty';
            empty.textContent = 'No options available';
            this.optionsListEl.appendChild(empty);
            return;
        }

        for (const item of this.items) {
            const labelEl = document.createElement('label');
            labelEl.className = 'multi-select-option';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = item.value;
            checkbox.checked = this.selectedValues.has(item.value);

            checkbox.addEventListener('change', () => {
                if (checkbox.checked) {
                    this.selectedValues.add(item.value);
                } else {
                    this.selectedValues.delete(item.value);
                }
                this.updateTriggerLabel();
                this.emitChange();
            });

            const textSpan = document.createElement('span');
            textSpan.textContent = item.label;

            labelEl.appendChild(checkbox);
            labelEl.appendChild(textSpan);
            this.optionsListEl.appendChild(labelEl);
        }

        this.filterOptionsDOM();
    }

    private filterOptionsDOM(): void {
        const query = this.searchInputEl.value.trim().toLowerCase();
        const rows = this.optionsListEl.querySelectorAll('.multi-select-option');
        rows.forEach((row) => {
            const text = (row.textContent || '').toLowerCase();
            (row as HTMLElement).style.display = !query || text.includes(query) ? 'flex' : 'none';
        });
    }

    private updateTriggerLabel(): void {
        const count = this.selectedValues.size;
        const placeholder = this.options.placeholder || 'All';
        if (count === 0) {
            this.labelEl.textContent = placeholder;
            this.triggerEl.classList.remove('has-selection');
        } else if (count === 1) {
            const onlyVal = Array.from(this.selectedValues)[0];
            const match = this.items.find((i) => i.value === onlyVal);
            this.labelEl.textContent = match ? match.label : onlyVal;
            this.triggerEl.classList.add('has-selection');
        } else {
            this.labelEl.textContent = `${count} selected`;
            this.triggerEl.classList.add('has-selection');
        }
    }

    private emitChange(): void {
        const values = this.getSelectedValues();
        if (values.length === 1) {
            this.targetSelect.value = values[0];
        } else if (values.length === 0) {
            const hasAll = Array.from(this.targetSelect.options).some((o) => o.value === this.allValue);
            if (hasAll) this.targetSelect.value = this.allValue;
        }
        this.options.onChange?.(values);
    }

    public getSelectedValues(): string[] {
        return Array.from(this.selectedValues);
    }

    public setSelectedValues(values: string[], triggerChange: boolean = false): void {
        const validSet = new Set(this.items.map((i) => i.value));
        this.selectedValues = new Set(values.filter((v) => v !== this.allValue && validSet.has(v)));
        this.renderOptionsDOM();
        this.updateTriggerLabel();
        if (triggerChange) {
            this.emitChange();
        }
    }

    public clear(triggerChange: boolean = true): void {
        this.selectedValues.clear();
        this.searchInputEl.value = '';
        this.renderOptionsDOM();
        this.updateTriggerLabel();
        if (triggerChange) {
            this.emitChange();
        }
    }

    private open(): void {
        this.isOpen = true;
        this.dropdownEl.style.display = 'block';
        this.triggerEl.setAttribute('aria-expanded', 'true');
        this.searchInputEl.focus();
    }

    private close(): void {
        this.isOpen = false;
        this.dropdownEl.style.display = 'none';
        this.triggerEl.setAttribute('aria-expanded', 'false');
    }
}
