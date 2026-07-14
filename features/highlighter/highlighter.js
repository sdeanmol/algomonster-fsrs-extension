window.AlgoRecall = window.AlgoRecall || {};

/**
 * @class PageHighlighter
 * @description Controller for the webpage text highlighting system.
 * Captures user text selection ranges, displays color-picker annotation popups,
 * and renders highlighting decorations using the CSS Custom Highlights API.
 */
window.AlgoRecall.Highlighter = class Highlighter {
    constructor() {
        this.isHighlighterListenersBound = false;
    }

    /**
     * Helper to retrieve state.
     */
    get state() {
        return window.AlgoRecall.state;
    }

    /**
     * Helper to retrieve utils.
     */
    get utils() {
        return window.AlgoRecall.Utils;
    }

    /**
     * Initializes the highlight tooltip node and registers page-level event listeners.
     */
    createHighlighterUI() {
        if (!document.getElementById('algo-highlight-tooltip')) {
            const tooltip = document.createElement('div');
            tooltip.id = 'algo-highlight-tooltip';
            document.body.appendChild(tooltip);
        }

        if (this.isHighlighterListenersBound) {
            if (window.AlgoRecall.orchestrator) {
                window.AlgoRecall.orchestrator.applyThemeClass();
            }
            return;
        }

        // 1. Text Selection Logic (For NEW highlights)
        document.addEventListener('pointerup', (e) => {
            if (!this.state.chromeSettings.showMarkerPopup) return;
            if (e.target.closest('#algo-highlight-tooltip') || e.target.closest('#algo-fsrs-container')) return;

            const selection = window.getSelection();
            const tooltip = document.getElementById('algo-highlight-tooltip');
            if (!tooltip) return;

            if (!selection || selection.isCollapsed || selection.toString().trim() === '') {
                if (this.state.hoveredMarkId === null) tooltip.style.display = 'none';
                return;
            }

            this.state.hoveredMarkId = null;
            clearTimeout(this.state.hideTooltipTimer);
            this.state.hideTooltipTimer = null;

            const range = selection.getRangeAt(0);

            // Positioning: Get the exact last line of the multi-line selection
            const rects = range.getClientRects();
            let lastRect = rects.length > 0 ? rects[rects.length - 1] : null;

            if (!lastRect) {
                const bounding = range.getBoundingClientRect();
                if (bounding && (bounding.width > 0 || bounding.height > 0)) {
                    lastRect = bounding;
                }
            }

            if (!lastRect) return;

            this.renderTooltipColors(null, null);
            tooltip.style.display = 'flex';

            // Anchor to the bottom-right corner where the highlight ends
            tooltip.style.left = `${lastRect.right + window.scrollX}px`;
            tooltip.style.top = `${lastRect.bottom + window.scrollY}px`;
        }, true);

        // 2. Hover Detection Logic (For EXISTING highlights)
        document.addEventListener('mousemove', (e) => {
            if (!this.state.chromeSettings.showMarkerPopup) return;

            if (e.target.closest('#algo-highlight-tooltip') || e.target.closest('#algo-fsrs-container')) {
                clearTimeout(this.state.hideTooltipTimer);
                this.state.hideTooltipTimer = null;
                return;
            }

            const selection = window.getSelection();
            if (selection && !selection.isCollapsed && selection.toString().trim() !== '') return;

            let foundMark = null;
            for (const item of this.state.activeMarkRanges) {
                const rects = item.range.getClientRects();
                for (let i = 0; i < rects.length; i++) {
                    const r = rects[i];
                    if (e.clientX >= r.left - 5 && e.clientX <= r.right + 5 && e.clientY >= r.top - 5 && e.clientY <= r.bottom + 5) {
                        foundMark = item;
                        break;
                    }
                }
                if (foundMark) break;
            }

            const tooltip = document.getElementById('algo-highlight-tooltip');
            if (!tooltip) return;

            if (foundMark) {
                clearTimeout(this.state.hideTooltipTimer);
                this.state.hideTooltipTimer = null;

                if (this.state.hoveredMarkId !== foundMark.markId) {
                    this.state.hoveredMarkId = foundMark.markId;
                    this.renderTooltipColors(this.state.hoveredMarkId, foundMark.color);
                    tooltip.style.display = 'flex';

                    // Positioning: Snap just below the cursor
                    tooltip.style.left = `${e.clientX + window.scrollX + 15}px`;
                    tooltip.style.top = `${e.clientY + window.scrollY}px`;
                }
            } else {
                if (this.state.hoveredMarkId !== null && !this.state.hideTooltipTimer) {
                    this.state.hideTooltipTimer = setTimeout(() => {
                        this.state.hoveredMarkId = null;
                        tooltip.style.display = 'none';
                        this.state.hideTooltipTimer = null;
                    }, 400);
                }
            }
        });

        this.isHighlighterListenersBound = true;
        if (window.AlgoRecall.orchestrator) {
            window.AlgoRecall.orchestrator.applyThemeClass();
        }
    }

    /**
     * Renders the color palette bubble swatches, custom input color-picker, delete button,
     * and text-note inputs for annotations in the highlighting tooltip.
     * 
     * @param {string|null} existingMarkId - The targeted highlight ID if editing, or null if creating new.
     * @param {string|null} currentColor - Active hex color code of selection.
     */
    renderTooltipColors(existingMarkId = null, currentColor = null) {
        const tooltip = document.getElementById('algo-highlight-tooltip');
        if (!tooltip) return;
        tooltip.innerHTML = '';

        // Fetch active palette colors
        const activePalette = this.state.chromeSettings.palettes && this.state.chromeSettings.palettes[this.state.chromeSettings.activePaletteIndex]
            ? this.state.chromeSettings.palettes[this.state.chromeSettings.activePaletteIndex]
            : { colors: ['#f1c40f', '#e74c3c', '#3498db', '#2ecc71', '#9b59b6'] };

        const paletteColors = activePalette.colors || [];

        // Color Swatches
        paletteColors.forEach(color => {
            const swatch = document.createElement('div');
            swatch.className = 'algo-color-swatch';
            swatch.style.backgroundColor = color;

            // Mark as active if this swatch matches the highlight color
            if (existingMarkId && color === currentColor) {
                swatch.classList.add('active');
            }

            swatch.addEventListener('mousedown', (e) => {
                e.preventDefault();
                if (existingMarkId) this.updateHighlightColor(existingMarkId, color);
                else this.saveHighlight(color);
            });
            tooltip.appendChild(swatch);
        });

        // Custom Color Picker
        const picker = document.createElement('input');
        picker.type = 'color';
        picker.id = 'algo-color-picker';
        picker.value = currentColor || this.state.chromeSettings.defaultHighlightColor;
        picker.addEventListener('input', (e) => {
            const newColor = e.target.value;
            if (existingMarkId) this.updateHighlightColor(existingMarkId, newColor);
            else this.saveHighlight(newColor);
            this.updateRecentColors(newColor);
        });
        tooltip.appendChild(picker);

        // Delete Button (Only shows if hovering existing highlight)
        if (existingMarkId) {
            const divider = document.createElement('div');
            divider.className = 'algo-tooltip-divider';
            tooltip.appendChild(divider);

            const deleteBtn = document.createElement('div');
            deleteBtn.className = 'algo-delete-btn';
            deleteBtn.innerHTML = `<svg class="svg-icon" style="width:13px; height:13px;" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`;
            deleteBtn.title = 'Remove Highlight';
            deleteBtn.addEventListener('mousedown', (e) => {
                e.preventDefault();
                this.deleteHighlight(existingMarkId);
            });
            tooltip.appendChild(deleteBtn);

            // Annotation note input
            const existingMark = this.state.marks.find(m => (m.id || m.createdAt.toString()) === existingMarkId);
            const noteSection = document.createElement('div');
            noteSection.className = 'algo-note-section';

            const noteInput = document.createElement('input');
            noteInput.type = 'text';
            noteInput.className = 'algo-note-input';
            noteInput.placeholder = 'Add note...';
            noteInput.value = existingMark?.note || '';
            noteInput.maxLength = 200;

            noteInput.addEventListener('mousedown', (e) => e.stopPropagation());
            noteInput.addEventListener('click', (e) => e.stopPropagation());

            const saveNote = () => {
                this.saveMarkNote(existingMarkId, noteInput.value);
            };
            noteInput.addEventListener('blur', saveNote);
            noteInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    saveNote();
                    noteInput.blur();
                }
            });

            noteSection.appendChild(noteInput);
            tooltip.appendChild(noteSection);
        }
    }

    /**
     * Updates the default highlighted color parameter and recent colors array.
     * Saves the settings list back to chrome local storage.
     * @param {string} newColor - Hex color code.
     */
    updateRecentColors(newColor) {
        this.state.chromeSettings.defaultHighlightColor = newColor;
        this.state.chromeSettings.recentColors = [newColor, ...this.state.chromeSettings.recentColors.filter(c => c !== newColor)].slice(0, 4);
        chrome.storage.local.set({ chromeSettings: this.state.chromeSettings });
    }

    /**
     * Captures user text selection, serializes coordinates, saves the mark info to local storage,
     * and triggers CSS Custom Highlights rendering on page content.
     * 
     * @param {string} color - Hex color code.
     */
    saveHighlight(color) {
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed) return;

        const range = selection.getRangeAt(0);
        const cleanUrl = window.location.href.split('?')[0].split('#')[0];
        const timestamp = new Date().getTime();

        const newMark = {
            id: `mark_${timestamp}_${Math.random().toString(36).substr(2, 5)}`,
            createdAt: timestamp,
            url: cleanUrl,
            text: selection.toString(),
            color: color,
            note: '',
            highlightSource: {
                startMeta: this.utils.getDOMMeta(range.startContainer, range.startOffset),
                endMeta: this.utils.getDOMMeta(range.endContainer, range.endOffset)
            }
        };

        this.state.marks.push(newMark);

        if (!this.state.bookmarks.find(b => b.url === cleanUrl)) {
            this.state.bookmarks.push({ url: cleanUrl, title: this.utils.getExtractedProblemTitle(), meta: { favIconUrl: 'https://algo.monster/favicon.ico' } });
        }
        this.state.pagecontents = this.state.pagecontents.filter(p => p.url !== cleanUrl);
        this.state.pagecontents.push({ url: cleanUrl, description: document.body.innerText.substring(0, 100), length: document.body.innerText.length });

        chrome.storage.local.set({ marks: this.state.marks, bookmarks: this.state.bookmarks, pagecontents: this.state.pagecontents });

        document.getElementById('algo-highlight-tooltip').style.display = 'none';
        selection.removeAllRanges();
        this.applyHighlightsForCurrentPage();
    }

    /**
     * Updates the highlight color of an existing mark in memory and storage,
     * and triggers a full page highlights refresh.
     * @param {string} markId - The ID of the targeted mark.
     * @param {string} newColor - The new hex color value.
     */
    updateHighlightColor(markId, newColor) {
        const markIndex = this.state.marks.findIndex(m => (m.id || m.createdAt.toString()) === markId);
        if (markIndex > -1) {
            this.state.marks[markIndex].color = newColor;
            chrome.storage.local.set({ marks: this.state.marks });
            this.applyHighlightsForCurrentPage();
            this.renderTooltipColors(markId, newColor);
        }
    }

    /**
     * Removes a highlight mark from list arrays, sets storage, and clears highlight ranges.
     * 
     * @param {string} markId - The ID of the targeted mark.
     */
    deleteHighlight(markId) {
        this.state.marks = this.state.marks.filter(m => (m.id || m.createdAt.toString()) !== markId);
        chrome.storage.local.set({ marks: this.state.marks });

        document.getElementById('algo-highlight-tooltip').style.display = 'none';
        this.state.hoveredMarkId = null;
        this.applyHighlightsForCurrentPage();
    }

    /**
     * Saves and updates the text annotation note attached to a highlight mark.
     * 
     * @param {string} markId - The ID of the targeted mark.
     * @param {string} noteText - Annotated note string.
     */
    saveMarkNote(markId, noteText) {
        const markIndex = this.state.marks.findIndex(m => (m.id || m.createdAt.toString()) === markId);
        if (markIndex > -1) {
            this.state.marks[markIndex].note = noteText.trim();
            chrome.storage.local.set({ marks: this.state.marks });
        }
    }

    /**
     * Restores all highlight meta coordinates for the active page URL from storage,
     * registers custom styles using ensureHighlightStyle, and applies highlights
     * via the standard CSS Custom Highlights API.
     */
    applyHighlightsForCurrentPage() {
        if (!('highlights' in CSS)) return;

        const cleanUrl = window.location.href.split('?')[0].split('#')[0];
        const pageMarks = this.state.marks.filter(m => m.url === cleanUrl);

        CSS.highlights.clear();
        const highlightsByColor = {};
        this.state.activeMarkRanges = [];

        pageMarks.forEach(mark => {
            const range = this.utils.restoreRangeFromMeta(mark.highlightSource, mark.text);
            if (range) {
                const targetId = mark.id || mark.createdAt.toString();
                this.state.activeMarkRanges.push({ markId: targetId, range: range, color: mark.color });

                const colorName = this.utils.ensureHighlightStyle(mark.color);
                if (!highlightsByColor[colorName]) highlightsByColor[colorName] = [];
                highlightsByColor[colorName].push(range);
            }
        });

        for (const [colorName, ranges] of Object.entries(highlightsByColor)) {
            CSS.highlights.set(colorName, new Highlight(...ranges));
        }
    }
};
