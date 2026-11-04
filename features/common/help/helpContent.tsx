/**
 * @file features/common/help/helpContent.tsx (Preact)
 * @description Educational documentation content panels for the AlgoRecall Help Center SPA.
 */

import { h, JSX } from 'preact';
import { BROWSER_CONFIG } from '@common/browserConfig';

export function OverviewTabContent(): JSX.Element {
    return (
        <div id="tab-overview" className="tab-pane active" role="tabpanel">
            <div className="card card-hero">
                <h2>🎯 Master Problem Patterns, Not Individual Solutions</h2>
                <p>
                    Coding platforms like LeetCode and AlgoMonster have thousands of problems. Memorizing code line-by-line fails in interviews.
                    <strong>AlgoRecall</strong> uses the scientific <strong>Free Spaced Repetition Scheduler (FSRS)</strong> to model your personal memory retention decay curve. It calculates exactly when you should re-solve patterns to <strong>dramatically reduce study time (saving 20–30%+ review time)</strong> while maximizing long-term retention.
                </p>
            </div>

            <div className="card card-accent" style={{ marginBottom: '20px' }}>
                <h3>💡 How to Best Utilize This Extension for Maximum Results</h3>
                <div className="strategy-steps-grid">
                    <div className="strategy-card">
                        <span className="strategy-badge">Step 1</span>
                        <h4>Focus on Patterns</h4>
                        <p>When solving a problem (e.g. <em>Two Pointers, Sliding Window, DP</em>), don't just write code. Identify the core underlying pattern and write a 2-line summary note.</p>
                    </div>
                    <div className="strategy-card">
                        <span className="strategy-badge">Step 2</span>
                        <h4>Log Immediately</h4>
                        <p>Click the floating brain widget on the bottom-right of the coding page. Add tags (e.g. <code>Arrays</code>, <code>Medium</code>), type your approach note, and submit your initial rating.</p>
                    </div>
                    <div className="strategy-card">
                        <span className="strategy-badge">Step 3</span>
                        <h4>15-Min Daily Habit</h4>
                        <p>Open the extension popup daily to clear your <strong>"Due Today"</strong> review queue. Aim for <strong>Inbox Zero</strong> to maintain peak memory stability.</p>
                    </div>
                    <div className="strategy-card">
                        <span className="strategy-badge">Step 4</span>
                        <h4>Simulate & Forecast</h4>
                        <p>Use <strong>Exam Readiness Forecast</strong> before interviews to check expected recall per topic, and <strong>Future Memory Simulation</strong> to inspect decay curves.</p>
                    </div>
                </div>
            </div>

            <div className="grid-2">
                <div className="card">
                    <h3>🔑 Supported Platforms & Custom Whitelisting</h3>
                    <p className="mb-2">AlgoRecall out-of-the-box auto-detects problem titles, tags, and page contexts across top coding sites:</p>
                    <div className="platform-chips mb-2">
                        <span className="platform-tag">LeetCode</span>
                        <span className="platform-tag">AlgoMonster</span>
                        <span className="platform-tag">Codeforces</span>
                        <span className="platform-tag">NeetCode</span>
                        <span className="platform-tag">GeeksforGeeks</span>
                        <span className="platform-tag">HackerRank</span>
                        <span className="platform-tag">LintCode</span>
                    </div>
                    <div className="card card-accent" style={{ marginTop: '10px', padding: '12px' }}>
                        <strong style={{ color: 'var(--md-primary)', fontSize: '12.5px' }}>🌐 Custom Website Whitelisting:</strong>
                        <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--md-text-med)' }}>
                            Want to track problems or notes on any custom coding platform, documentation, or blog?
                            Simply add the URL or domain under <strong>Website Whitelist Settings</strong> in the extension popup dashboard.
                            AlgoRecall will immediately start injecting the floating brain logger, text highlighter, and review widgets on your custom whitelisted pages!
                        </p>
                    </div>
                </div>

                <div className="card">
                    <h3>🤖 Floating Brain Widget How-To</h3>
                    <ul className="help-bullet-list">
                        <li><strong>Position:</strong> Appears in the bottom-right corner on supported coding pages.</li>
                        <li><strong>Click to Log:</strong> Opens the quick logger panel without leaving your coding environment.</li>
                        <li><strong>Auto-Fill:</strong> Title and platform tags are auto-detected instantly.</li>
                        <li><strong>Save Notes:</strong> Save solution approaches, time/space complexities, and key intuition.</li>
                    </ul>
                </div>
            </div>
        </div>
    );
}

