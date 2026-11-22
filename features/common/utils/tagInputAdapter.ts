/**
 * @file Dedicated Host DOM Adapter for TagInput Control
 * @module features/common/utils/tagInputAdapter
 * @description Encapsulates host input element interception and Preact mounting
 * for legacy input bindings without contaminating declarative component files.
 */

import { h, render } from 'preact';
import { TagInput, TagInputOptions } from './tagInput';
import { UIUtils } from './uiUtils';

export class TagInputControl {
    private targetInput: HTMLInputElement;
    public options: TagInputOptions;
    private tags: string[] = [];
    private container: HTMLDivElement;
    private originalValueDescriptor: PropertyDescriptor | undefined;

    private constructor(targetInput: HTMLInputElement, options: TagInputOptions = {}) {
        this.targetInput = targetInput;
        this.options = options;

        this.targetInput.setAttribute('style', 'display: none');
        this.targetInput.setAttribute('tabindex', '-1');

        this.container = document.createElement('div');
        if (typeof this.targetInput.after === 'function') {
            this.targetInput.after(this.container);
        } else if (this.targetInput.parentElement) {
            this.targetInput.parentElement.insertBefore(this.container, this.targetInput.nextSibling);
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
            h(TagInput, {
                tags: this.tags,
                onChange: (updated: string[]) => this.setTags(updated, true),
                getSuggestions: this.options.getSuggestions,
                placeholder: this.options.placeholder || this.targetInput.placeholder,
                maxTags: this.options.maxTags,
                disabled: this.options.disabled
            }),
            this.container
        );
    }

    public destroy(): void {
        render(null, this.container);
        if (typeof this.container.remove === 'function') {
            this.container.remove();
        } else if (this.container.parentElement) {
            this.container.parentElement.removeChild(this.container);
        }
        this.targetInput.removeAttribute('style');
        this.targetInput.removeAttribute('tabindex');
        if (this.originalValueDescriptor) {
            Object.defineProperty(this.targetInput, 'value', this.originalValueDescriptor);
        }
        delete (this.targetInput as unknown as { __tagInputControl?: TagInputControl }).__tagInputControl;
    }
}
