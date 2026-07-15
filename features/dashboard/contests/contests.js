/**
 * @file features/dashboard/contests/contests.js
 * @description R5.1: Contest calendar integration + R5.3: Virtual contest batch import.
 * Fetches upcoming contests from Codeforces API and shows hardcoded schedules for 
 * LeetCode and AtCoder. Supports batch-importing contest problems as FSRS cards.
 */

class ContestCalendar {
    constructor() {
        this.contests = [];
        this.activePlatform = 'all';
        this.countdownInterval = null;
        this.init();
    }

    async init() {
        this.bindTabs();
        this.bindFilters();
        this.bindImport();
        await this.loadContests();
        this.startCountdownUpdates();
    }

    bindTabs() {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                btn.classList.add('active');
                document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
            });
        });
    }

    bindFilters() {
        document.querySelectorAll('.platform-filter').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.platform-filter').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.activePlatform = btn.dataset.platform;
                this.renderContests();
            });
        });

        document.getElementById('refresh-btn').addEventListener('click', () => this.loadContests());
    }

    // ========================================================================
    // R5.1: Contest Calendar
    // ========================================================================

    async loadContests() {
        const listEl = document.getElementById('contest-list');
        listEl.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Loading contests…</p></div>';

        try {
            const cfContests = await this.fetchCodeforcesContests();
            const lcContests = this.getLeetCodeSchedule();
            const acContests = this.getAtCoderSchedule();

            this.contests = [...cfContests, ...lcContests, ...acContests]
                .sort((a, b) => a.startTime - b.startTime);

            this.renderContests();
        } catch (err) {
            console.error('Error loading contests:', err);
            listEl.innerHTML = `<div class="error-state"><p>Failed to load contests. <button onclick="location.reload()" style="color:inherit;text-decoration:underline;background:none;border:none;cursor:pointer;">Retry</button></p></div>`;
        }
    }

    async fetchCodeforcesContests() {
        try {
            const resp = await fetch('https://codeforces.com/api/contest.list');
            const data = await resp.json();
            if (data.status !== 'OK') return [];

            const now = Date.now() / 1000;
            return data.result
                .filter(c => c.phase === 'BEFORE' || (c.phase === 'CODING' && c.relativeTimeSeconds < c.durationSeconds))
                .slice(0, 15)
                .map(c => ({
                    name: c.name,
                    platform: 'codeforces',
                    startTime: c.startTimeSeconds * 1000,
                    duration: c.durationSeconds,
                    url: `https://codeforces.com/contest/${c.id}`,
                    phase: c.phase === 'CODING' ? 'live' : 'upcoming'
                }));
        } catch (e) {
            console.warn('Codeforces API unavailable:', e);
            return [];
        }
    }

    getLeetCodeSchedule() {
        // LeetCode has weekly contests (Sunday 10:30 AM IST / 5:00 UTC) and biweekly
        const contests = [];
        const now = new Date();

        for (let i = 0; i < 6; i++) {
            const d = new Date(now);
            d.setDate(d.getDate() + ((7 - d.getDay()) % 7) + (i * 7));
            d.setUTCHours(2, 30, 0, 0); // Weekly Sunday ~2:30 UTC

            if (d.getTime() > now.getTime()) {
                const weekNum = Math.ceil((d.getDate()) / 7);
                const contestNum = 400 + Math.floor((d.getTime() - new Date('2024-01-07').getTime()) / (7 * 24 * 60 * 60 * 1000));

                contests.push({
                    name: `LeetCode Weekly Contest ${contestNum}`,
                    platform: 'leetcode',
                    startTime: d.getTime(),
                    duration: 5400, // 1.5 hours
                    url: 'https://leetcode.com/contest/',
                    phase: 'upcoming'
                });

                // Biweekly every other Saturday
                if (i % 2 === 0) {
                    const bw = new Date(d);
                    bw.setDate(bw.getDate() - 1); // Saturday
                    bw.setUTCHours(14, 30, 0, 0);
                    if (bw.getTime() > now.getTime()) {
                        contests.push({
                            name: `LeetCode Biweekly Contest ${Math.floor(contestNum / 2) + 100}`,
                            platform: 'leetcode',
                            startTime: bw.getTime(),
                            duration: 5400,
                            url: 'https://leetcode.com/contest/',
                            phase: 'upcoming'
                        });
                    }
                }
            }
        }

        return contests.slice(0, 6);
    }

    getAtCoderSchedule() {
        // AtCoder Beginner Contests typically run Saturday 21:00 JST (12:00 UTC)
        const contests = [];
        const now = new Date();

        for (let i = 0; i < 6; i++) {
            const d = new Date(now);
            const daysToSaturday = (6 - d.getDay() + 7) % 7;
            d.setDate(d.getDate() + daysToSaturday + (i * 7));
            d.setUTCHours(12, 0, 0, 0);

            if (d.getTime() > now.getTime()) {
                contests.push({
                    name: `AtCoder Beginner Contest ${350 + i}`,
                    platform: 'atcoder',
                    startTime: d.getTime(),
                    duration: 6000, // ~100 min
                    url: 'https://atcoder.jp/contests/',
                    phase: 'upcoming'
                });
            }
        }

        return contests.slice(0, 4);
    }

    renderContests() {
        const listEl = document.getElementById('contest-list');
        const now = Date.now();

        let filtered = this.contests;
        if (this.activePlatform !== 'all') {
            filtered = filtered.filter(c => c.platform === this.activePlatform);
        }

        // Show upcoming contests (future + currently running)
        filtered = filtered.filter(c => c.startTime + (c.duration * 1000) > now);

        if (filtered.length === 0) {
            listEl.innerHTML = '<div class="empty-state"><p>No upcoming contests found for this platform.</p></div>';
            return;
        }

        listEl.innerHTML = filtered.map(c => {
            const startDate = new Date(c.startTime);
            const dateStr = startDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
            const timeStr = startDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
            const durationStr = this.formatDuration(c.duration);
            const countdown = this.getCountdownStr(c);
            const isLive = c.phase === 'live' || (now >= c.startTime && now < c.startTime + c.duration * 1000);

            // Google Calendar link
            const calStart = startDate.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
            const calEnd = new Date(c.startTime + c.duration * 1000).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
            const calUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(c.name)}&dates=${calStart}/${calEnd}&details=${encodeURIComponent(c.url)}`;

            return `
                <div class="contest-card" data-start="${c.startTime}" data-duration="${c.duration}">
                    <span class="contest-platform-badge ${c.platform}">${c.platform}</span>
                    <div class="contest-info">
                        <div class="contest-name"><a href="${c.url}" target="_blank">${c.name}</a></div>
                        <div class="contest-meta">
                            <span>📅 ${dateStr}</span>
                            <span>⏰ ${timeStr}</span>
                            <span>⏱ ${durationStr}</span>
                            <span><a href="${calUrl}" target="_blank" style="color:var(--primary);text-decoration:none;font-size:11px;">+ Calendar</a></span>
                        </div>
                    </div>
                    <div class="contest-countdown ${isLive ? 'live' : ''}">${isLive ? '🔴 LIVE' : countdown}</div>
                </div>
            `;
        }).join('');
    }

    formatDuration(seconds) {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        return h > 0 ? `${h}h ${m}m` : `${m}m`;
    }

    getCountdownStr(contest) {
        const now = Date.now();
        const diff = contest.startTime - now;
        if (diff <= 0) return 'Started';

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

        if (days > 0) return `in ${days}d ${hours}h`;
        if (hours > 0) return `in ${hours}h ${minutes}m`;
        return `in ${minutes}m`;
    }

    startCountdownUpdates() {
        this.countdownInterval = setInterval(() => {
            document.querySelectorAll('.contest-card').forEach(card => {
                const start = parseInt(card.dataset.start);
                const duration = parseInt(card.dataset.duration);
                const now = Date.now();
                const isLive = now >= start && now < start + duration * 1000;
                const countdownEl = card.querySelector('.contest-countdown');

                if (isLive) {
                    countdownEl.textContent = '🔴 LIVE';
                    countdownEl.classList.add('live');
                } else if (start > now) {
                    countdownEl.textContent = this.getCountdownStr({ startTime: start });
                    countdownEl.classList.remove('live');
                } else {
                    countdownEl.textContent = 'Ended';
                    countdownEl.classList.add('past');
                }
            });
        }, 30000); // Update every 30 seconds
    }

    // ========================================================================
    // R5.3: Virtual Contest Batch Import
    // ========================================================================

    bindImport() {
        document.getElementById('import-btn').addEventListener('click', () => this.handleImport());
    }

    async handleImport() {
        const urlsText = document.getElementById('import-urls').value.trim();
        const tagsText = document.getElementById('import-tags').value.trim();
        const difficulty = document.getElementById('import-difficulty').value;
        const statusEl = document.getElementById('import-status');

        if (!urlsText) {
            statusEl.textContent = 'Please enter URLs.';
            statusEl.className = 'import-status error';
            return;
        }

        const urls = urlsText.split('\n').map(u => u.trim()).filter(u => u.startsWith('http'));
        
        if (urls.length === 0) {
            statusEl.textContent = 'No valid URLs found.';
            statusEl.className = 'import-status error';
            return;
        }

        // Check if the first URL is a Codeforces contest page → expand it
        let problemUrls = [];
        if (urls.length === 1 && urls[0].match(/codeforces\.com\/contest\/\d+$/)) {
            statusEl.textContent = 'Fetching contest problems…';
            statusEl.className = 'import-status';
            try {
                problemUrls = await this.expandCodeforcesContest(urls[0]);
            } catch (e) {
                statusEl.textContent = 'Failed to fetch contest. Enter problem URLs manually.';
                statusEl.className = 'import-status error';
                return;
            }
        } else {
            problemUrls = urls;
        }

        // Load existing cards to avoid duplicates
        const result = await chrome.storage.local.get(['fsrsCards']);
        const existingCards = result.fsrsCards || [];
        const existingUrls = new Set(existingCards.map(c => c.problemUrl.split('?')[0].split('#')[0]));

        const tags = tagsText ? tagsText.split(',').map(t => t.trim()).filter(t => t) : ['contest'];
        let imported = 0;
        let skipped = 0;

        const newCards = [];
        for (const url of problemUrls) {
            const cleanUrl = url.split('?')[0].split('#')[0];
            if (existingUrls.has(cleanUrl)) {
                skipped++;
                continue;
            }

            const title = this.extractTitleFromUrl(url);
            const now = Date.now();
            const card = {
                id: (now + imported).toString(),
                problemTitle: title,
                problemUrl: cleanUrl,
                textRead: '',
                approach: '',
                tags: [...tags],
                due: now,
                stability: 0,
                difficulty: 0,
                elapsed_days: 0,
                scheduled_days: 0,
                reps: 0,
                lapses: 0,
                state: 0,
                historyLog: [now],
                timeComplexity: '',
                spaceComplexity: '',
                problemDifficulty: difficulty || '',
                lastRating: 0
            };

            newCards.push(card);
            imported++;
        }

        if (newCards.length > 0) {
            const allCards = [...existingCards, ...newCards];
            await chrome.storage.local.set({ fsrsCards: allCards });
        }

        statusEl.textContent = `✓ Imported ${imported} card(s)${skipped > 0 ? `, ${skipped} skipped (duplicates)` : ''}`;
        statusEl.className = 'import-status success';

        // Show preview
        if (newCards.length > 0) {
            const previewEl = document.getElementById('import-preview');
            const previewList = document.getElementById('import-preview-list');
            previewEl.style.display = 'block';
            previewList.innerHTML = newCards.map(c => `
                <div class="preview-card">
                    <span class="preview-title">${c.problemTitle}</span>
                    <span class="preview-url">${c.problemUrl}</span>
                </div>
            `).join('');
        }
    }

    async expandCodeforcesContest(contestUrl) {
        const match = contestUrl.match(/contest\/(\d+)/);
        if (!match) return [];

        const contestId = match[1];
        const resp = await fetch(`https://codeforces.com/api/contest.standings?contestId=${contestId}&from=1&count=1`);
        const data = await resp.json();

        if (data.status !== 'OK' || !data.result?.problems) return [];

        return data.result.problems.map(p => 
            `https://codeforces.com/contest/${contestId}/problem/${p.index}`
        );
    }

    extractTitleFromUrl(url) {
        try {
            const u = new URL(url);
            if (url.includes('leetcode.com')) {
                const parts = u.pathname.split('/').filter(Boolean);
                const slug = parts.find(p => p !== 'problems') || parts[parts.length - 1];
                return slug ? slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'LeetCode Problem';
            }
            if (url.includes('codeforces.com')) {
                const parts = u.pathname.split('/').filter(Boolean);
                const contestId = parts[1];
                const problemIndex = parts[3] || '';
                return `CF ${contestId}${problemIndex}`;
            }
            if (url.includes('atcoder.jp')) {
                const parts = u.pathname.split('/').filter(Boolean);
                return parts[parts.length - 1]?.replace(/_/g, ' ').toUpperCase() || 'AtCoder Problem';
            }
            // Generic
            return u.pathname.split('/').filter(Boolean).pop()?.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'Problem';
        } catch {
            return 'Problem';
        }
    }
}

new ContestCalendar();
