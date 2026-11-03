/**
 * @file tests/unit/features/tracker/editor/EditorComponents.test.tsx
 * @description Unit tests for Preact editor sub-components and workspace view.
 */

import { h, render } from 'preact';
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import {
    EditorHeader,
    ComplexityInputs,
    MarkdownPreview,
    EditorFooter,
    EditorToast,
    EditorWorkspace
} from '../../../../../features/tracker/editor/editor';

describe('Editor Preact Components', () => {
    let container: HTMLDivElement;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    afterEach(() => {
        render(null, container);
        container.remove();
        jest.restoreAllMocks();
    });

    describe('EditorHeader', () => {
        it('renders problem title, url, preview toggle, and save status', () => {
            const onTogglePreview = jest.fn();
            const onClose = jest.fn();

            render(
                <EditorHeader
                    title="Two Sum"
                    url="https://leetcode.com/problems/two-sum"
                    saveStatus="All changes saved"
                    isPreviewMode={false}
                    onTogglePreview={onTogglePreview}
                    onClose={onClose}
                />,
                container
            );

            expect(container.querySelector('#problem-title')?.textContent).toBe('Two Sum');
            expect(container.querySelector('#problem-url')?.textContent).toBe('https://leetcode.com/problems/two-sum');
            expect(container.querySelector('#save-status')?.textContent).toBe('All changes saved');

            const toggleBtn = container.querySelector('#preview-toggle-btn') as HTMLElement;
            expect(toggleBtn).not.toBeNull();
            expect(toggleBtn.textContent).toContain('Preview');

            toggleBtn.click();
            expect(onTogglePreview).toHaveBeenCalled();

            const backBtn = container.querySelector('#header-back-btn') as HTMLElement;
            backBtn.click();
            expect(onClose).toHaveBeenCalled();
        });

        it('shows Edit button in header when isPreviewMode is true', () => {
            render(
                <EditorHeader
                    title="Two Sum"
                    url="https://leetcode.com/problems/two-sum"
                    saveStatus="Saved"
                    isPreviewMode={true}
                    onTogglePreview={jest.fn()}
                    onClose={jest.fn()}
                />,
                container
            );

            const toggleBtn = container.querySelector('#preview-toggle-btn') as HTMLElement;
            expect(toggleBtn.textContent).toContain('Edit');
        });
    });

    describe('ComplexityInputs', () => {
        it('renders time and space complexity inputs and emits changes', () => {
            const onTimeChange = jest.fn();
            const onSpaceChange = jest.fn();

            render(
                <ComplexityInputs
                    timeComplexity="O(N)"
                    spaceComplexity="O(1)"
                    onTimeChange={onTimeChange}
                    onSpaceChange={onSpaceChange}
                />,
                container
            );

            const tcInput = container.querySelector('#time-complexity-input') as HTMLInputElement;
            const scInput = container.querySelector('#space-complexity-input') as HTMLInputElement;

            expect(tcInput.value).toBe('O(N)');
            expect(scInput.value).toBe('O(1)');

            tcInput.value = 'O(N log N)';
            tcInput.dispatchEvent(new Event('input', { bubbles: true }));
            expect(onTimeChange).toHaveBeenCalledWith('O(N log N)');

            scInput.value = 'O(N)';
            scInput.dispatchEvent(new Event('input', { bubbles: true }));
            expect(onSpaceChange).toHaveBeenCalledWith('O(N)');
        });
    });

    describe('MarkdownPreview', () => {
        it('renders empty notice when content is blank or whitespace', () => {
            render(<MarkdownPreview content="   " />, container);

            const emptyEl = container.querySelector('.editor-preview-empty');
            expect(emptyEl).not.toBeNull();
            expect(emptyEl?.textContent).toContain('No content to preview');
        });

        it('renders markdown HTML when content is provided', () => {
            render(<MarkdownPreview content="## Subheading&#10;`code snippet`" />, container);

            expect(container.innerHTML).toContain('Subheading');
        });
    });

    describe('EditorFooter', () => {
        it('renders Save and Save & Close buttons and handles clicks', () => {
            const onSave = jest.fn();
            const onSaveAndClose = jest.fn();

            render(
                <EditorFooter
                    onSave={onSave}
                    onSaveAndClose={onSaveAndClose}
                />,
                container
            );

            const saveBtn = container.querySelector('#save-btn') as HTMLElement;
            const saveCloseBtn = container.querySelector('#save-close-btn') as HTMLElement;

            expect(saveBtn).not.toBeNull();
            expect(saveCloseBtn).not.toBeNull();

            saveBtn.click();
            expect(onSave).toHaveBeenCalled();

            saveCloseBtn.click();
            expect(onSaveAndClose).toHaveBeenCalled();
        });
    });

    describe('EditorToast', () => {
        it('renders toast with show class when show is true', () => {
            render(<EditorToast message="Progress saved!" show={true} />, container);

            const toast = container.querySelector('#status-toast');
            expect(toast).not.toBeNull();
            expect(toast?.textContent).toBe('Progress saved!');
            expect(toast?.classList.contains('show')).toBe(true);
        });

        it('omits show class when show is false', () => {
            render(<EditorToast message="Progress saved!" show={false} />, container);

            const toast = container.querySelector('#status-toast');
            expect(toast?.classList.contains('show')).toBe(false);
        });
    });

    describe('EditorWorkspace', () => {
        it('renders full workspace integrating header, inputs, textarea, footer, and toast', () => {
            render(
                <EditorWorkspace
                    title="Two Sum"
                    url="https://leetcode.com"
                    saveStatus="Ready"
                    timeComplexity="O(N)"
                    spaceComplexity="O(1)"
                    approach="Use map"
                    isPreviewMode={false}
                    toastMessage="Saved"
                    isToastVisible={false}
                    onTimeChange={jest.fn()}
                    onSpaceChange={jest.fn()}
                    onApproachChange={jest.fn()}
                    onTogglePreview={jest.fn()}
                    onSave={jest.fn()}
                    onSaveAndClose={jest.fn()}
                    onClose={jest.fn()}
                />,
                container
            );

            expect(container.querySelector('.editor-container')).not.toBeNull();
            expect(container.querySelector('#problem-title')?.textContent).toBe('Two Sum');
            expect(container.querySelector('#editor-textarea')).not.toBeNull();
            expect(container.querySelector('#save-btn')).not.toBeNull();
        });
    });
});

