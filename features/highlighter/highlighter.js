// features/highlighter/highlighter.js - Highlighter feature UI & logic
let isHighlighterListenersBound = false;

/**
 * Initializes the highlight tooltip node and registers page-level event listeners.
 * Binds pointerup for selections, mousemove for hover detection, and sets up themes.
 */
function createHighlighterUI() {
    if (!document.getElementById('algo-highlight-tooltip')) {
        const tooltip = document.createElement('div');
        tooltip.id = 'algo-highlight-tooltip';
        document.body.appendChild(tooltip);
    }

    if (isHighlighterListenersBound) {
        applyThemeClass();
        return;
    }

    // 1. Text Selection Logic (For NEW highlights) - Use Capturing Phase and pointerup to bypass LeetCode event cancellation
    document.addEventListener('pointerup', (e) => {
        if (!chromeSettings.showMarkerPopup) return;
        if (e.target.closest('#algo-highlight-tooltip') || e.target.closest('#algo-fsrs-container')) return;

        const selection = window.getSelection();
        const tooltip = document.getElementById('algo-highlight-tooltip');
        if (!tooltip) return;

        if (!selection || selection.isCollapsed || selection.toString().trim() === '') {
            if (hoveredMarkId === null) tooltip.style.display = 'none';
            return;
        }

        hoveredMarkId = null;
        clearTimeout(hideTooltipTimer);
        hideTooltipTimer = null;

        const range = selection.getRangeAt(0);

        // --- NEW POSITIONING: Get the exact last line of the multi-line selection ---
        const rects = range.getClientRects();
        let lastRect = rects.length > 0 ? rects[rects.length - 1] : null;

        if (!lastRect) {
            const bounding = range.getBoundingClientRect();
            if (bounding && (bounding.width > 0 || bounding.height > 0)) {
                lastRect = bounding;
            }
        }

        if (!lastRect) return;

        renderTooltipColors(null, null);
        tooltip.style.display = 'flex';

        // Anchor to the bottom-right corner where the highlight ends
        tooltip.style.left = `${lastRect.right + window.scrollX}px`;
        tooltip.style.top = `${lastRect.bottom + window.scrollY}px`;
    }, true);

    // 2. Hover Detection Logic (For EXISTING highlights)
    document.addEventListener('mousemove', (e) => {
        if (!chromeSettings.showMarkerPopup) return;

        if (e.target.closest('#algo-highlight-tooltip') || e.target.closest('#algo-fsrs-container')) {
            clearTimeout(hideTooltipTimer);
            hideTooltipTimer = null;
            return;
        }

        const selection = window.getSelection();
        if (selection && !selection.isCollapsed && selection.toString().trim() !== '') return;

        let foundMark = null;
        for (const item of activeMarkRanges) {
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
            clearTimeout(hideTooltipTimer);
            hideTooltipTimer = null;

            if (hoveredMarkId !== foundMark.markId) {
                hoveredMarkId = foundMark.markId;
                renderTooltipColors(hoveredMarkId, foundMark.color);
                tooltip.style.display = 'flex';

                // --- NEW POSITIONING: Snap just below the cursor ---
                // We add 15px to X so the little triangle pointer perfectly aligns under the cursor
                tooltip.style.left = `${e.clientX + window.scrollX + 15}px`;
                tooltip.style.top = `${e.clientY + window.scrollY}px`;
            }
        } else {
            if (hoveredMarkId !== null && !hideTooltipTimer) {
                hideTooltipTimer = setTimeout(() => {
                    hoveredMarkId = null;
                    tooltip.style.display = 'none';
                    hideTooltipTimer = null;
                }, 400);
            }
        }
    });

    isHighlighterListenersBound = true;
    applyThemeClass();
}

/**
 * Renders the color palette bubble swatches, custom input color-picker, delete button,
 * and text-note inputs for annotations in the highlighting tooltip.
 * 
 * @param {string|null} existingMarkId - The targeted highlight ID if editing, or null if creating new.
 * @param {string|null} currentColor - Active hex color code of selection.
 */
