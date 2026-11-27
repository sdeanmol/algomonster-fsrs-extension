/**
 * @file Searchable Multi-Select Dropdown Preact Component
 * @module features/common/ui/components/MultiSelect
 * @context Shared across Data Manager, Popup Quick Search, Analytics, and Highlights Manager
 * @description Declarative Preact multi-select dropdown with live search filtering,
 * checkbox options, Select All / Clear actions, and outside-click / Escape dismissal.
 */

import { h, JSX } from 'preact';
import { useState, useEffect, useRef, useMemo } from 'preact/hooks';

export interface MultiSelectOption {
    value: string;
    label: string;
}

export interface MultiSelectProps {
    /** Optional ID for the wrapper or hidden/accessible attributes */
    id?: string;
    /** Available selectable options */
    options: MultiSelectOption[];
    /** Currently selected option values */
    selectedValues: string[];
    /** Callback invoked when selection changes */
    onChange: (values: string[]) => void;
    /** Label displayed when zero options are selected */
    placeholder?: string;
    /** Placeholder for the search input inside the dropdown */
    searchPlaceholder?: string;
    /** Accessible label for the trigger button */
    ariaLabel?: string;
}

export function MultiSelect({
    id,
    options,
    selectedValues,
    onChange,
    placeholder = 'All',
    searchPlaceholder = 'Search...',
    ariaLabel
}: MultiSelectProps): JSX.Element {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const wrapperRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    const selectedSet = useMemo(() => new Set(selectedValues), [selectedValues]);

    const filteredOptions = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return options;
        return options.filter((opt) => opt.label.toLowerCase().includes(q));
    }, [options, searchQuery]);

    const triggerLabel = useMemo(() => {
        if (selectedValues.length === 0) return placeholder;
        if (selectedValues.length === 1) {
            const match = options.find((o) => o.value === selectedValues[0]);
            return match ? match.label : selectedValues[0];
        }
        return `${selectedValues.length} selected`;
    }, [selectedValues, options, placeholder]);

    useEffect(() => {
        if (!isOpen) return;
        const handleClickOutside = (e: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, [isOpen]);

    useEffect(() => {
        if (isOpen) {
            searchInputRef.current?.focus();
        }
    }, [isOpen]);

    const toggleOption = (value: string) => {
        const next = new Set(selectedSet);
        if (next.has(value)) {
            next.delete(value);
        } else {
            next.add(value);
        }
        onChange(Array.from(next));
    };

    const handleSelectAll = () => {
        const next = new Set(selectedSet);
        for (const opt of filteredOptions) {
            next.add(opt.value);
        }
        onChange(Array.from(next));
    };

    const handleClear = () => {
        setSearchQuery('');
        onChange([]);
    };

    return (
        <div
            ref={wrapperRef}
            id={id}
            className="multi-select-wrapper"
            onKeyDown={(e: KeyboardEvent) => {
                if (e.key === 'Escape' && isOpen) {
                    setIsOpen(false);
                    triggerRef.current?.focus();
                }
            }}
        >
            <button
                ref={triggerRef}
                type="button"
                className={`multi-select-trigger ${selectedValues.length > 0 ? 'has-selection' : ''}`}
                role="combobox"
                aria-haspopup="listbox"
                aria-expanded={isOpen ? 'true' : 'false'}
                aria-label={ariaLabel || placeholder}
                onClick={(e: MouseEvent) => {
                    e.stopPropagation();
                    setIsOpen((prev) => !prev);
                }}
            >
                <span className="multi-select-label">{triggerLabel}</span>
                <span className="multi-select-chevron" aria-hidden="true">&#9662;</span>
            </button>

            <div
                className="multi-select-dropdown"
                style={{ display: isOpen ? 'block' : 'none' }}
                onClick={(e: MouseEvent) => e.stopPropagation()}
            >
                <div className="multi-select-search-wrap">
                    <input
                        ref={searchInputRef}
                        type="text"
                        className="multi-select-search"
                        placeholder={searchPlaceholder}
                        aria-label="Filter options"
                        value={searchQuery}
                        onInput={(e: Event) => setSearchQuery((e.target as HTMLInputElement).value)}
                    />
                </div>
                <div className="multi-select-actions">
                    <button
                        type="button"
                        className="multi-select-action-btn multi-select-all-btn"
                        onClick={handleSelectAll}
                    >
                        Select all
                    </button>
                    <button
                        type="button"
                        className="multi-select-action-btn multi-select-clear-btn"
                        onClick={handleClear}
                    >
                        Clear
                    </button>
                </div>
                <div className="multi-select-options" role="listbox" aria-multiselectable="true">
                    {filteredOptions.length === 0 ? (
                        <div className="multi-select-empty">No options available</div>
                    ) : (
                        filteredOptions.map((opt) => (
                            <label key={opt.value} className="multi-select-option">
                                <input
                                    type="checkbox"
                                    value={opt.value}
                                    checked={selectedSet.has(opt.value)}
                                    onChange={() => toggleOption(opt.value)}
                                />
                                <span>{opt.label}</span>
                            </label>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
