declare global {
    interface Window {
        AlgoRecall: any;
    }
}

window.AlgoRecall = window.AlgoRecall || {};

/**
 * @class Highlighter
 * @description Controller for the webpage text highlighting system.
 * Captures user text selection ranges, displays color-picker annotation popups,
 * and renders highlighting decorations using the CSS Custom Highlights API.
 */
export class Highlighter {
    isHighlighterListenersBound: boolean;

    constructor() {
        this.isHighlighterListenersBound = false;
    }

    get state(): any {
        return window.AlgoRecall.state;
    }

    get utils(): any {
        return window.AlgoRecall.Utils;
    }

    createHighlighterUI(): void {
        if (!document.getElementById('algo-highlight-tooltip')) {
            const tooltip = document.createElement('div');
            tooltip.id = 'algo-highlight-tooltip';
            tooltip.setAttribute('role', 'dialog');
            tooltip.setAttribute('aria-label', 'Highlighter Options');
            document.body.appendChild(tooltip);
        }

        if (this.isHighlighterListenersBound) {
            if (window.AlgoRecall.orchestrator) {
                window.AlgoRecall.orchestrator.applyThemeClass();
            }
            return;
        }

        document.addEventListener('pointerup', (e: MouseEvent) => {
            if (!this.state.chromeSettings.showMarkerPopup) return;
            const target = e.target as HTMLElement | null;
            if (target && (target.closest('#algo-highlight-tooltip') || target.closest('#algo-fsrs-container'))) return;

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

            tooltip.style.left = `${lastRect.right + window.scrollX}px`;
            tooltip.style.top = `${lastRect.bottom + window.scrollY}px`;
        }, true);

        document.addEventListener('mousemove', (e: MouseEvent) => {
            if (!this.state.chromeSettings.showMarkerPopup) return;
            const target = e.target as HTMLElement | null;

            if (target && (target.closest('#algo-highlight-tooltip') || target.closest('#algo-fsrs-container'))) {
                clearTimeout(this.state.hideTooltipTimer);
                this.state.hideTooltipTimer = null;
                return;
            }

            const selection = window.getSelection();
            if (selection && !selection.isCollapsed && selection.toString().trim() !== '') return;

            let foundMark: any = null;
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

    renderTooltipColors(existingMarkId: string | null = null, currentColor: string | null = null): void {
        const tooltip = document.getElementById('algo-highlight-tooltip');
        if (!tooltip) return;
        tooltip.innerHTML = '';

        let activeType = 'highlight';

        if (!existingMarkId) {
            const typeContainer = document.createElement('div');
            typeContainer.className = 'algo-type-selector';
            typeContainer.style.display = 'flex';
            typeContainer.style.width = '100%';
            typeContainer.style.marginBottom = '12px';
            typeContainer.style.borderRadius = '8px';
            typeContainer.style.overflow = 'hidden';
            typeContainer.style.border = '1px solid var(--w-border)';
            typeContainer.setAttribute('role', 'radiogroup');
            typeContainer.setAttribute('aria-label', 'Highlight Type');

            const types = ['highlight', 'underline'];
            const typeBtns: Record<string, HTMLButtonElement> = {};
            
            types.forEach((t) => {
                const btn = document.createElement('button');
                btn.textContent = t.charAt(0).toUpperCase() + t.slice(1);
                btn.className = 'algo-type-btn';
                btn.style.flex = '1';
                btn.style.padding = '8px 0';
                btn.style.fontSize = '12px';
                btn.style.fontWeight = '500';
                btn.style.cursor = 'pointer';
                btn.style.border = 'none';
                btn.style.outline = 'none';
                
                const isActive = t === 'highlight';
                btn.style.background = isActive ? 'var(--w-primary-container)' : 'var(--w-bg-dark)';
                btn.style.color = isActive ? 'var(--w-on-primary-container)' : 'var(--w-text-med)';
                
                btn.setAttribute('role', 'radio');
                btn.setAttribute('aria-checked', isActive.toString());
                btn.setAttribute('tabindex', isActive ? '0' : '-1');

                const setActiveType = (typeVal: string) => {
                    activeType = typeVal;
                    types.forEach(type => {
                        const isBtnActive = type === typeVal;
                        typeBtns[type].style.background = isBtnActive ? 'var(--w-primary-container)' : 'var(--w-bg-dark)';
                        typeBtns[type].style.color = isBtnActive ? 'var(--w-on-primary-container)' : 'var(--w-text-med)';
                        typeBtns[type].setAttribute('aria-checked', isBtnActive.toString());
                        typeBtns[type].setAttribute('tabindex', isBtnActive ? '0' : '-1');
                    });
                };

                btn.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setActiveType(t);
                });
                
                btn.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setActiveType(t);
                    }
                });
                typeBtns[t] = btn;
                typeContainer.appendChild(btn);
            });
            tooltip.appendChild(typeContainer);
        }

        const actionsContainer = document.createElement('div');
        actionsContainer.style.display = 'flex';
        actionsContainer.style.alignItems = 'center';
        actionsContainer.style.gap = '8px';
        actionsContainer.style.width = '100%';
        actionsContainer.style.flexWrap = 'wrap';

        const activePalette = this.state.chromeSettings.palettes && this.state.chromeSettings.palettes[this.state.chromeSettings.activePaletteIndex]
            ? this.state.chromeSettings.palettes[this.state.chromeSettings.activePaletteIndex]
            : { colors: ['#f1c40f', '#e74c3c', '#3498db', '#2ecc71', '#9b59b6'] };

        const paletteColors = activePalette.colors || [];

        paletteColors.forEach((color: string) => {
            const swatch = document.createElement('div');
            swatch.className = 'algo-color-swatch';
            swatch.style.background = color;
            swatch.title = `Color: ${color}`;
            swatch.setAttribute('role', 'button');
            swatch.setAttribute('aria-label', `Highlight with color ${color}`);
            swatch.setAttribute('tabindex', '0');

            if (color === currentColor) {
                swatch.classList.add('active');
            }

            const handleSwatchClick = () => {
                if (existingMarkId) this.updateHighlightColor(existingMarkId, color);
                else this.saveHighlight(color, activeType);
            };

            swatch.addEventListener('mousedown', (e) => {
                e.preventDefault();
                handleSwatchClick();
            });
            
            swatch.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleSwatchClick();
                }
            });
            actionsContainer.appendChild(swatch);
        });

        const picker = document.createElement('input');
        picker.type = 'color';
        picker.id = 'algo-color-picker';
        picker.setAttribute('aria-label', 'Custom highlight color');
        picker.value = currentColor || this.state.chromeSettings.defaultHighlightColor;
        picker.addEventListener('input', (e: Event) => {
            const target = e.target as HTMLInputElement;
            const newColor = target.value;
            if (existingMarkId) this.updateHighlightColor(existingMarkId, newColor);
            else this.saveHighlight(newColor, activeType);
            this.updateRecentColors(newColor);
        });
        actionsContainer.appendChild(picker);

        if (existingMarkId) {
            const divider = document.createElement('div');
            divider.className = 'algo-tooltip-divider';
            actionsContainer.appendChild(divider);

            const deleteBtn = document.createElement('div');
            deleteBtn.className = 'algo-delete-btn';
            deleteBtn.setAttribute('role', 'button');
            deleteBtn.setAttribute('aria-label', 'Delete Highlight');
            deleteBtn.setAttribute('tabindex', '0');
            deleteBtn.innerHTML = `<svg class="svg-icon" viewBox="0 0 24 24" style="width:14px; height:14px;"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"></path></svg>`;
            
            const handleDelete = () => {
                this.deleteHighlight(existingMarkId);
                this.renderTooltipColors();
            };

            deleteBtn.addEventListener('mousedown', (e) => {
                e.preventDefault();
                handleDelete();
            });
            
            deleteBtn.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleDelete();
                }
            });
            actionsContainer.appendChild(deleteBtn);
        }

        tooltip.appendChild(actionsContainer);

        if (existingMarkId) {
            const existingMark = this.state.marks.find((m: any) => (m.id || m.createdAt.toString()) === existingMarkId);
            const noteSection = document.createElement('div');
            noteSection.className = 'algo-note-section';

            const categorySelect = document.createElement('select');
            categorySelect.className = 'algo-category-select';
            const categories = ['', 'Key Insight', 'Gotcha', 'Edge Case', 'Pattern'];
            categories.forEach(cat => {
                const opt = document.createElement('option');
                opt.value = cat;
                opt.textContent = cat || 'No Category';
                categorySelect.appendChild(opt);
            });
            categorySelect.value = existingMark?.category || '';
            categorySelect.addEventListener('change', (e: Event) => {
                const target = e.target as HTMLSelectElement;
                this.saveMarkCategory(existingMarkId, target.value);
            });
            noteSection.appendChild(categorySelect);

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
            noteInput.addEventListener('keydown', (e: KeyboardEvent) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    saveNote();
                    noteInput.blur();
                }
            });

            noteSection.appendChild(noteInput);

            const linkBtn = document.createElement('button');
            linkBtn.className = 'algo-link-card-btn';
            linkBtn.title = 'Link to FSRS Card for this page';
            linkBtn.innerHTML = `<svg class="svg-icon" viewBox="0 0 24 24" style="width:14px; height:14px;"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>`;
            linkBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.linkHighlightToCard(existingMarkId);
                const originalHtml = linkBtn.innerHTML;
                linkBtn.innerHTML = '✓';
                linkBtn.style.color = '#2ecc71';
                setTimeout(() => {
                    linkBtn.innerHTML = originalHtml;
                    linkBtn.style.color = '';
                }, 1500);
            });
            noteSection.appendChild(linkBtn);

            tooltip.appendChild(noteSection);
        }
    }

    saveMarkCategory(markId: string, category: string): void {
        const markIndex = this.state.marks.findIndex((m: any) => (m.id || m.createdAt.toString()) === markId);
        if (markIndex > -1) {
            this.state.marks[markIndex].category = category;
            chrome.storage.local.set({ marks: this.state.marks });
        }
    }

    linkHighlightToCard(markId: string): void {
        const mark = this.state.marks.find((m: any) => (m.id || m.createdAt.toString()) === markId);
        if (!mark) return;
        
        const cleanUrl = window.location.href.split('?')[0].split('#')[0];
        const prefix = mark.category ? `**${mark.category}:** ` : '';
        const appendText = `\n\n> ${prefix}${mark.text}` + (mark.note ? `\n> *Note: ${mark.note}*` : '');

        chrome.storage.local.get(['fsrsCards', 'approachDrafts'], (result: { [key: string]: any }) => {
            const cards = result.fsrsCards || [];
            const cardIndex = cards.findIndex((c: any) => c.problemUrl === cleanUrl);
            if (cardIndex > -1) {
                const card = cards[cardIndex];
                let approach = card.approach || '';
                card.approach = (approach + appendText).trim();
                
                chrome.storage.local.set({ fsrsCards: cards }, () => {
                    if (window.AlgoRecall.Notifier) {
                         window.AlgoRecall.Notifier.showPageNotification('Highlight Linked', 'Highlight appended to FSRS card approach.', 'test');
                    }
                });
            } else {
                const drafts = result.approachDrafts || {};
                let draft = drafts[cleanUrl];
                
                if (!draft) {
                    draft = { approach: '', tags: '' };
                } else if (typeof draft === 'string') {
                    draft = { approach: draft, tags: '' };
                }
                
                draft.approach = (draft.approach || '') + appendText;
                draft.approach = draft.approach.trim();
                drafts[cleanUrl] = draft;
                
                chrome.storage.local.set({ approachDrafts: drafts }, () => {
                    if (window.AlgoRecall.Notifier) {
                        window.AlgoRecall.Notifier.showPageNotification('Highlight Linked', 'Highlight appended to unsaved card draft.', 'test');
                    }
                });
            }
        });
    }

    updateRecentColors(newColor: string): void {
        this.state.chromeSettings.defaultHighlightColor = newColor;
        this.state.chromeSettings.recentColors = [newColor, ...this.state.chromeSettings.recentColors.filter((c: string) => c !== newColor)].slice(0, 4);
        chrome.storage.local.set({ chromeSettings: this.state.chromeSettings });
    }

    saveHighlight(color: string, type: string = 'highlight'): void {
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
            type: type,
            note: '',
            highlightSource: {
                startMeta: this.utils.getDOMMeta(range.startContainer, range.startOffset),
                endMeta: this.utils.getDOMMeta(range.endContainer, range.endOffset)
            }
        };

        this.state.marks.push(newMark);

        if (!this.state.bookmarks.find((b: any) => b.url === cleanUrl)) {
            this.state.bookmarks.push({ url: cleanUrl, title: this.utils.getExtractedProblemTitle(), meta: { favIconUrl: 'https://algo.monster/favicon.ico' } });
        }
        this.state.pagecontents = this.state.pagecontents.filter((p: any) => p.url !== cleanUrl);
        this.state.pagecontents.push({ url: cleanUrl, description: document.body.innerText.substring(0, 100), length: document.body.innerText.length });

        chrome.storage.local.set({ marks: this.state.marks, bookmarks: this.state.bookmarks, pagecontents: this.state.pagecontents });

        const tooltip = document.getElementById('algo-highlight-tooltip');
        if (tooltip) tooltip.style.display = 'none';
        selection.removeAllRanges();
        this.applyHighlightsForCurrentPage();
    }

    updateHighlightColor(markId: string, newColor: string): void {
        const markIndex = this.state.marks.findIndex((m: any) => (m.id || m.createdAt.toString()) === markId);
        if (markIndex > -1) {
            this.state.marks[markIndex].color = newColor;
            chrome.storage.local.set({ marks: this.state.marks });
            this.applyHighlightsForCurrentPage();
            this.renderTooltipColors(markId, newColor);
        }
    }

    deleteHighlight(markId: string): void {
        if (window.Logger) window.Logger.debug('Highlighter', `Deleting highlight ID: ${markId}`);
        this.state.marks = this.state.marks.filter((m: any) => (m.id || m.createdAt.toString()) !== markId);
        chrome.storage.local.set({ marks: this.state.marks });

        const tooltip = document.getElementById('algo-highlight-tooltip');
        if (tooltip) tooltip.style.display = 'none';
        this.state.hoveredMarkId = null;
        this.applyHighlightsForCurrentPage();
    }

    saveMarkNote(markId: string, noteText: string): void {
        const markIndex = this.state.marks.findIndex((m: any) => (m.id || m.createdAt.toString()) === markId);
        if (markIndex > -1) {
            this.state.marks[markIndex].note = noteText.trim();
            chrome.storage.local.set({ marks: this.state.marks });
        }
    }

    applyHighlightsForCurrentPage(): void {
        if (!('highlights' in CSS)) {
            if (window.Logger) window.Logger.warn('Highlighter', 'CSS Custom Highlights API not supported in this browser.');
            return;
        }

        if (window.Logger) window.Logger.time('Highlighter', 'applyHighlightsForCurrentPage');

        const cleanUrl = window.location.href.split('?')[0].split('#')[0];
        const pageMarks = this.state.marks.filter((m: any) => m.url === cleanUrl);

        (CSS as any).highlights.clear();
        
        document.querySelectorAll('.algo-floating-symbol').forEach(el => el.remove());

        const highlightsByColor: Record<string, Range[]> = {};
        this.state.activeMarkRanges = [];

        pageMarks.forEach((mark: any) => {
            const range = this.utils.restoreRangeFromMeta(mark.highlightSource, mark.text);
            if (range) {
                const targetId = mark.id || mark.createdAt.toString();
                this.state.activeMarkRanges.push({ markId: targetId, range: range, color: mark.color });

                const type = mark.type || 'highlight';
                const colorName = this.utils.ensureHighlightStyle(mark.color, type);
                
                if (!highlightsByColor[colorName]) highlightsByColor[colorName] = [];
                highlightsByColor[colorName].push(range);
            }
        });

        for (const [colorName, ranges] of Object.entries(highlightsByColor)) {
            (CSS as any).highlights.set(colorName, new (window as any).Highlight(...ranges));
        }

        if (window.Logger) window.Logger.timeEnd('Highlighter', 'applyHighlightsForCurrentPage');
    }
}

window.AlgoRecall.Highlighter = Highlighter;