function renderTooltipColors(existingMarkId = null, currentColor = null) {
    const tooltip = document.getElementById('algo-highlight-tooltip');
    tooltip.innerHTML = '';

    // Fetch active palette colors
    const activePalette = chromeSettings.palettes && chromeSettings.palettes[chromeSettings.activePaletteIndex]
        ? chromeSettings.palettes[chromeSettings.activePaletteIndex]
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
            if (existingMarkId) updateHighlightColor(existingMarkId, color);
            else saveHighlight(color);
        });
        tooltip.appendChild(swatch);
    });

    // Custom Color Picker
    const picker = document.createElement('input');
    picker.type = 'color';
    picker.id = 'algo-color-picker';
    picker.value = currentColor || chromeSettings.defaultHighlightColor;
    picker.addEventListener('input', (e) => {
        const newColor = e.target.value;
        if (existingMarkId) updateHighlightColor(existingMarkId, newColor);
        else saveHighlight(newColor);
        updateRecentColors(newColor);
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
            deleteHighlight(existingMarkId);
        });
        tooltip.appendChild(deleteBtn);

        // R7.1: Annotation note input
        const existingMark = marks.find(m => (m.id || m.createdAt.toString()) === existingMarkId);
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
            saveMarkNote(existingMarkId, noteInput.value);
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

function updateRecentColors(newColor) {
    chromeSettings.defaultHighlightColor = newColor;
    chromeSettings.recentColors = [newColor, ...chromeSettings.recentColors.filter(c => c !== newColor)].slice(0, 4);
    chrome.storage.local.set({ chromeSettings });
}

/**
 * Captures user text selection, serializes coordinates, saves the mark info to local storage,
 * and triggers CSS Custom Highlights rendering on page content.
 * 
 * @param {string} color - Hex color code.
 */
function saveHighlight(color) {
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
            startMeta: getDOMMeta(range.startContainer, range.startOffset),
            endMeta: getDOMMeta(range.endContainer, range.endOffset)
        }
    };

    marks.push(newMark);

    if (!bookmarks.find(b => b.url === cleanUrl)) {
        bookmarks.push({ url: cleanUrl, title: getExtractedProblemTitle(), meta: { favIconUrl: 'https://algo.monster/favicon.ico' } });
    }
    pagecontents = pagecontents.filter(p => p.url !== cleanUrl);
    pagecontents.push({ url: cleanUrl, description: document.body.innerText.substring(0, 100), length: document.body.innerText.length });

    chrome.storage.local.set({ marks, bookmarks, pagecontents });

    document.getElementById('algo-highlight-tooltip').style.display = 'none';
    selection.removeAllRanges();
    applyHighlightsForCurrentPage();
}

function updateHighlightColor(markId, newColor) {
    const markIndex = marks.findIndex(m => (m.id || m.createdAt.toString()) === markId);
    if (markIndex > -1) {
        marks[markIndex].color = newColor;
        chrome.storage.local.set({ marks });
        applyHighlightsForCurrentPage();
        renderTooltipColors(markId, newColor);
    }
}

/**
 * Removes a highlight mark from list arrays, sets storage, and clears highlight ranges.
 * 
 * @param {string} markId 
 */
function deleteHighlight(markId) {
    marks = marks.filter(m => (m.id || m.createdAt.toString()) !== markId);
    chrome.storage.local.set({ marks });

    document.getElementById('algo-highlight-tooltip').style.display = 'none';
    hoveredMarkId = null;
    applyHighlightsForCurrentPage();
}

/**
 * Saves and updates the text annotation note attached to a highlight mark.
 * 
 * @param {string} markId 
 * @param {string} noteText 
 */
function saveMarkNote(markId, noteText) {
    const markIndex = marks.findIndex(m => (m.id || m.createdAt.toString()) === markId);
    if (markIndex > -1) {
        marks[markIndex].note = noteText.trim();
        chrome.storage.local.set({ marks });
    }
}

function applyHighlightsForCurrentPage() {
    if (!('highlights' in CSS)) return;

    const cleanUrl = window.location.href.split('?')[0].split('#')[0];
    const pageMarks = marks.filter(m => m.url === cleanUrl);

    CSS.highlights.clear();
    const highlightsByColor = {};
    activeMarkRanges = [];

    pageMarks.forEach(mark => {
        const range = restoreRangeFromMeta(mark.highlightSource, mark.text);
        if (range) {
            const targetId = mark.id || mark.createdAt.toString();
            activeMarkRanges.push({ markId: targetId, range: range, color: mark.color });

            const colorName = ensureHighlightStyle(mark.color);
            if (!highlightsByColor[colorName]) highlightsByColor[colorName] = [];
            highlightsByColor[colorName].push(range);
        }
    });

    for (const [colorName, ranges] of Object.entries(highlightsByColor)) {
        CSS.highlights.set(colorName, new Highlight(...ranges));
    }
}
