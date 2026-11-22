/**
 * @file domHostHelper.ts
 * @description Simulates host SPA DOM structures (LeetCode Next.js, AlgoMonster),
 * Monaco editor mutations, route transitions, and popstate navigation.
 */

export interface HostSpaContext {
    hostApp: HTMLElement;
    editorContainer: HTMLElement;
    viewLines: HTMLElement;
    titleElement: HTMLElement;
    cleanup: () => void;
}

/**
 * Prepares the mock host Single Page Application DOM hierarchy.
 */
export function setupMockHostSpa(options: { title?: string; url?: string } = {}): HostSpaContext {
    const title = options.title || 'Two Sum - LeetCode';
    const url = options.url || '/problems/two-sum/';

    // Set initial window location
    window.history.replaceState({}, title, url);
    document.title = title;

    document.body.innerHTML = `
        <div id="__next">
            <div id="app">
                <div class="content-wrapper">
                    <h1 id="problem-title">${title}</h1>
                    <div class="question-content">
                        <p>Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.</p>
                    </div>
                    <div class="monaco-editor" role="code">
                        <div class="view-lines" role="presentation">
                            <div class="view-line"><span>class Solution {</span></div>
                            <div class="view-line"><span>    public int[] twoSum(int[] nums, int target) {</span></div>
                            <div class="view-line"><span>    }</span></div>
                            <div class="view-line"><span>}</span></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    const hostApp = document.getElementById('app')!;
    const editorContainer = document.querySelector('.monaco-editor') as HTMLElement;
    const viewLines = document.querySelector('.view-lines') as HTMLElement;
    const titleElement = document.getElementById('problem-title')!;

    const cleanup = () => {
        document.body.innerHTML = '';
        delete (document.body as any).__k;
    };

    return {
        hostApp,
        editorContainer,
        viewLines,
        titleElement,
        cleanup
    };
}

/**
 * Simulates a client-side SPA route transition (e.g. Next.js router.push).
 */
export function simulateSpaNavigation(newTitle: string, newUrl: string, wipeBody: boolean = false): void {
    window.history.pushState({}, newTitle, newUrl);
    document.title = newTitle;

    const titleEl = document.getElementById('problem-title');
    if (titleEl) {
        titleEl.textContent = newTitle;
    }

    if (wipeBody) {
        // Detach existing content including any dynamically attached hosts
        const trackerHost = document.getElementById('algo-tracker-host');
        if (trackerHost) {
            trackerHost.remove();
        }
        const app = document.getElementById('app');
        if (app) {
            app.innerHTML = `
                <div class="content-wrapper">
                    <h1 id="problem-title">${newTitle}</h1>
                    <div class="question-content"><p>Description for ${newTitle}</p></div>
                </div>
            `;
        }
    }

    // Fire route change signals
    window.dispatchEvent(new CustomEvent('algo_spa_navigation', { detail: { url: newUrl } }));
}

/**
 * Simulates rapid code typing in the Monaco editor.
 */
export function simulateMonacoTyping(charCount: number = 5): void {
    const viewLines = document.querySelector('.monaco-editor .view-lines');
    if (!viewLines) return;

    for (let i = 0; i < charCount; i++) {
        const span = document.createElement('span');
        span.textContent = `x_${i}`;
        const line = document.createElement('div');
        line.className = 'view-line';
        line.appendChild(span);
        viewLines.appendChild(line);
    }
}

/**
 * Simulates a browser popstate navigation event (Back / Forward).
 */
export function simulatePopstate(newUrl: string): void {
    window.history.pushState({}, '', newUrl);
    const event = new PopStateEvent('popstate', { state: null });
    window.dispatchEvent(event);
}