export function FsrsTabContent(): JSX.Element {
    return (
        <div id="tab-fsrs" className="tab-pane" role="tabpanel">
            <div className="card">
                <h2>🧠 FSRS: Your Smart Memory Coach</h2>
                <p className="section-intro">
                    Think of <strong>FSRS (Free Spaced Repetition Scheduler)</strong> as your personal study superpower! Instead of re-solving hundreds of LeetCode or AlgoMonster problems over and over, FSRS learns how fast your brain forgets code patterns. It schedules your reviews right at the moment you're about to forget them—so you remember more with way less effort!
                </p>

                <div className="card card-accent mb-4" style={{ borderLeft: '4px solid var(--md-success)' }}>
                    <h3 style={{ color: 'var(--md-success)' }}>⚡ Study 30% Less, Remember 90% More!</h3>
                    <p style={{ margin: 0, fontSize: '13px', color: 'var(--md-text-med)' }}>
                        By skipping problems you already know well and focusing strictly on tricky ones, FSRS <strong>cuts your daily review time by 20% to 30%+</strong> compared to old-school flashcard apps. You'll master more interview patterns in significantly fewer total practice sessions!
                    </p>
                </div>

                <div className="card mb-4">
                    <h3>🌱 The 4 Stages of Your Flashcards</h3>
                    <p style={{ fontSize: '13px', color: 'var(--md-text-med)', marginBottom: '12px' }}>
                        Every coding problem you add goes on a journey through 4 simple stages:
                    </p>
                    <div className="grid-2 mb-2">
                        <div className="strategy-card">
                            <div><span className="state-badge state-badge-new">Stage 0: New</span></div>
                            <h4 style={{ marginTop: '6px' }}>🆕 Fresh Card</h4>
                            <p>A problem you just added. You haven't practiced or tested yourself on it yet.</p>
                        </div>
                        <div className="strategy-card">
                            <div><span className="state-badge state-badge-learning">Stage 1: Learning</span></div>
                            <h4 style={{ marginTop: '6px' }}>📖 Practice Mode</h4>
                            <p>You're building initial memory. The card shows up in short practice rounds (like 1 min or 10 mins) until you've got it down.</p>
                        </div>
                        <div className="strategy-card">
                            <div><span className="state-badge state-badge-review">Stage 2: Review</span></div>
                            <h4 style={{ marginTop: '6px' }}>🏆 Mastered!</h4>
                            <p>It's locked in! The card is now in long-term memory. FSRS will space out reviews (4 days, 12 days, 1 month...) to keep it fresh.</p>
                        </div>
                        <div className="strategy-card">
                            <div><span className="state-badge state-badge-relearning">Stage 3: Relearning</span></div>
                            <h4 style={{ marginTop: '6px' }}>🔄 Quick Refresher</h4>
                            <p>Forgot a mastered problem? No stress! FSRS gives you a quick refresher round until it's safely back in long-term memory.</p>
                        </div>
                    </div>
                </div>

                <div className="card mb-4">
                    <h3>🔄 How Your Ratings Change a Card's Stage</h3>
                    <p style={{ fontSize: '12.5px', color: 'var(--md-text-med)', marginBottom: '10px' }}>
                        Whenever you grade a review, FSRS automatically updates the card's stage and calculates when you should see it next:
                    </p>
                    <div className="fsrs-table-container">
                        <table className="fsrs-table">
                            <thead>
                                <tr>
                                    <th>Current Stage</th>
                                    <th>Your Button Press</th>
                                    <th>Next Stage</th>
                                    <th>What Happens Next?</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr style={{ borderTop: '2px solid var(--md-primary)' }}>
                                    <td><span className="state-badge state-badge-new">🆕 New (0)</span></td>
                                    <td><span className="rating-badge" style={{ color: 'var(--md-danger)' }}>🔴 Again</span></td>
                                    <td><span className="state-badge state-badge-learning">📖 Learning</span></td>
                                    <td>Starts practice mode! FSRS schedules a quick re-test in ~1 to 5 mins so you can try again.</td>
                                </tr>
                                <tr>
                                    <td><span className="state-badge state-badge-new">🆕 New (0)</span></td>
                                    <td><span className="rating-badge" style={{ color: 'var(--md-warning)' }}>🟡 Hard</span></td>
                                    <td><span className="state-badge state-badge-learning">📖 Learning</span></td>
                                    <td>Starts practice mode. FSRS schedules a short check-in in ~5 to 10 mins.</td>
                                </tr>
                                <tr>
                                    <td><span className="state-badge state-badge-new">🆕 New (0)</span></td>
                                    <td><span className="rating-badge" style={{ color: 'var(--md-primary)' }}>🟢 Good</span></td>
                                    <td><span className="state-badge state-badge-learning">📖 Learning</span></td>
                                    <td>Moves to the next practice step! You'll see it again in ~10 mins or tomorrow.</td>
                                </tr>
                                <tr>
                                    <td><span className="state-badge state-badge-new">🆕 New (0)</span></td>
                                    <td><span className="rating-badge" style={{ color: 'var(--md-success)' }}>🔵 Easy</span></td>
                                    <td><span className="state-badge state-badge-review">🏆 Mastered</span></td>
                                    <td>You nailed it right away! Skips practice steps and graduates straight to long-term memory (next review in 4+ days).</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}

export function HighlighterTabContent(): JSX.Element {
    return (
        <div id="tab-highlighter" className="tab-pane" role="tabpanel">
            <div className="card">
                <h2>🖍️ In-Page Text Highlighter & Snippet Manager</h2>
                <p className="section-intro">
                    Highlighting critical code blocks, edge cases, and pattern explanations directly on web pages anchors visual memory and builds your personal knowledge base.
                </p>

                <div className="grid-2">
                    <div className="card">
                        <h3>✨ How to Highlight Text</h3>
                        <ol className="help-list">
                            <li>Select any text on a whitelisted coding site or documentation page.</li>
                            <li>The floating marker menu appears above your text selection.</li>
                            <li>Click any color circle (e.g. Yellow, Green, Pink, Blue) to apply the highlight overlay.</li>
                            <li>Click the color wheel icon for a custom color picker, or click the Trash icon to clear the highlight.</li>
                            <li>All highlights are saved persistently and re-injected automatically whenever you revisit the URL!</li>
                        </ol>
                    </div>

                    <div className="card card-accent">
                        <h3>🎨 Palette Customizer & Snippet Search</h3>
                        <ul className="help-bullet-list">
                            <li><strong>Palette Presets:</strong> Switch between curated theme sets (Pastels, Sunset Glow, Neon, Dark Mode).</li>
                            <li><strong>Customize Colors:</strong> Manage hex colors and opacity levels in <em>Highlighter Settings</em>.</li>
                            <li><strong>View All Highlights:</strong> Open the global snippet manager to search, filter by domain/color, and delete snippets globally across all websites.</li>
                            <li><strong>📝 Limited Markdown Notes Support:</strong> When typing solution approach notes in the logger or review sessions, basic Markdown formatting is supported (e.g., <code>**bold**</code>, <code>*italic*</code>, <code>`inline code`</code>, and bullet lists).</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}

export function AnalyticsTabContent(): JSX.Element {
    return (
        <div id="tab-analytics" className="tab-pane" role="tabpanel">
            <div className="card">
                <h2>📊 Comprehensive Analytics & Memory Science</h2>
                <p className="section-intro">
                    The full-tab Analytics gives deep visibility into your learning health, memory retention curves, topic mastery, and performance velocity.
                </p>

                <div className="grid-2 mb-4">
                    <div className="card">
                        <h3>1️⃣ Overview Dashboard (<code>overview</code>)</h3>
                        <p>High-level dashboard featuring total cards tracked, true retrievability %, daily goal ring, contribution activity heatmap, and review breakdown (New, Learning, Review, Relearning).</p>
                    </div>

                    <div className="card card-accent">
                        <h3>2️⃣ Exam Readiness Forecast (<code>readiness</code>)</h3>
                        <p>Input your target exam or interview date (<i>T</i> + <i>N</i> days). Algorithms calculate expected recall per subject/tag (e.g., <em>Physics 96%, DP 74%, Math 88%</em>) with status badges (<code>Ready</code>, <code>Moderate</code>, <code>At Risk</code>).</p>
                    </div>
                </div>

                <div className="grid-2 mb-4">
                    <div className="card">
                        <h3>3️⃣ Memory Retention (<code>memory</code>)</h3>
                        <p>View interactive FSRS retention decay curves grouped by Tag, Deck, or Difficulty with confidence bands. Compare actual review performance against mathematical predictions.</p>
                    </div>

                    <div className="card card-accent">
                        <h3>4️⃣ Future Memory Simulation (<code>simulation</code>)</h3>
                        <p>Predict: <strong>&ldquo;What if I stop studying?&rdquo;</strong> View predicted retention decay at Today (<i>T</i> = 0), 30d, 90d, 180d, and use the interactive range slider to inspect lost pattern counts.</p>
                    </div>
                </div>

                <div className="grid-3">
                    <div className="card">
                        <h3>5️⃣ Tag Analytics (<code>tags</code>)</h3>
                        <p>Drill down into topic mastery. View card count, average retention, stability, and difficulty for every topic tag (e.g., <em>Arrays, Graphs, Trees</em>).</p>
                    </div>
                    <div className="card">
                        <h3>6️⃣ Performance & Speed (<code>performance</code>)</h3>
                        <p>Analyze review velocity (seconds/card), lapse recovery rate, and hourly time-of-day peak productivity heatmaps.</p>
                    </div>
                    <div className="card">
                        <h3>7️⃣ Behavioral Insights (<code>insights</code>)</h3>
                        <p>Track cognitive load, study streak consistency index, and long-term retention efficiency trends over time.</p>
                    </div>
                </div>
            </div>
        </div>
    );
}

export function GamificationTabContent(): JSX.Element {
    return (
        <div id="tab-gamification" className="tab-pane" role="tabpanel">
            <div className="card">
                <h2>🎮 Gamification & Productivity Tools</h2>
                <p className="section-intro">
                    Stay motivated and build an unbreakable daily study habit with XP level progression, contribution heatmaps, and focus tools.
                </p>

                <div className="grid-3 mb-4">
                    <div className="gamify-card">
                        <span className="gamify-icon">
                            <svg className="svg-icon" viewBox="0 0 24 24" style={{ stroke: 'var(--md-primary)', width: '26px', height: '26px' }} aria-hidden="true">
                                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                            </svg>
                        </span>
                        <h4>Level & XP Ranks</h4>
                        <p>Earn XP points for every review. Level up your rank from <strong>Apprentice</strong> &rarr; <strong>Specialist</strong> &rarr; <strong>Expert</strong> &rarr; <strong>Grandmaster</strong>.</p>
                    </div>

                    <div className="gamify-card">
                        <span className="gamify-icon">
                            <svg className="svg-icon" viewBox="0 0 24 24" style={{ stroke: 'var(--md-warning)', width: '26px', height: '26px' }} aria-hidden="true">
                                <circle cx="12" cy="12" r="10" />
                                <circle cx="12" cy="12" r="6" />
                                <circle cx="12" cy="12" r="2" />
                            </svg>
                        </span>
                        <h4>Daily Target Review Goal</h4>
                        <p>Set custom daily target goals (e.g. 10 reviews/day). Clear your due queue daily to hit your <strong>Inbox Zero</strong> streak award.</p>
                    </div>

                    <div className="gamify-card">
                        <span className="gamify-icon">
                            <svg className="svg-icon" viewBox="0 0 24 24" style={{ stroke: 'var(--md-success)', width: '26px', height: '26px' }} aria-hidden="true">
                                <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
                            </svg>
                        </span>
                        <h4>Contribution Activity Heatmap</h4>
                        <p>Audit your daily coding contributions. Active matrix blocks highlight your study streak and review volume.</p>
                    </div>
                </div>

                <div className="grid-2">
                    <div className="card card-accent">
                        <h3>⏱️ Integrated Pomodoro Focus Timer</h3>
                        <ul className="help-bullet-list">
                            <li>Access Pomodoro timer directly under <strong>Study Tools</strong> in the popup dashboard.</li>
                            <li>Standard 25-minute focus session followed by 5-minute break alerts.</li>
                            <li>Helps maintain intense focus while solving complex algorithmic patterns.</li>
                        </ul>
                    </div>

                    <div className="card">
                        <h3>🎓 Exam Mode</h3>
                        <ul className="help-bullet-list">
                            <li>Quickly launch timed review sessions focusing on your weakest or most urgent patterns.</li>
                            <li>Simulates real exam pressure to test instant recall before technical interviews.</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}

export function AdvancedTabContent({ onSwitchTab }: { onSwitchTab: (tab: string) => void }): JSX.Element {
    return (
        <div id="tab-advanced" className="tab-pane" role="tabpanel">
            <div className="card">
                <h2>⚙️ FSRS Customizer, Anki & Data Disclosures</h2>
                <p className="section-intro">
                    Advanced configuration options, custom FSRS weight parameters, bi-directional Anki synchronization, and legal licensing disclosures.
                </p>

                <div className="card card-accent mb-4">
                    <h3>🧠 Understanding FSRS Parameters (<i>w</i><sub>0</sub> &ndash; <i>w</i><sub>16</sub>)</h3>
                    <p>FSRS uses 17 coefficients to compute memory stability updates upon grading:</p>
                    <ul className="help-bullet-list" style={{ marginTop: '8px' }}>
                        <li><strong>Target Retention Slider (0.75 - 0.95):</strong> Sets desired recall probability. Higher retention (95%) yields shorter intervals; lower retention (80%) spreads reviews further apart.</li>
                        <li><strong>Initial Stability (<i>w</i><sub>0</sub> &ndash; <i>w</i><sub>3</sub>):</strong> Base interval days for <code>Again</code>, <code>Hard</code>, <code>Good</code>, <code>Easy</code> on first review.</li>
                        <li><strong>Difficulty & Stability Boosts (<i>w</i><sub>4</sub> &ndash; <i>w</i><sub>10</sub>):</strong> Rate of stability increase for correct answers.</li>
                        <li><strong>Lapses & Easy Bonuses (<i>w</i><sub>11</sub> &ndash; <i>w</i><sub>16</sub>):</strong> Recovery deceleration upon failure and easy bonuses.</li>
                    </ul>
                </div>

                <div className="grid-2 mb-4">
                    <div className="card">
                        <h3>🏷️ Tag-Specific Profiles</h3>
                        <p>Assign custom 17-coefficient weight sets to specific tags (e.g. <code>Dynamic Programming</code> or <code>Graphs</code>) to handle harder topics with customized memory parameters.</p>
                    </div>

                    <div className="card card-accent">
                        <h3>📦 Anki Integration (.txt / .tsv)</h3>
                        <ul className="help-bullet-list">
                            <li><strong>Export to Anki:</strong> Export your cards into Anki-compatible format for offline study.</li>
                            <li><strong>Import from Anki:</strong> Import Anki deck TSV/txt files directly into AlgoRecall.</li>
                        </ul>
                    </div>
                </div>

                <div className="grid-2 mb-4">
                    <div className="card">
                        <h3>💾 Backup & Restore</h3>
                        <p>Regularly export full JSON state backups from the popup dashboard under <em>Data & Options</em>. Import backups instantly to restore cards, highlights, and custom settings.</p>
                    </div>

                    <div className="card card-accent">
                        <h3>🔒 Privacy & Local-First Guarantee</h3>
                        <p>
                            AlgoRecall is 100% local-first. All data, cards, and highlights remain strictly on your machine in local storage. Zero external server tracking. For comprehensive permission justifications and data policies, explore the{' '}
                            <a
                                href="#"
                                data-switch-tab="privacy"
                                style={{ color: 'var(--md-primary)', fontWeight: 600, textDecoration: 'underline' }}
                                onClick={(e) => {
                                    e.preventDefault();
                                    onSwitchTab('privacy');
                                }}
                            >
                                Privacy & Data Policy
                            </a>{' '}
                            tab.
                        </p>
                    </div>
                </div>

                <div className="card" style={{ borderLeft: '4px solid var(--md-primary)' }}>
                    <h3>📜 Licenses & Open-Source Acknowledgments</h3>
                    <p style={{ fontSize: '13px', color: 'var(--md-text-med)', marginBottom: '8px' }}>
                        AlgoRecall is proprietary software (&copy; 2026 Anmol Rastogi / AlgoRecall. All Rights Reserved) utilizing the open-source <strong>Free Spaced Repetition Scheduler (FSRS)</strong> algorithm:
                    </p>
                    <ul style={{ fontSize: '12px', color: 'var(--md-text-low)', lineHeight: 1.8, margin: 0, paddingLeft: '18px' }}>
                        <li><strong>ts-fsrs & FSRS Algorithm</strong> &mdash; Copyright &copy; Jarrett Ye &amp; Open Spaced Repetition (MIT License)</li>
                        <li><strong>@open-spaced-repetition/binding</strong> &mdash; Copyright &copy; Open Spaced Repetition Team (MIT License)</li>
                        <li><strong>Firebase Web SDK</strong> &mdash; Copyright &copy; Google LLC (Apache License 2.0)</li>
                    </ul>
                </div>
            </div>
        </div>
    );
}

export function PrivacyTabContent(): JSX.Element {
    return (
        <div id="tab-privacy" className="tab-pane" role="tabpanel">
            <div className="card card-hero">
                <h2>🛡️ Privacy-First Architecture & Data Protection</h2>
                <p>
                    At AlgoRecall, your privacy and study data ownership are fundamental. We believe that your learning habits, coding notes, and problem review histories belong to you alone. AlgoRecall operates on a <strong>Local-First Guarantee</strong>: by default, 100% of your data remains inside your browser's private storage sandbox, with zero external server tracking, zero advertising SDKs, and zero telemetry selling.
                </p>
            </div>

            <div className="grid-3 mb-4">
                <div className="card card-accent">
                    <h3>🔒 100% Local-First by Default</h3>
                    <p style={{ fontSize: '12.5px', color: 'var(--md-text-med)', margin: 0 }}>
                        All FSRS parameters (stability, difficulty, review logs), notes, problem bookmarks, and highlights are stored strictly on your device using <code>chrome.storage.local</code>. No account is required to use all core features.
                    </p>
                </div>

                <div className="card card-accent">
                    <h3>🚫 Zero Tracking or Ad Sales</h3>
                    <p style={{ fontSize: '12.5px', color: 'var(--md-text-med)', margin: 0 }}>
                        We do not sell, rent, or monetize your data. AlgoRecall contains zero third-party tracking pixels, zero analytics scripts, and zero advertising SDKs. We do not track your browsing history across the web.
                    </p>
                </div>

                <div className="card card-accent">
                    <h3>☁️ Optional & Encrypted Cloud Sync</h3>
                    <p style={{ fontSize: '12.5px', color: 'var(--md-text-med)', margin: 0 }}>
                        For users who opt into the Pro tier, Google OAuth via Firebase Authentication securely verifies identity, and study progress is backed up to Google Cloud Firestore with end-to-end TLS encryption.
                    </p>
                </div>
            </div>

            <div className="card">
                <h3>🔑 Permissions Transparency & Justifications</h3>
                <p className="section-intro">
                    In accordance with <span id="help-store-policy-name">{BROWSER_CONFIG.storeName} ({BROWSER_CONFIG.displayName})</span> minimal permissions policies, AlgoRecall requests only the exact browser permissions necessary to provide its spaced repetition and highlighting features:
                </p>

                <div className="fsrs-table-container">
                    <table className="fsrs-table">
                        <thead>
                            <tr>
                                <th>Permission</th>
                                <th>Category</th>
                                <th>Why It's Needed & How It's Used</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td><code>storage</code></td>
                                <td><span className="state-badge state-badge-review">Local Data</span></td>
                                <td>Saves your FSRS ratings, review timestamps, card stability, custom tag weights, highlighter colors, and settings locally in the browser sandbox.</td>
                            </tr>
                            <tr>
                                <td><code>activeTab</code> / <code>tabs</code></td>
                                <td><span className="state-badge state-badge-new">Context</span></td>
                                <td>Inspects the active tab's URL to identify supported coding platforms (e.g. AlgoMonster, LeetCode) and display relevant study status widgets.</td>
                            </tr>
                            <tr>
                                <td><code>alarms</code></td>
                                <td><span className="state-badge state-badge-learning">Scheduler</span></td>
                                <td>Runs periodic, battery-friendly background checks to calculate when reviews become due without constantly running CPU cycles.</td>
                            </tr>
                            <tr>
                                <td><code>notifications</code></td>
                                <td><span className="state-badge state-badge-learning">User Alert</span></td>
                                <td>Displays native desktop notifications when your spaced repetition flashcards fall due (can be disabled at any time in Settings).</td>
                            </tr>
                            <tr>
                                <td><code>downloads</code></td>
                                <td><span className="state-badge state-badge-review">Export</span></td>
                                <td>Allows you to save manual and automated JSON backup archives and Anki decks directly to your local file system.</td>
                            </tr>
                            <tr>
                                <td><code>webNavigation</code></td>
                                <td><span className="state-badge state-badge-new">SPA Routing</span></td>
                                <td>Detects in-page single-page application (SPA) client-side URL changes on coding sites to automatically update problem widgets without full page refreshes.</td>
                            </tr>
                            <tr>
                                <td><code>scripting</code></td>
                                <td><span className="state-badge state-badge-new">In-Page UI</span></td>
                                <td>Injects the floating review logger and CSS highlight overlays exclusively on supported or user-whitelisted coding domains.</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="grid-2 mb-4">
                <div className="card">
                    <h3>📦 Complete Data Ownership & Portability</h3>
                    <p style={{ fontSize: '13px', color: 'var(--md-text-med)', marginBottom: '12px' }}>
                        You never risk vendor lock-in. You retain 100% ownership of your data and can export it anytime:
                    </p>
                    <ul className="help-bullet-list">
                        <li><strong>JSON State Export:</strong> Download your entire database (cards, reviews, notes, tags, settings) in structured JSON format with FNV-1a checksum validation.</li>
                        <li><strong>Anki Compatibility:</strong> Seamlessly export your flashcards into Anki-compatible format or import existing Anki decks.</li>
                        <li><strong>Offline Accessibility:</strong> The extension continues to function completely offline without internet connectivity.</li>
                    </ul>
                </div>

                <div className="card">
                    <h3>🗑️ GDPR, Data Deletion & Privacy Rights</h3>
                    <p style={{ fontSize: '13px', color: 'var(--md-text-med)', marginBottom: '12px' }}>
                        We fully respect user privacy rights under GDPR, CCPA, and global data privacy standards:
                    </p>
                    <ul className="help-bullet-list">
                        <li><strong>One-Click Complete Wipe:</strong> Clear all cards, review histories, highlights, and cached settings immediately under <em>Data & Options</em>.</li>
                        <li><strong>Zero Residual Cloud Storage:</strong> When uninstalling the extension (for free users), all local data is immediately deleted by your browser.</li>
                        <li><strong>Cloud Account Deletion:</strong> Pro users can request account and Firestore data deletion at any time by contacting developer support.</li>
                    </ul>
                </div>
            </div>

            <div className="card card-accent" style={{ borderLeft: '4px solid var(--md-primary)' }}>
                <h3 id="help-data-certification-title">📜 {BROWSER_CONFIG.storeName} Data Use Certification</h3>
                <div style={{ fontSize: '13px', color: 'var(--md-text-med)', lineHeight: 1.8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                        <span style={{ color: 'var(--md-success, #2ecc71)', fontWeight: 'bold' }}>✔</span>
                        <span><strong>No Third-Party Sale:</strong> User data is never sold, leased, or traded to data brokers or third parties.</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                        <span style={{ color: 'var(--md-success, #2ecc71)', fontWeight: 'bold' }}>✔</span>
                        <span><strong>No Unrelated Usage:</strong> Data is strictly used to provide spaced repetition scheduling and note-taking features.</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                        <span style={{ color: 'var(--md-success, #2ecc71)', fontWeight: 'bold' }}>✔</span>
                        <span><strong>No Creditworthiness Assessment:</strong> Data is never used for lending, insurance, or credit assessments.</span>
                    </div>
                </div>
                <div className="callout-box" style={{ marginTop: '12px', marginBottom: 0 }}>
                    <h4>📬 Privacy Questions & Support Contact</h4>
                    <p>
                        For inquiries regarding this Privacy Policy, your data rights, or custom enterprise compliance, please reach out to our team at{' '}
                        <strong>developer-support@algomonster-fsrs.example.com</strong>.
                    </p>
                </div>
            </div>
        </div>
    );
}

