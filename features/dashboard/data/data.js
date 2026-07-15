/**
 * @file features/dashboard/data/data.js
 * @description R6.1: Filtered deck export/import logic.
 */

class DataManager {
    constructor() {
        this.cards = [];
        this.pendingImport = null;
        this.init();
    }

    async init() {
        await this.loadData();
        this.populateFilters();
        this.bindEvents();
    }

    async loadData() {
        const result = await chrome.storage.local.get(['fsrsCards']);
        this.cards = result.fsrsCards || [];
    }

    _extractPlatform(url) {
        if (!url) return 'Unknown';
        if (url.includes('leetcode.com')) return 'LeetCode';
        if (url.includes('codeforces.com')) return 'Codeforces';
        if (url.includes('algo.monster')) return 'AlgoMonster';
        if (url.includes('codechef.com')) return 'CodeChef';
        if (url.includes('atcoder.jp')) return 'AtCoder';
        return 'Other';
    }

    populateFilters() {
        const tagsSet = new Set();
        const platformSet = new Set();

        this.cards.forEach(c => {
            if (c.tags) c.tags.forEach(t => tagsSet.add(t));
            platformSet.add(this._extractPlatform(c.problemUrl));
        });

        const tagSelect = document.getElementById('export-tag-select');
        [...tagsSet].sort().forEach(tag => {
            const opt = document.createElement('option');
            opt.value = tag;
            opt.textContent = tag;
            tagSelect.appendChild(opt);
        });

        const platSelect = document.getElementById('export-platform-select');
        [...platformSet].sort().forEach(plat => {
            const opt = document.createElement('option');
            opt.value = plat;
            opt.textContent = plat;
            platSelect.appendChild(opt);
        });
    }

    bindEvents() {
        // Export
        document.getElementById('export-deck-btn').addEventListener('click', () => this.handleExport());

        // Import Drag & Drop
        const uploadArea = document.getElementById('upload-area');
        const fileInput = document.getElementById('import-file');

        uploadArea.addEventListener('click', () => fileInput.click());
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });
        uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('dragover'));
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            if (e.dataTransfer.files.length) this.processFile(e.dataTransfer.files[0]);
        });
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length) this.processFile(e.target.files[0]);
        });

        // Import confirm/cancel
        document.getElementById('confirm-import-btn').addEventListener('click', () => this.confirmImport());
        document.getElementById('cancel-import-btn').addEventListener('click', () => this.cancelImport());
    }

    handleExport() {
        const tagFilter = document.getElementById('export-tag-select').value;
        const platFilter = document.getElementById('export-platform-select').value;
        const includeHistory = document.getElementById('export-include-history').checked;

        let exportCards = [...this.cards];

        if (tagFilter !== '__all__') {
            exportCards = exportCards.filter(c => c.tags && c.tags.includes(tagFilter));
        }

        if (platFilter !== '__all__') {
            exportCards = exportCards.filter(c => this._extractPlatform(c.problemUrl) === platFilter);
        }

        if (exportCards.length === 0) {
            this.showToast('No cards match these filters.', 'error');
            return;
        }

        if (!includeHistory) {
            exportCards = exportCards.map(c => ({
                id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
                problemTitle: c.problemTitle,
                problemUrl: c.problemUrl,
                textRead: c.textRead,
                approach: c.approach,
                tags: c.tags,
                due: Date.now(),
                stability: 0,
                difficulty: 0,
                elapsed_days: 0,
                scheduled_days: 0,
                reps: 0,
                lapses: 0,
                state: 0,
                historyLog: [Date.now()],
                timeComplexity: c.timeComplexity || '',
                spaceComplexity: c.spaceComplexity || '',
                problemDifficulty: c.problemDifficulty || ''
            }));
        }

        const bundle = {
            version: 1,
            type: 'algorecall_deck',
            exportedAt: new Date().toISOString(),
            cards: exportCards
        };

        const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const filename = tagFilter !== '__all__' ? `algorecall_deck_${tagFilter}.json` : `algorecall_deck_full.json`;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);

        this.showToast(`Exported ${exportCards.length} cards successfully.`, 'success');
    }

    processFile(file) {
        if (!file.name.endsWith('.json')) {
            this.showToast('Please select a JSON file.', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                if (data.type !== 'algorecall_deck' || !Array.isArray(data.cards)) {
                    this.showToast('Invalid deck format.', 'error');
                    return;
                }

                // Check for duplicates
                const existingUrls = new Set(this.cards.map(c => c.problemUrl));
                const newCards = data.cards.filter(c => !existingUrls.has(c.problemUrl));

                this.pendingImport = newCards;
                const stats = document.getElementById('import-stats');
                stats.textContent = `Found ${data.cards.length} cards. ${newCards.length} are new to your database.`;
                document.getElementById('import-preview').style.display = 'block';

            } catch (err) {
                this.showToast('Failed to parse JSON.', 'error');
            }
        };
        reader.readAsText(file);
    }

    async confirmImport() {
        if (!this.pendingImport) return;

        if (this.pendingImport.length > 0) {
            this.cards = [...this.cards, ...this.pendingImport];
            await chrome.storage.local.set({ fsrsCards: this.cards });
        }

        this.showToast(`Imported ${this.pendingImport.length} new cards.`, 'success');
        this.cancelImport();
        this.populateFilters(); // Refresh filters
    }

    cancelImport() {
        this.pendingImport = null;
        document.getElementById('import-preview').style.display = 'none';
        document.getElementById('import-file').value = '';
    }

    showToast(msg, type = 'success') {
        const toast = document.getElementById('status-toast');
        toast.textContent = msg;
        toast.style.borderColor = type === 'error' ? 'var(--danger)' : 'var(--success)';
        toast.style.color = type === 'error' ? 'var(--danger)' : 'var(--success)';
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3000);
    }
}

new DataManager();
