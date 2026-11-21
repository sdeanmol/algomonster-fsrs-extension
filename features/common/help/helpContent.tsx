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

                <div className="card" style={{ marginTop: '24px', borderLeft: '4px solid var(--md-primary)' }}>
                    <h2>🧭 Extension Popup & Daily Controls: Complete Guide</h2>
                    <p className="section-intro">
                        The AlgoRecall popup is your daily command center. Whenever you click the extension icon in your
                        browser toolbar, you get an immediate overview of your review queue, memory health, study
                        streak, quick search, and configuration settings.
                    </p>

                    {/* Quick Jump Links */}
                    <div className="callout-box"
                        style={{ marginBottom: '20px', background: 'rgba(168, 199, 250, 0.08)', borderLeftColor: 'var(--md-primary)' }}>
                        <strong style={{ color: 'var(--md-primary)', fontSize: '13px' }}>⚡ Quick Navigation to Popup
                            Sections:</strong>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
                            <a href="#popup-header" className="platform-tag"
                                style={{ textDecoration: 'none', color: 'inherit' }}>Header &amp; Level</a>
                            <a href="#popup-stats" className="platform-tag"
                                style={{ textDecoration: 'none', color: 'inherit' }}>Hero Stats &amp; Drill-Downs</a>
                            <a href="#popup-search" className="platform-tag"
                                style={{ textDecoration: 'none', color: 'inherit' }}>Quick Search &amp; Tags</a>
                            <a href="#popup-heatmap" className="platform-tag"
                                style={{ textDecoration: 'none', color: 'inherit' }}>Activity Heatmap</a>
                            <a href="#popup-tools" className="platform-tag"
                                style={{ textDecoration: 'none', color: 'inherit' }}>Study Tools</a>
                            <a href="#popup-highlighter" className="platform-tag"
                                style={{ textDecoration: 'none', color: 'inherit' }}>Highlighter Settings</a>
                            <a href="#popup-notifications" className="platform-tag"
                                style={{ textDecoration: 'none', color: 'inherit' }}>Notifications &amp; Quiet Hours</a>
                            <a href="#popup-options" className="platform-tag"
                                style={{ textDecoration: 'none', color: 'inherit' }}>Data &amp; Advanced Options</a>
                            <a href="#popup-feedback" className="platform-tag"
                                style={{ textDecoration: 'none', color: 'inherit' }}>Rating &amp; Feedback</a>
                        </div>
                    </div>

                    {/* 1. Header & Level Progress */}
                    <div id="popup-header" className="card card-accent mb-4">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                            <span style={{ fontSize: '20px' }}>🏆</span>
                            <h3 style={{ margin: '0' }}>1. Header, Level Badge &amp; XP Progress Bar</h3>
                        </div>
                        <p style={{ fontSize: '13px', color: 'var(--md-text-med)', marginBottom: '12px' }}>
                            The top of the popup shows your current rank, XP leveling bar, and primary global controls:
                        </p>
                        <ul className="help-bullet-list">
                            <li><strong>Level Badge (e.g. <code>Lv. 1</code>, <code>Lv. 5</code>):</strong> Shows your
                                gamification tier (Apprentice → Specialist → Expert → Grandmaster). Every
                                card review adds XP points to your profile.</li>
                            <li><strong>XP Progress Bar:</strong> The thin animated bar below the header fills up as you
                                complete reviews. Once it hits 100%, you level up, and a burst of confetti celebrates
                                your achievement!</li>
                            <li><strong>Analytics Dashboard Button (Bar Chart Icon):</strong> Opens the full-page
                                Analytics suite in a new tab for in-depth memory graphs,
                                tag breakdowns, and velocity metrics.</li>
                            <li><strong>Theme Switcher (Sun / Moon Icon):</strong> Toggles between clean Light Mode and
                                eye-friendly Dark Mode. Your choice is instantly synced across all extension pages.</li>
                            <li><strong>Help Guide Button (? Icon):</strong> Immediately opens this comprehensive Help
                                Center.</li>
                        </ul>
                    </div>

                    {/* 2. Hero Stat Boxes (Interactive Drill-Downs) */}
                    <div id="popup-stats" className="card mb-4">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                            <span style={{ fontSize: '20px' }}>📊</span>
                            <h3 style={{ margin: '0', color: 'var(--md-primary)' }}>2. Hero Stat Boxes &amp; Interactive
                                Drill-Downs</h3>
                        </div>
                        <p style={{ fontSize: '13px', color: 'var(--md-text-med)', marginBottom: '12px' }}>
                            The 3 hero metric boxes at the top of the popup give you an immediate snapshot of your study
                            state. <strong>Each box is an interactive button</strong> that opens a pre-filtered view of
                            your cards:
                        </p>
                        <div className="grid-3 mb-3">
                            <div className="card" style={{ padding: '12px', borderTop: '3px solid var(--md-primary)' }}>
                                <h4 style={{ margin: '0 0 6px 0', fontSize: '14px' }}>📦 Total Patterns</h4>
                                <p style={{ fontSize: '12px', color: 'var(--md-text-med)', marginBottom: '8px' }}>Displays the
                                    total number of unique algorithmic problems and patterns you have saved.</p>
                                <p style={{ fontSize: '11.5px', color: 'var(--md-text-low)', margin: '0' }}><strong>Click
                                        action:</strong> Opens the Card Explorer (<code>data.html</code>) showing all
                                    saved cards for searching, editing, or exporting.</p>
                            </div>
                            <div className="card" style={{ padding: '12px', borderTop: '3px solid var(--md-warning)' }}>
                                <h4 style={{ margin: '0 0 6px 0', fontSize: '14px' }}>⏰ Due Today</h4>
                                <p style={{ fontSize: '12px', color: 'var(--md-text-med)', marginBottom: '8px' }}>Displays the
                                    number of cards ready for recall check-in right now.</p>
                                <p style={{ fontSize: '11.5px', color: 'var(--md-text-low)', margin: '0' }}><strong>Color
                                        status:</strong> 🟢 Green = 0 due (Inbox Zero!); 🟡 Yellow = 1–10 due; 🔴 Red =
                                    &gt;10 due (Urgent reviews pending). <strong>Click action:</strong> Opens
                                    <code>data.html?filter=due</code>.
                                </p>
                            </div>
                            <div className="card" style={{ padding: '12px', borderTop: '3px solid var(--md-success)' }}>
                                <h4 style={{ margin: '0 0 6px 0', fontSize: '14px' }}>🧠 Memory Retention</h4>
                                <p style={{ fontSize: '12px', color: 'var(--md-text-med)', marginBottom: '8px' }}>Calculates
                                    your live memory retrievability rate across all cards using the AlgoRecall Engine
                                    formula.</p>
                                <p style={{ fontSize: '11.5px', color: 'var(--md-text-low)', margin: '0' }}>
                                    <strong>Target:</strong> Aim for &ge; 85–90%. <strong>Click action:</strong> Opens
                                    lapsed/at-risk cards (<code>data.html?filter=lapsed</code>) so you can strengthen
                                    weak patterns.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* 3. Quick Pattern Search & Tag Filtering */}
                    <div id="popup-search" className="card card-accent mb-4">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                            <span style={{ fontSize: '20px' }}>🔍</span>
                            <h3 style={{ margin: '0' }}>3. Quick Pattern Search &amp; Topic Tag Filtering</h3>
                        </div>
                        <p style={{ fontSize: '13px', color: 'var(--md-text-med)', marginBottom: '12px' }}>
                            Need to quickly look up a problem or check when you last reviewed a pattern without leaving
                            your current tab? Use the built-in quick search inside the popup:
                        </p>
                        <ul className="help-bullet-list">
                            <li><strong>Real-Time Search:</strong> Type any keyword in the <em>Search
                                    patterns...</em> box. AlgoRecall instantly searches problem titles, problem URLs,
                                your personal approach notes, and topic tags.</li>
                            <li><strong>Tag Filter Dropdown:</strong> Automatically populated with all tags from your
                                cards (e.g. <code>Dynamic Programming</code>, <code>Binary Search</code>,
                                <code>Graphs</code>). Select a tag to narrow down search results to a specific topic.
                            </li>
                            <li><strong>Due vs Safe Status Pills:</strong> Results show a color-coded status badge:
                                <ul style={{ marginTop: '4px' }}>
                                    <li><span className="state-badge state-badge-learning"
                                            style={{ fontSize: '11px' }}>Due</span> (Red pill): This card is currently due
                                        or overdue for review.</li>
                                    <li><span className="state-badge state-badge-review"
                                            style={{ fontSize: '11px' }}>Safe</span> (Green pill): This card is firmly in
                                        your memory buffer and not due yet.</li>
                                </ul>
                            </li>
                            <li><strong>One-Click Problem Navigation:</strong> Clicking any result title opens the
                                problem page directly on LeetCode, AlgoMonster, or your saved URL so you can jump
                                straight to solving it.</li>
                        </ul>
                    </div>

                    {/* 4. Activity Heatmap & Quick Action Chips */}
                    <div id="popup-heatmap" className="card mb-4">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                            <span style={{ fontSize: '20px' }}>🔥</span>
                            <h3 style={{ margin: '0', color: 'var(--md-primary)' }}>4. Activity Heatmap &amp; Quick Action
                                Chips</h3>
                        </div>
                        <p style={{ fontSize: '13px', color: 'var(--md-text-med)', marginBottom: '12px' }}>
                            Build an unbreakable study habit with visual progress tracking:
                        </p>
                        <ul className="help-bullet-list">
                            <li><strong>Daily Streak Counter:</strong> Displays your active consecutive days of reviews
                                alongside a motivational message. Missing reviews causes the streak to pause or reset.
                            </li>
                            <li><strong>Contribution Heatmap Matrix:</strong> Displays a 365-day grid modeled after
                                GitHub contribution graphs. Darker green/blue shades indicate higher numbers of reviews
                                completed on that date.</li>
                            <li><strong>"Full Screen" Button:</strong> Opens the full-page Heatmap dashboard
                                (<code>heatmap.html</code>) with yearly filters and detailed daily drill-downs.</li>
                            <li><strong>"Lifetime" Chip:</strong> Toggles the heatmap between the rolling 365-day
                                calendar and your entire historical record since day one.</li>
                            <li><strong>Action Chips:</strong>
                                <ul>
                                    <li><code>Analytics</code>: Navigates to the analytics suite.</li>
                                    <li><code>Forecast</code>: Opens the workload simulation tool
                                        (<code>forecast.html</code>) to predict upcoming daily review volume.</li>
                                    <li><code>History</code>: Opens the review audit logs (<code>history.html</code>)
                                        showing every graded attempt with exact timestamps and interval changes.</li>
                                </ul>
                            </li>
                        </ul>
                    </div>

                    {/* 5. Study Tools (Exam Mode & Pomodoro) */}
                    <div id="popup-tools" className="card card-accent mb-4">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                            <span style={{ fontSize: '20px' }}>🎓</span>
                            <h3 style={{ margin: '0' }}>5. Study Tools: Exam Mode &amp; Pomodoro Timer</h3>
                        </div>
                        <div className="grid-2">
                            <div className="card" style={{ padding: '12px' }}>
                                <h4 style={{ margin: '0 0 6px 0', color: 'var(--md-secondary)' }}>🎯 Exam Mode (Study Plan)
                                </h4>
                                <p style={{ fontSize: '12px', color: 'var(--md-text-med)', marginBottom: '8px' }}>
                                    Have an upcoming technical interview or exam in 2–4 weeks? Clicking <strong>Exam
                                        Mode</strong> opens <code>studyplan.html</code>.
                                </p>
                                <p style={{ fontSize: '12px', color: 'var(--md-text-low)', margin: '0' }}>
                                    Enter your exam date, and the engine automatically recalculates and compresses
                                    review intervals so all critical patterns are scheduled for review right before your
                                    interview day.
                                </p>
                            </div>
                            <div className="card" style={{ padding: '12px' }}>
                                <h4 style={{ margin: '0 0 6px 0', color: 'var(--md-secondary)' }}>⏱️ Pomodoro Focus Timer</h4>
                                <p style={{ fontSize: '12px', color: 'var(--md-text-med)', marginBottom: '8px' }}>
                                    Struggling with attention fatigue during long problem-solving sessions? Clicking
                                    <strong>Pomodoro</strong> launches <code>pomodoro.html</code>.
                                </p>
                                <p style={{ fontSize: '12px', color: 'var(--md-text-low)', margin: '0' }}>
                                    Runs standard 25-minute uninterrupted problem-solving intervals followed by 5-minute
                                    mental breaks, keeping your focus sharp without burnout.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* 6. Highlighter Settings */}
                    <div id="popup-highlighter" className="card mb-4">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                            <span style={{ fontSize: '20px' }}>🖍️</span>
                            <h3 style={{ margin: '0', color: 'var(--md-warning)' }}>6. Highlighter Quick Settings</h3>
                        </div>
                        <p style={{ fontSize: '13px', color: 'var(--md-text-med)', marginBottom: '12px' }}>
                            Manage the in-page text highlighter directly from the popup:
                        </p>
                        <ul className="help-bullet-list">
                            <li><strong>Floating Marker Menu Switch:</strong> When enabled, selecting text on any
                                supported coding page brings up a floating marker palette to highlight key paragraphs
                                and formulas. If you find the popup distracting, toggle this switch off to temporarily
                                disable the floating popup while keeping existing highlights intact.</li>
                            <li><strong>Customize Colors Button:</strong> Opens <code>highlightOptions.html</code> to
                                define custom HEX color palettes and keyboard shortcut combinations.</li>
                            <li><strong>View All Highlights Button:</strong> Opens <code>highlights.html</code> where
                                all your saved code snippets, annotations, and notes are organized by URL and date.</li>
                        </ul>
                    </div>

                    {/* 7. Notification & Bedtime Quiet Hours Settings */}
                    <div id="popup-notifications" className="card card-accent mb-4">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                            <span style={{ fontSize: '20px' }}>🔔</span>
                            <h3 style={{ margin: '0' }}>7. Notification Settings &amp; Bedtime Quiet Hours</h3>
                        </div>
                        <p style={{ fontSize: '13px', color: 'var(--md-text-med)', marginBottom: '12px' }}>
                            Spaced repetition works best when you review patterns promptly as they become due. The
                            notification engine runs in the background to keep you on schedule:
                        </p>
                        <ul className="help-bullet-list">
                            <li><strong>Review Reminders Switch:</strong> Master toggle enabling or disabling background
                                review alarms. When enabled, the extension periodically checks if any cards have become
                                due.</li>
                            <li><strong>Check Interval Selector:</strong> Choose how frequently the background alarm
                                runs: <code>15 mins</code>, <code>30 mins</code>, <code>1 hour</code> (recommended
                                default), <code>2 hours</code>, <code>6 hours</code>, <code>12 hours</code>, or
                                <code>Daily</code>.
                            </li>
                            <li><strong>Custom Interval (mins):</strong> Selecting <em>Custom...</em> reveals an input
                                where you can enter any custom checking frequency between 1 and 1440 minutes.</li>
                            <li><strong>Sticky Notification Switch:</strong> When enabled
                                , system notification alerts stay visible on your
                                screen until you explicitly click or dismiss them, preventing missed alerts while away
                                from your keyboard.</li>
                            <li><strong>Quiet Hours Switch &amp; Time Window:</strong> Protect your sleep! Toggle on
                                <em>Quiet Hours</em> and pick your sleep schedule (e.g., <code>23:00 to 07:00</code>).
                                AlgoRecall will completely suppress review reminder alerts during these hours, resuming
                                seamlessly in the morning.
                            </li>
                            <li><strong>Weekly Digest Switch:</strong> When enabled, delivers an encouraging summary
                                notification every Sunday reviewing your consistency and mastery gains.</li>
                            <li><strong>Pinned Icon Due Badge Switch:</strong> Shows a numerical badge counter on the
                                extension icon in your browser toolbar (e.g. <code>3</code>) showing exactly how many
                                cards are currently due.</li>
                            <li><strong>Check Due Reviews Now Button:</strong> Forces an immediate background check of
                                your review queue without waiting for the next timer tick, refreshing your badge count
                                and showing an instant status toast.</li>
                            <li><strong>Summary Button (Header):</strong> Opens the Weekly &amp; Monthly Digest report
                                to inspect long-term trends and retention stats.</li>
                        </ul>
                    </div>

                    {/* 8. Data & Options (Collapsible Details) */}
                    <div id="popup-options" className="card mb-4">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                            <span style={{ fontSize: '20px' }}>⚙️</span>
                            <h3 style={{ margin: '0', color: '#9b59b6' }}>8. Data &amp; Advanced Options (Collapsible Panel)
                            </h3>
                        </div>
                        <p style={{ fontSize: '13px', color: 'var(--md-text-med)', marginBottom: '12px' }}>
                            Click the <strong>Data &amp; Options</strong> expandable section at the bottom of the popup
                            to access power-user settings and data synchronization tools:
                        </p>
                        <ul className="help-bullet-list">
                            <li><strong>Problem Tracker Launcher Switch:</strong> Controls whether the floating circular
                                brain widget is injected in the bottom-right corner of LeetCode, AlgoMonster, and
                                whitelisted pages. If you prefer to review solely using the popup and dashboard, you can
                                turn this off to keep your web pages completely untouched.</li>
                            <li><strong>Show Analytics &amp; Charts Switch:</strong> Controls whether the Activity &amp;
                                Charts card is displayed inside the popup. Disabling this compresses the popup window
                                into a streamlined, ultra-compact review list.</li>
                            <li><strong>Developer Mode Switch:</strong> For advanced troubleshooting. Enabling reveals:
                                <ul style={{ marginTop: '4px' }}>
                                    <li>A <code>1 min (Dev)</code> interval option in notification settings.</li>
                                    <li>Test notification trigger buttons (<em>Send Test Notification</em>, <em>Send
                                            Test Summary</em>).</li>
                                    <li>An <strong>Export Debug Logs</strong> button that downloads internal console
                                        logs (<code>algorecall_debug_logs_*.json</code>) for debugging.</li>
                                </ul>
                            </li>
                            <li><strong>Manage Active Websites:</strong> Opens <code>websites.html</code> to whitelist
                                custom coding sites, documentation domains, or personal blogs where you want the
                                floating logger and highlighter active.</li>
                            <li><strong>Configure AlgoRecall Engine:</strong> Opens <code>fsrsConfig.html</code> to
                                fine-tune your desired retention target (0.75 - 0.95) and the 17 algorithmic
                                stability/difficulty weight parameters.</li>
                            <li><strong>Backup (JSON Export):</strong> One-click download of
                                <code>algorecall_backup_YYYY-MM-DD.json</code> containing all cards, review histories,
                                highlights, and settings.
                            </li>
                            <li><strong>Restore (JSON Import):</strong> Safely restore your cards and settings from an
                                existing backup file.</li>
                            <li><strong>To Anki (.txt Export):</strong> Exports your cards into standard Anki
                                tab-delimited format (<code>Front \t Back \t Tags</code>) with
                                <code>#separator:tab</code> directives for seamless desktop Anki importing.
                            </li>
                            <li><strong>From Anki (.txt / .tsv Import):</strong> Imports flashcard decks from Anki.
                                Existing cards with matching problem titles are automatically detected and skipped to
                                avoid duplicates.</li>
                        </ul>
                    </div>

                    {/* 9. Store Rating Prompts & Feedback */}
                    <div id="popup-feedback" className="card card-accent">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                            <span style={{ fontSize: '20px' }}>⭐</span>
                            <h3 style={{ margin: '0' }}>9. Rating Prompts, Feedback &amp; Status Toasts</h3>
                        </div>
                        <p style={{ fontSize: '13px', color: 'var(--md-text-med)', marginBottom: '12px' }}>
                            AlgoRecall is built for students and completely free of tracking. Here is how store feedback
                            and alerts work:
                        </p>
                        <ul className="help-bullet-list">
                            <li><strong>Milestone Rating Card:</strong> After you log your first algorithm pattern, an
                                optional rating card appears encouraging you to support the project on the {BROWSER_CONFIG.storeName}.</li>
                            <li><strong>Snooze (7 days):</strong> Not ready to rate? Click Snooze, and the prompt hides
                                for 7 days before politely re-checking.</li>
                            <li><strong>Already Rated:</strong> Permanently hides the rating card and displays a warm
                                "Thank you for supporting us! ❤️" note with an option to edit your rating state if
                                needed.</li>
                            <li><strong>Status Toasts:</strong> Whenever you change a setting, toggle dark mode, trigger
                                a backup, or check due reviews, a non-intrusive status toast appears at the bottom of
                                the popup confirming the action.</li>
                        </ul>
                    </div>
                </div>
        </div>
    );
}

export function FsrsTabContent(): JSX.Element {
    return (
        <div id="tab-fsrs" className="tab-pane" role="tabpanel">
                <div className="card card-hero">
                    <h2>🧠 AlgoRecall Engine: Your Smart Memory Coach</h2>
                    <p className="section-intro">
                        Think of the <strong>AlgoRecall Engine</strong> as your personal study
                        superpower! Instead of re-solving hundreds of LeetCode or AlgoMonster problems over and over,
                        the AlgoRecall Engine learns how fast your brain forgets code patterns. It schedules your
                        reviews right at the
                        moment you're about to forget them—so you remember more with way less effort!
                    </p>

                    <div className="card card-accent mb-4" style={{ borderLeft: '4px solid var(--md-success)' }}>
                        <h3 style={{ color: 'var(--md-success)' }}>⚡ Study 30% Less, Remember 90% More!</h3>
                        <p style={{ margin: '0', fontSize: '13px', color: 'var(--md-text-med)' }}>
                            By skipping problems you already know well and focusing strictly on tricky ones, the
                            AlgoRecall Engine
                            <strong>cuts your daily review time by 20% to 30%+</strong> compared to old-school flashcard
                            apps. You'll master more interview patterns in significantly fewer total practice sessions!
                        </p>
                    </div>
                </div>

                {/* 2. Visual Diagram: Complete Card Lifecycle State Machine */}
                <div className="card mb-4">
                    <div className="diagram-box">
                        <h3>🌱 The 4 Stages of Your Flashcards</h3>
                        <p style={{ fontSize: '12.5px', color: 'var(--md-text-med)', marginBottom: '14px' }}>
                            Every coding problem you add goes on a journey through 4 simple stages:
                            <code>New (0)</code>, <code>Learning (1)</code>, <code>Review (2)</code>, and
                            <code>Relearning (3)</code>.
                        </p>
                        <div className="lifecycle-grid">
                            {/* Stage 0 */}
                            <div className="lifecycle-card lifecycle-card-new">
                                <span className="state-badge state-badge-new">Stage 0: New</span>
                                <h4>🆕 Fresh Problem</h4>
                                <p>A problem you just added. You haven't practiced or tested yourself on it yet. Created
                                    when logging problem notes. Awaits initial rating in floating bar.</p>
                                <ul className="lifecycle-meta-list">
                                    <li><strong>Again / Hard:</strong> → Moves to <code>Learning</code></li>
                                    <li><strong>Good / Easy:</strong> → Graduates to <code>Review</code></li>
                                    <li><strong>Reps / Lapses:</strong> 0 reps, 0 lapses</li>
                                </ul>
                            </div>

                            {/* Stage 1 */}
                            <div className="lifecycle-card lifecycle-card-learning">
                                <span className="state-badge state-badge-learning">Stage 1: Learning</span>
                                <h4>📖 Practice Mode</h4>
                                <p>You're building initial memory. The card shows up in short practice rounds (like 1
                                    min or 10 mins) until you've got it down.</p>
                                <ul className="lifecycle-meta-list">
                                    <li><strong>Again:</strong> Resets step timer back to Step 1</li>
                                    <li><strong>Hard:</strong> Stays in short practice</li>
                                    <li><strong>Good / Easy:</strong> → Promotes to <code>Review</code></li>
                                </ul>
                            </div>

                            {/* Stage 2 */}
                            <div className="lifecycle-card lifecycle-card-review">
                                <span className="state-badge state-badge-review">Stage 2: Review</span>
                                <h4>🏆 Mastered</h4>
                                <p>It's locked in! The card is now in long-term memory. The AlgoRecall Engine will space
                                    out reviews (4
                                    days, 12 days, 1 month...) to keep it fresh.</p>
                                <ul className="lifecycle-meta-list">
                                    <li><strong>Hard / Good / Easy:</strong> Stays in <code>Review</code> (interval
                                        grows)</li>
                                    <li><strong>Again (Lapse):</strong> → Demoted to <code>Relearning</code>
                                    </li>
                                    <li><strong>Milestone:</strong> Stability &gt; 7d = Graduated</li>
                                </ul>
                            </div>

                            {/* Stage 3 */}
                            <div className="lifecycle-card lifecycle-card-relearning">
                                <span className="state-badge state-badge-relearning">Stage 3: Relearning</span>
                                <h4>🔄 Refresher</h4>
                                <p>Forgot a mastered problem? No stress! The AlgoRecall Engine gives you a quick
                                    refresher round until
                                    it's safely back in long-term memory.</p>
                                <ul className="lifecycle-meta-list">
                                    <li><strong>Again:</strong> Resets refresher timer</li>
                                    <li><strong>Hard:</strong> Continues refresher practice</li>
                                    <li><strong>Good / Easy:</strong> → Returns to <code>Review</code></li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    {/* Complete State Transition Matrix Table (Student Friendly) */}
                    <div className="card mb-4">
                        <h3>🔄 How Your Ratings Change a Card's Stage</h3>
                        <p style={{ fontSize: '12.5px', color: 'var(--md-text-med)', marginBottom: '10px' }}>
                            Whenever you grade a review, the AlgoRecall Engine automatically updates the card's stage
                            and calculates when
                            you should see it next:
                        </p>

                        <div className="fsrs-table-container">
                            <table className="fsrs-table">
                                <thead>
                                    <tr>
                                        <th>Current Stage</th>
                                        <th>Your Rating</th>
                                        <th>Next Stage</th>
                                        <th>What Happens Next?</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {/* Stage 0: New */}
                                    <tr style={{ borderTop: '2px solid var(--md-primary)' }}>
                                        <td><span className="state-badge state-badge-new">🆕 New (0)</span></td>
                                        <td><span className="rating-badge" style={{ color: 'var(--md-danger)' }}>🔴 Again
                                                (1)</span>
                                        </td>
                                        <td><span className="state-badge state-badge-learning">📖 Learning</span></td>
                                        <td>Starts practice mode! The AlgoRecall Engine schedules a quick re-test in ~1
                                            to 5 mins so you
                                            can try again.</td>
                                    </tr>
                                    <tr>
                                        <td><span className="state-badge state-badge-new">🆕 New (0)</span></td>
                                        <td><span className="rating-badge" style={{ color: 'var(--md-warning)' }}>🟡 Hard
                                                (2)</span>
                                        </td>
                                        <td><span className="state-badge state-badge-learning">📖 Learning</span></td>
                                        <td>Starts practice mode. The AlgoRecall Engine schedules a short check-in in ~5
                                            to 10 mins.</td>
                                    </tr>
                                    <tr>
                                        <td><span className="state-badge state-badge-new">🆕 New (0)</span></td>
                                        <td><span className="rating-badge" style={{ color: 'var(--md-primary)' }}>🟢 Good
                                                (3)</span>
                                        </td>
                                        <td><span className="state-badge state-badge-learning">📖 Learning</span></td>
                                        <td>Moves to the next practice step! You'll see it again in ~10 mins or
                                            tomorrow.</td>
                                    </tr>
                                    <tr>
                                        <td><span className="state-badge state-badge-new">🆕 New (0)</span></td>
                                        <td><span className="rating-badge" style={{ color: 'var(--md-success)' }}>🔵 Easy
                                                (4)</span>
                                        </td>
                                        <td><span className="state-badge state-badge-review">🏆 Mastered</span></td>
                                        <td>You nailed it right away! Skips practice steps and graduates straight to
                                            long-term memory (next review in 4+ days).</td>
                                    </tr>

                                    {/* Stage 1: Learning */}
                                    <tr style={{ borderTop: '2px solid var(--md-warning)' }}>
                                        <td><span className="state-badge state-badge-learning">📖 Learning</span></td>
                                        <td><span className="rating-badge" style={{ color: 'var(--md-danger)' }}>🔴 Again
                                                (1)</span>
                                        </td>
                                        <td><span className="state-badge state-badge-learning">📖 Learning</span></td>
                                        <td>Resets practice timer back to Step 1. Re-queues the card for another try
                                            in
                                            ~1
                                            minute.</td>
                                    </tr>
                                    <tr>
                                        <td><span className="state-badge state-badge-learning">📖 Learning</span></td>
                                        <td><span className="rating-badge" style={{ color: 'var(--md-warning)' }}>🟡 Hard
                                                (2)</span>
                                        </td>
                                        <td><span className="state-badge state-badge-learning">📖 Learning</span></td>
                                        <td>Stays in learning mode. You're building memory, so the AlgoRecall Engine
                                            schedules another
                                            short check-in soon.</td>
                                    </tr>
                                    <tr>
                                        <td><span className="state-badge state-badge-learning">📖 Learning</span></td>
                                        <td><span className="rating-badge" style={{ color: 'var(--md-primary)' }}>🟢 Good
                                                (3)</span>
                                        </td>
                                        <td><span className="state-badge state-badge-review">🏆 Mastered</span></td>
                                        <td>Practice complete! The card moves to Mastered status and enters long-term
                                            memory (see it in a few days).</td>
                                    </tr>
                                    <tr>
                                        <td><span className="state-badge state-badge-learning">📖 Learning</span></td>
                                        <td><span className="rating-badge" style={{ color: 'var(--md-success)' }}>🔵 Easy
                                                (4)</span>
                                        </td>
                                        <td><span className="state-badge state-badge-review">🏆 Mastered</span></td>
                                        <td>Super fast progress! Skips the remaining practice steps and graduates with a
                                            bonus long break!</td>
                                    </tr>

                                    {/* Stage 2: Mastered / Review */}
                                    <tr style={{ borderTop: '2px solid var(--md-success)' }}>
                                        <td><span className="state-badge state-badge-review">🏆 Mastered</span></td>
                                        <td><span className="rating-badge" style={{ color: 'var(--md-danger)' }}>🔴 Again
                                                (1)</span>
                                        </td>
                                        <td><span className="state-badge state-badge-relearning">🔄 Refresher</span>
                                        </td>
                                        <td><strong>Memory Lapse!</strong> Increments <code>lapses</code> count
                                            (+1),
                                            stability drops sharply, and card enters Refresher mode for immediate
                                            re-learning to help you rebuild your memory strength.</td>
                                    </tr>
                                    <tr>
                                        <td><span className="state-badge state-badge-review">🏆 Mastered</span></td>
                                        <td><span className="rating-badge" style={{ color: 'var(--md-warning)' }}>🟡 Hard
                                                (2)</span>
                                        </td>
                                        <td><span className="state-badge state-badge-review">🏆 Mastered</span></td>
                                        <td>Stays Mastered! Your memory got a bit stronger, so the AlgoRecall Engine
                                            extends your next
                                            review date moderately.</td>
                                    </tr>
                                    <tr>
                                        <td><span className="state-badge state-badge-review">🏆 Mastered</span></td>
                                        <td><span className="rating-badge" style={{ color: 'var(--md-primary)' }}>🟢 Good
                                                (3)</span>
                                        </td>
                                        <td><span className="state-badge state-badge-review">🏆 Mastered</span></td>
                                        <td>Stays Mastered! Great recall! The AlgoRecall Engine expands your next review
                                            interval
                                            smoothly (for example, from 10 days to 25 days).</td>
                                    </tr>
                                    <tr>
                                        <td><span className="state-badge state-badge-review">🏆 Mastered</span></td>
                                        <td><span className="rating-badge" style={{ color: 'var(--md-success)' }}>🔵 Easy
                                                (4)</span>
                                        </td>
                                        <td><span className="state-badge state-badge-review">🏆 Mastered</span></td>
                                        <td>Stays Mastered! Total recall power! The AlgoRecall Engine gives you a huge
                                            break (for
                                            example, jumping from 10 days to 45+ days).</td>
                                    </tr>

                                    {/* Stage 3: Refresher / Relearning */}
                                    <tr style={{ borderTop: '2px solid var(--md-danger)' }}>
                                        <td><span className="state-badge state-badge-relearning">🔄 Refresher</span>
                                        </td>
                                        <td><span className="rating-badge" style={{ color: 'var(--md-danger)' }}>🔴 Again
                                                (1)</span>
                                        </td>
                                        <td><span className="state-badge state-badge-relearning">🔄 Refresher</span>
                                        </td>
                                        <td>Resets the refresher timer back to Step 1. You'll see it again in ~1 minute
                                            to try again.</td>
                                    </tr>
                                    <tr>
                                        <td><span className="state-badge state-badge-relearning">🔄 Refresher</span>
                                        </td>
                                        <td><span className="rating-badge" style={{ color: 'var(--md-warning)' }}>🟡 Hard
                                                (2)</span>
                                        </td>
                                        <td><span className="state-badge state-badge-relearning">🔄 Refresher</span>
                                        </td>
                                        <td>Stays in refresher mode. Keeps rebuilding your memory until you feel
                                            confident.</td>
                                    </tr>
                                    <tr>
                                        <td><span className="state-badge state-badge-relearning">🔄 Refresher</span>
                                        </td>
                                        <td><span className="rating-badge" style={{ color: 'var(--md-primary)' }}>🟢 Good
                                                (3)</span>
                                        </td>
                                        <td><span className="state-badge state-badge-review">🏆 Mastered</span></td>
                                        <td>Refresher complete! You're back on track, and the card returns to long-term
                                            memory.</td>
                                    </tr>
                                    <tr>
                                        <td><span className="state-badge state-badge-relearning">🔄 Refresher</span>
                                        </td>
                                        <td><span className="rating-badge" style={{ color: 'var(--md-success)' }}>🔵 Easy
                                                (4)</span>
                                        </td>
                                        <td><span className="state-badge state-badge-review">🏆 Mastered</span></td>
                                        <td>Refresher aced! Immediately returns to long-term memory with a bonus
                                            break!</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <div style={{ fontSize: '11.5px', color: 'var(--md-text-low)', marginTop: '6px' }}>
                            🌟 <strong>What does "Mastered" mean for you?</strong> A problem reaches the
                            <strong>Mastered (Graduated)</strong> milestone when you know the pattern so well that you
                            can recall it after <strong>more than a week</strong> without practice (memory stability
                            &gt; 7 days). It has officially graduated from short-term study into your long-term
                            interview memory!
                        </div>
                    </div>

                    {/* 4. Visual Diagram B: End-to-End Review Execution Workflow */}
                    <div className="card mb-4">
                        <h3>⚡ Review Execution Workflow</h3>
                        <p style={{ fontSize: '12.5px', color: 'var(--md-text-med)', marginBottom: '14px' }}>
                            Reviewing in AlgoRecall takes less than 30 seconds per problem. Here is how your daily
                            review cycle works from start to finish:
                        </p>

                        <div className="diagram-box">
                            <div className="flow-diagram-row">
                                <div className="flow-node">
                                    <span className="flow-node-step">Step 1</span>
                                    <div className="flow-node-title">Problem Due</div>
                                    <p className="flow-node-desc">The extension icon badge lights up right before your brain
                                        starts to forget the pattern.</p>
                                    <span className="flow-node-tag">Automatic</span>
                                </div>
                                <div className="flow-arrow-cell">→</div>
                                <div className="flow-node">
                                    <span className="flow-node-step">Step 2</span>
                                    <div className="flow-node-title">Test Memory</div>
                                    <p className="flow-node-desc">Open the card. Look at the title and tags, then spend
                                        15–30
                                        seconds mentally reconstructing the solution pattern.</p>
                                    <span className="flow-node-tag">Your Turn</span>
                                </div>
                                <div className="flow-arrow-cell">→</div>
                                <div className="flow-node">
                                    <span className="flow-node-step">Step 3</span>
                                    <div className="flow-node-title">Check Notes</div>
                                    <p className="flow-node-desc">Press <kbd>Space</kbd> or click "Show Approach" to reveal
                                        your notes, key code snippets, and time/space complexities.</p>
                                    <span className="flow-node-tag">Your Turn</span>
                                </div>
                                <div className="flow-arrow-cell">→</div>
                                <div className="flow-node">
                                    <span className="flow-node-step">Step 4</span>
                                    <div className="flow-node-title">Rate Recall</div>
                                    <p className="flow-node-desc">Press <kbd>1</kbd> (Again), <kbd>2</kbd> (Hard),
                                        <kbd>3</kbd>
                                        (Good), or <kbd>4</kbd> (Easy) based on how quickly you recalled the answer.
                                    </p>
                                    <span className="flow-node-tag">Your Turn</span>
                                </div>
                                <div className="flow-arrow-cell">→</div>
                                <div className="flow-node">
                                    <span className="flow-node-step">Step 5</span>
                                    <div className="flow-node-title">Smart Schedule</div>
                                    <p className="flow-node-desc">The AlgoRecall Engine recalculates your memory curve. Hard
                                        cards return
                                        soon;
                                        easy cards get pushed weeks ahead so you study less!</p>
                                    <span className="flow-node-tag">Automatic</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 5. Visual Diagram C: Rating Decision Tree */}
                    <div className="card mb-4">
                        <h3>🎯 How to Grade Yourself (Button Guide)</h3>
                        <p style={{ fontSize: '12.5px', color: 'var(--md-text-med)', marginBottom: '14px' }}>
                            Use this simple decision tree to determine which rating button to press after attempting
                            recall:
                        </p>

                        <div className="rating-grid mb-4">
                            <div className="rating-item rating-again">
                                <span className="rating-badge">🔴 Again (Shortcut: 1)</span>
                                <h4 style={{ margin: '0 0 6px 0', fontSize: '13px', color: 'var(--md-text-high)' }}>"I got
                                    stuck
                                    /
                                    Blanked out"</h4>
                                <p><strong>Condition:</strong> Couldn't remember the core algorithmic pattern, data
                                    structure, or forgot a key step of the algorithm.<br />
                                    <strong>Outcome:</strong> Demotes card to Refresher round, resets stability,
                                    re-tests in
                                    ~1 min.
                                </p>
                            </div>
                            <div className="rating-item rating-hard">
                                <span className="rating-badge">🟡 Hard (Shortcut: 2)</span>
                                <h4 style={{ margin: '0 0 6px 0', fontSize: '13px', color: 'var(--md-text-high)' }}>Solved,
                                    but
                                    with heavy struggle</h4>
                                <p><strong>Condition:</strong> Remembered the core approach, but had major
                                    hesitation,
                                    slow
                                    recall, or minor syntax stumbling.<br />
                                    <strong>Outcome:</strong> Keeps card Mastered; increases interval
                                    conservatively.
                                </p>
                            </div>
                            <div className="rating-item rating-good">
                                <span className="rating-badge">🟢 Good (Shortcut: 3) — Default Choice!</span>
                                <h4 style={{ margin: '0 0 6px 0', fontSize: '13px', color: 'var(--md-text-high)' }}>Smooth
                                    recall</h4>
                                <p><strong>Condition:</strong> Remembered the technique and edge cases within
                                    standard
                                    interview pacing.<br />
                                    <strong>Outcome:</strong> Make this your main button ~70-80% of the time! Smoothly
                                    expands interval.
                                </p>
                            </div>
                            <div className="rating-item rating-easy">
                                <span className="rating-badge">🔵 Easy (Shortcut: 4)</span>
                                <h4 style={{ margin: '0 0 6px 0', fontSize: '13px', color: 'var(--md-text-high)' }}>Trivial
                                    /
                                    Obvious</h4>
                                <p><strong>Condition:</strong> Required zero mental effort. Felt completely
                                    instinctive
                                    and
                                    permanent.<br />
                                    <strong>Outcome:</strong> Drops difficulty rating and pushes interval far into
                                    the
                                    future.
                                </p>
                            </div>
                        </div>
                        {/* Partial Memory Recall Guide (Student Friendly) */}
                        <div className="card mb-4" style={{ borderLeft: '4px solid var(--md-warning)' }}>
                            <h3 style={{ color: 'var(--md-warning)' }}>🧩 What If I Only Remember SOME of the Problem?</h3>
                            <p style={{ fontSize: '13px', color: 'var(--md-text-med)', marginBottom: '10px' }}>
                                It happens all the time! Here is a simple rule of thumb to decide what to press:
                            </p>

                            <div className="callout-box callout-box-danger">
                                <h4>The Interview Reality Check: Missing Core Logic? → Press 🔴
                                    <code>Again</code>
                                </h4>
                                <p>Ask yourself: <i>"If an interviewer gave me this problem right now, would my missing
                                        piece make me get stuck?"</i><br />
                                    If <strong>YES </strong>(for example: you remembered Two Pointers but forgot how to
                                    handle duplicate
                                    triplets in 3Sum, or forgot the DP base case), press 🔴
                                    <strong><code>Again</code></strong>. It's totally okay to fail a card—that's how
                                    your
                                    brain builds bulletproof recall!
                                </p>
                            </div>

                            <div className="callout-box callout-box-warning">
                                <h4>Main Algorithm Solid, Just Paused on Syntax? → Press 🟡 <code>Hard</code>
                                </h4>
                                <p>If your high-level approach and logic were 100% correct, but you just briefly paused
                                    on
                                    language syntax (like queue or map function names), press 🟡
                                    <strong><code>Hard</code></strong>.
                                </p>
                            </div>

                            <div className="callout-box">
                                <h4>💡 Student Tip: The "Break-It-Down" Rule</h4>
                                <p>If a problem note feels huge and you always forget half of it, break it into 2
                                    smaller
                                    cards! For example: Card #1 = <i>High-Level Pattern & Time Complexity</i>, Card #2 =
                                    <i>Tricky Edge Cases & Base Cases</i>.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* 6. Visual Diagram D & E: Overdue Reviews & Daily Workflow */}
                    <div className="grid-2 mb-4">
                        <div className="card" style={{ marginBottom: '0' }}>
                            <h3>⏰ What Happens When a Review Is Overdue?</h3>
                            <p
                                style={{ fontSize: '12px', color: 'var(--md-text-med)', lineHeight: '1.5', marginBottom: '10px' }}>
                                The AlgoRecall Engine tracks <code>elapsed days</code> (actual days since last review)
                                separately
                                from
                                <code>scheduled days</code>.
                            </p>
                            <ul className="help-bullet-list" style={{ fontSize: '12px' }}>
                                <li><strong>Reviewed On Time:</strong> The AlgoRecall Engine predicts retrievability
                                    <i>R</i> ≈
                                    88%
                                    and
                                    expands interval normally.
                                </li>
                                <li><strong>Overdue + Remembered (Good/Easy):</strong> If you review 5 days late and
                                    still
                                    recall it, the AlgoRecall Engine realizes your memory is stronger than expected! It
                                    awards a
                                    <strong>higher stability boost</strong> than normal.
                                </li>
                                <li><strong>Overdue + Forgotten (Again):</strong> Stability drops sharply and the
                                    card
                                    enters Relearning. Do not fear lapses; they protect you from false confidence.
                                </li>
                                <li><strong>Cards Never Expire:</strong> Overdue cards simply wait in queue sorted
                                    by
                                    due
                                    date; progress is never wiped out automatically.</li>
                            </ul>
                        </div>

                        <div className="card" style={{ marginBottom: '0' }}>
                            <h3>📅 Recommended Daily Routine</h3>
                            <p
                                style={{ fontSize: '12px', color: 'var(--md-text-med)', lineHeight: '1.5', marginBottom: '10px' }}>
                                To maximize retention while spending minimum time, follow this 4-step daily rhythm:
                            </p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <div
                                    style={{ background: 'var(--md-surface-variant)', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', borderLeft: '3px solid var(--md-primary)' }}>
                                    <strong>1. Morning Queue Check:</strong> Check toolbar badge number for due
                                    reviews.
                                </div>
                                <div
                                    style={{ background: 'var(--md-surface-variant)', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', borderLeft: '3px solid var(--md-warning)' }}>
                                    <strong>2. Clear Due Reviews First:</strong> Do active recall on due cards
                                    before
                                    learning new problems.
                                </div>
                                <div
                                    style={{ background: 'var(--md-surface-variant)', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', borderLeft: '3px solid var(--md-success)' }}>
                                    <strong>3. Log Today's Coding:</strong> When solving a new LeetCode problem, log
                                    notes
                                    and click initial rating.
                                </div>
                                <div
                                    style={{ background: 'var(--md-surface-variant)', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', borderLeft: '3px solid var(--md-text-low)' }}>
                                    <strong>4. Review Analytics:</strong> Track your retention curve and readiness
                                    forecast
                                    once a week.
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 7. Comprehensive Practical Examples */}
                    <div className="card mb-4">
                        <h3>📚 Practical Step-by-Step Examples</h3>
                        <p style={{ fontSize: '12.5px', color: 'var(--md-text-med)', marginBottom: '16px' }}>
                            The following realistic scenarios demonstrate how the AlgoRecall Engine manages a card
                            throughout its
                            lifecycle:
                        </p>

                        <div className="grid-2 mb-4">
                            {/* Example 1 */}
                            <div className="strategy-card">
                                <span className="strategy-badge">Example 1</span>
                                <h4>🆕 A Brand-New Problem Card (Two Sum)</h4>
                                <p>
                                    <strong>Action:</strong> You solve Two Sum using a Hash Map and open the
                                    floating
                                    tracker.<br />
                                    <strong>Step 1:</strong> You type your approach notes and click 🟢
                                    <strong>Good</strong>.<br />
                                    <strong>Result:</strong> Card is created and reviewed
                                    simultaneously. It graduates immediately to <code>Review</code> with Stability
                                    <i>S</i> = 3.0 days.<br />
                                    <strong>Next Due Date:</strong> In 3 days.
                                </p>
                            </div>

                            {/* Example 2 */}
                            <div className="strategy-card">
                                <span className="strategy-badge">Example 2</span>
                                <h4>📈 Repeated Successful Recall (LRU Cache)</h4>
                                <p>
                                    <strong>Day 0:</strong> Logged & rated <strong>Good</strong> → Due in 3
                                    days.<br />
                                    <strong>Day 3:</strong> You recall Hash Map + Doubly Linked List! Rated
                                    <strong>Good</strong> → Stability jumps to 8.5 days.<br />
                                    <strong>Day 12:</strong> Reviewed & rated <strong>Good</strong> → Stability
                                    jumps
                                    to 24 days.<br />
                                    <strong>Day 36:</strong> Remembered easily! Rated <strong>Easy</strong> →
                                    Due
                                    in
                                    75+ days!
                                </p>
                            </div>
                        </div>

                        <div className="grid-2 mb-4">
                            {/* Example 3 */}
                            <div className="strategy-card">
                                <span className="strategy-badge">Example 3</span>
                                <h4>🔄 A Card Is Forgotten (Merge K Sorted Lists)</h4>
                                <p>
                                    <strong>Scenario:</strong> You mastered this card 3 weeks ago (Stability <i>S</i> =
                                    21 days). Today it is due, but you blank out on Min-Heap vs
                                    Divide-and-Conquer.<br />
                                    <strong>Action:</strong> You honestly press 🔴 <strong>Again</strong>.<br />
                                    <strong>Result:</strong> Lapses increases to 1. Stability drops to 1.8 days.
                                    Card enters <code>Relearning</code> stage.<br />
                                    <strong>Follow-up:</strong> Card check-in appears in ~1 min. You review your
                                    notes
                                    and
                                    press 🟢 <strong>Good</strong>, returning safely to <code>Review</code>.
                                </p>
                            </div>

                            {/* Example 4 */}
                            <div className="strategy-card">
                                <span className="strategy-badge">Example 4</span>
                                <h4>⏰ An Overdue Review (Course Schedule - 5 Days Late)</h4>
                                <p>
                                    <strong>Scenario:</strong> Card was due on Monday (<i>R</i> = 88%). You had a busy
                                    week
                                    and
                                    review it on Saturday (5 days overdue, <i>R</i> ≈ 72%).<br />
                                    <strong>Recall:</strong> You successfully remember Topological Sort with Kahn's
                                    algorithm! Rated 🟢 <strong>Good</strong>.<br />
                                    <strong>Engine Bonus:</strong> Because you overcame forgetting when retrievability
                                    was
                                    low, the AlgoRecall Engine awards an extra stability multiplier! Stability jumps
                                    higher than if
                                    reviewed
                                    on Monday.
                                </p>
                            </div>
                        </div>

                        {/* Example 5: 30-Day Multi-Session Timeline Table */}
                        <div className="card card-accent" style={{ marginBottom: '0' }}>
                            <h4 style={{ margin: '0 0 10px 0', fontSize: '13.5px', color: 'var(--md-text-high)' }}>
                                🗓️ Example 5: Complete 30-Day Chronological Card Timeline
                            </h4>
                            <div className="fsrs-table-container">
                                <table className="fsrs-table">
                                    <thead>
                                        <tr>
                                            <th>Timeline</th>
                                            <th>Stage</th>
                                            <th>User Recall Experience</th>
                                            <th>Rating</th>
                                            <th>Stability (<i>S</i>)</th>
                                            <th>Resulting Due Date</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            <td><span className="timeline-pill timeline-pill-day">Day 1</span></td>
                                            <td><span className="state-badge state-badge-new">New</span> → <span
                                                    className="state-badge state-badge-review">Review</span></td>
                                            <td>Initial solve on LeetCode. Solution approach saved.</td>
                                            <td><span className="rating-badge" style={{ color: 'var(--md-primary)' }}>🟢
                                                    Good</span>
                                            </td>
                                            <td>2.8 days</td>
                                            <td>Scheduled for <strong>Day 4</strong></td>
                                        </tr>
                                        <tr>
                                            <td><span className="timeline-pill timeline-pill-day">Day 4</span></td>
                                            <td><span className="state-badge state-badge-review">Review</span></td>
                                            <td>First due review. Recalled pattern smoothly.</td>
                                            <td><span className="rating-badge" style={{ color: 'var(--md-primary)' }}>🟢
                                                    Good</span>
                                            </td>
                                            <td>7.9 days</td>
                                            <td>Scheduled for <strong>Day 12</strong> (Graduated!)</td>
                                        </tr>
                                        <tr>
                                            <td><span className="timeline-pill timeline-pill-day">Day 12</span></td>
                                            <td><span className="state-badge state-badge-review">Review</span></td>
                                            <td>Struggled on an edge case, but remembered core approach.</td>
                                            <td><span className="rating-badge" style={{ color: 'var(--md-warning)' }}>🟡
                                                    Hard</span>
                                            </td>
                                            <td>15.2 days</td>
                                            <td>Scheduled for <strong>Day 27</strong></td>
                                        </tr>
                                        <tr>
                                            <td><span className="timeline-pill timeline-pill-day">Day 27</span></td>
                                            <td><span className="state-badge state-badge-review">Review</span> →
                                                <span className="state-badge state-badge-relearning">Relearning</span>
                                            </td>
                                            <td>Forgot the recurrence relation completely. Blanked out.</td>
                                            <td><span className="rating-badge" style={{ color: 'var(--md-danger)' }}>🔴
                                                    Again</span>
                                            </td>
                                            <td>1.6 days</td>
                                            <td>Relearning step in <strong>~1 minute</strong></td>
                                        </tr>
                                        <tr>
                                            <td><span className="timeline-pill timeline-pill-day">Day 27 +1m</span></td>
                                            <td><span className="state-badge state-badge-relearning">Relearning</span>
                                                →
                                                <span className="state-badge state-badge-review">Review</span>
                                            </td>
                                            <td>Re-tested after studying notes. Understood pattern.</td>
                                            <td><span className="rating-badge" style={{ color: 'var(--md-primary)' }}>🟢
                                                    Good</span>
                                            </td>
                                            <td>3.5 days</td>
                                            <td>Scheduled for <strong>Day 31</strong></td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    {/* 8. Core AlgoRecall Engine Concepts in Beginner-Friendly Language */}
                    <div className="card mb-4">
                        <h3>🔬 Core AlgoRecall Engine Concepts in Plain English</h3>
                        <p style={{ fontSize: '12.5px', color: 'var(--md-text-med)', marginBottom: '14px' }}>
                            You don't need a math degree to understand the AlgoRecall Engine. Here is what the core
                            parameters mean
                            in
                            everyday terms:
                        </p>

                        <div className="grid-2 mb-4">
                            <div className="card card-accent" style={{ marginBottom: '0' }}>
                                <h4 style={{ margin: '0 0 6px 0', fontSize: '13px', color: 'var(--md-primary)' }}>1.
                                    Stability
                                    (<i>S</i>)
                                    — "Memory Strength"</h4>
                                <p style={{ fontSize: '12px', color: 'var(--md-text-med)', margin: '0', lineHeight: '1.5' }}>
                                    Stability is the number of days it takes for your recall probability to fall
                                    from
                                    100%
                                    down to your target retention (88%). If a card has <i>S</i> = 30, it means you can
                                    leave
                                    it
                                    untouched for an entire month and still have an 88% chance of remembering it!
                                </p>
                            </div>
                            <div className="card card-accent" style={{ marginBottom: '0' }}>
                                <h4 style={{ margin: '0 0 6px 0', fontSize: '13px', color: 'var(--md-warning)' }}>2.
                                    Difficulty
                                    (<i>D</i>) — "Inherent Complexity"</h4>
                                <p style={{ fontSize: '12px', color: 'var(--md-text-med)', margin: '0', lineHeight: '1.5' }}>
                                    Ranked from 1 (trivial) to 10 (exceptionally tough). Harder cards gain stability
                                    more
                                    slowly with each successful review, meaning the AlgoRecall Engine spaces them out
                                    more
                                    conservatively
                                    so
                                    they don't slip away.
                                </p>
                            </div>
                        </div>

                        <div className="grid-2 mb-4">
                            <div className="card card-accent" style={{ marginBottom: '0' }}>
                                <h4 style={{ margin: '0 0 6px 0', fontSize: '13px', color: 'var(--md-success)' }}>3.
                                    Retrievability
                                    (<i>R</i>) — "Recall Probability Right Now"</h4>
                                <p style={{ fontSize: '12px', color: 'var(--md-text-med)', margin: '0', lineHeight: '1.5' }}>
                                    A dynamic score between 0% and 100% indicating how likely you are to solve the
                                    problem
                                    today. Immediately after reviewing, <i>R</i> = 100%. Over time, it follows the
                                    forgetting
                                    curve.
                                </p>
                            </div>
                            <div className="card card-accent" style={{ marginBottom: '0' }}>
                                <h4 style={{ margin: '0 0 6px 0', fontSize: '13px', color: 'var(--md-text-high)' }}>4.
                                    Rapid clicking & 1-Minute Misclick Correction</h4>
                                <p style={{ fontSize: '12px', color: 'var(--md-text-med)', margin: '0', lineHeight: '1.5' }}>
                                    If you accidentally click <strong>Good</strong> instead of
                                    <strong>Again</strong>,
                                    simply press <strong>Again within 60 seconds</strong>! The scheduler
                                    automatically
                                    restores the card's previous state and recalculates cleanly without skewing your
                                    history.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* 9. Your Responsibilities & Common Mistakes */}
                    <div className="card mb-4">
                        <h3>🛡️ Your Responsibilities: How to Use the Extension Correctly</h3>
                        <p style={{ fontSize: '12.5px', color: 'var(--md-text-med)', marginBottom: '14px' }}>
                            The AlgoRecall Engine is a powerful mathematical model, but its predictions rely 100% on the
                            accuracy of
                            your
                            feedback. To get bulletproof memory:
                        </p>

                        <div className="grid-3 mb-4">
                            <div
                                style={{ background: 'var(--md-surface-variant)', padding: '14px', borderRadius: '10px', borderTop: '3px solid var(--md-primary)' }}>
                                <h4 style={{ margin: '0 0 6px 0', fontSize: '13px', color: 'var(--md-text-high)' }}>Before
                                    Reviewing
                                </h4>
                                <ul className="help-bullet-list" style={{ fontSize: '11.5px', margin: '0' }}>
                                    <li>Read the problem title and tags.</li>
                                    <li>Spend at least 30–60 seconds visualizing the algorithm in your head.</li>
                                    <li>Do <strong>not</strong> press Spacebar immediately! Active retrieval builds
                                        synapses.</li>
                                </ul>
                            </div>
                            <div
                                style={{ background: 'var(--md-surface-variant)', padding: '14px', borderRadius: '10px', borderTop: '3px solid var(--md-warning)' }}>
                                <h4 style={{ margin: '0 0 6px 0', fontSize: '13px', color: 'var(--md-text-high)' }}>While
                                    Reviewing
                                </h4>
                                <ul className="help-bullet-list" style={{ fontSize: '11.5px', margin: '0' }}>
                                    <li>Be brutally honest with your grade.</li>
                                    <li>Don't confuse recognition with recall ("Oh yeah, I know this" is not
                                        recall).
                                    </li>
                                    <li>If you needed to peek at hints to solve it, press 🔴 <strong>Again</strong>.
                                    </li>
                                </ul>
                            </div>
                            <div
                                style={{ background: 'var(--md-surface-variant)', padding: '14px', borderRadius: '10px', borderTop: '3px solid var(--md-success)' }}>
                                <h4 style={{ margin: '0 0 6px 0', fontSize: '13px', color: 'var(--md-text-high)' }}>After
                                    Reviewing
                                </h4>
                                <ul className="help-bullet-list" style={{ fontSize: '11.5px', margin: '0' }}>
                                    <li>Trust the scheduler's next date.</li>
                                    <li>Do not manually cram cards that aren't due yet.</li>
                                    <li>Clear your queue daily to prevent backlog spikes.</li>
                                </ul>
                            </div>
                        </div>

                        {/* Top 6 Common Mistakes */}
                        <h4 style={{ margin: '16px 0 10px 0', fontSize: '13.5px', color: 'var(--md-danger)' }}>
                            🚫 Top 6 Mistakes to Avoid
                        </h4>
                        <div className="grid-2">
                            <div className="callout-box callout-box-danger" style={{ margin: '4px 0' }}>
                                <strong style={{ fontSize: '12px', color: 'var(--md-text-high)' }}>1. Overusing
                                    "Easy"</strong>
                                <p style={{ fontSize: '11.5px', marginTop: '2px' }}>Pressing Easy on problems that feel
                                    familiar
                                    pushes them months into the future. Reserve Easy strictly for questions you
                                    could
                                    code
                                    in your sleep.</p>
                            </div>
                            <div className="callout-box callout-box-danger" style={{ margin: '4px 0' }}>
                                <strong style={{ fontSize: '12px', color: 'var(--md-text-high)' }}>2. Rating "Good" After
                                    Looking
                                    at Hints</strong>
                                <p style={{ fontSize: '11.5px', marginTop: '2px' }}>If you had to look at your notes to
                                    remember
                                    the data structure, you did not recall it. Press Again!</p>
                            </div>
                            <div className="callout-box callout-box-danger" style={{ margin: '4px 0' }}>
                                <strong style={{ fontSize: '12px', color: 'var(--md-text-high)' }}>3. Pressing "Again"
                                    Over
                                    Syntax
                                    Typos</strong>
                                <p style={{ fontSize: '11.5px', marginTop: '2px' }}>The AlgoRecall Engine is testing
                                    algorithmic
                                    intuition,
                                    not
                                    language syntax memorization. If the logic was correct, press Hard.</p>
                            </div>
                            <div className="callout-box callout-box-danger" style={{ margin: '4px 0' }}>
                                <strong style={{ fontSize: '12px', color: 'var(--md-text-high)' }}>4. Letting Overdue
                                    Cards
                                    Pile
                                    Up</strong>
                                <p style={{ fontSize: '11.5px', marginTop: '2px' }}>If you let 50 reviews pile up, your
                                    retrievability drops across all cards. Review 5–10 cards daily instead of 50
                                    once a
                                    month.</p>
                            </div>
                            <div className="callout-box callout-box-danger" style={{ margin: '4px 0' }}>
                                <strong style={{ fontSize: '12px', color: 'var(--md-text-high)' }}>5. Cramming Outside the
                                    Schedule</strong>
                                <p style={{ fontSize: '11.5px', marginTop: '2px' }}>Reviewing cards early yields minimal
                                    stability gains because memory decay hasn't occurred yet.</p>
                            </div>
                            <div className="callout-box callout-box-danger" style={{ margin: '4px 0' }}>
                                <strong style={{ fontSize: '12px', color: 'var(--md-text-high)' }}>6. Unrealistic Target
                                    Retention
                                    (e.g. 98%)</strong>
                                <p style={{ fontSize: '11.5px', marginTop: '2px' }}>Setting target retention to 97%+ in
                                    settings
                                    exponentially multiplies your daily review workload for marginal recall gain.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* 10. User Controls vs. AlgoRecall Engine Decisions */}
                    <div className="card mb-4">
                        <h3>⚖️ User Controls vs. AlgoRecall Engine Responsibilities</h3>
                        <p style={{ fontSize: '12.5px', color: 'var(--md-text-med)', marginBottom: '10px' }}>
                            To eliminate confusion about what is automatic versus what you control:
                        </p>

                        <div className="fsrs-table-container">
                            <table className="fsrs-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: '50%' }}>🧑‍💻 What You Control (User Agency)</th>
                                        <th style={{ width: '50%' }}>🤖 What AlgoRecall Engine Automates</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td>Writing clear, pattern-focused approach notes.</td>
                                        <td>Auto-detecting problem titles, URLs, and topic tags.</td>
                                    </tr>
                                    <tr>
                                        <td>Engaging in active mental retrieval before revealing notes.</td>
                                        <td>Hiding approach notes until you explicitly press <kbd>Space</kbd>.</td>
                                    </tr>
                                    <tr>
                                        <td>Providing an honest rating (Again, Hard, Good, Easy).</td>
                                        <td>Interpreting ratings mathematically into Stability and Difficulty
                                            updates.
                                        </td>
                                    </tr>
                                    <tr>
                                        <td>Initiating review sessions when badges or notifications appear.</td>
                                        <td>Tracking <code>due &le; now</code> and ordering the queue by urgency.
                                        </td>
                                    </tr>
                                    <tr>
                                        <td>Correcting misclicked ratings within 60 seconds.</td>
                                        <td>Maintaining exact <code>preState</code> snapshots for seamless
                                            rollbacks.
                                        </td>
                                    </tr>
                                    <tr>
                                        <td>Configuring target retention (e.g. 88%) and topic weights.</td>
                                        <td>Optimizing power-law interval calculations and memory decay curves.</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* 11. Frequently Asked Questions (FAQ) */}
                    <div className="card mb-4">
                        <h3>❓ Frequently Asked Questions (FAQ)</h3>
                        <div className="faq-grid">
                            <div className="faq-card">
                                <div className="faq-q">
                                    <span className="faq-icon">Q:</span>
                                    <span>Why did my card come back for review just 1–5 minutes after I created
                                        it?</span>
                                </div>
                                <p className="faq-a">
                                    When you logged the card in the floating widget, you pressed 🔴
                                    <strong>Again</strong>
                                    or 🟡 <strong>Hard</strong>. In the AlgoRecall Engine, this immediately initiates
                                    Stage 1 (<span className="state-badge state-badge-learning">Learning</span> practice
                                    mode).
                                    Learning
                                    cards use short-interval steps (~1–5 minutes) to ensure initial memory encoding
                                    before
                                    graduating to multi-day intervals.
                                </p>
                            </div>

                            <div className="faq-card">
                                <div className="faq-q">
                                    <span className="faq-icon">Q:</span>
                                    <span>Why is my newly created card not listed under the "New" stage in my
                                        dashboard?</span>
                                </div>
                                <div className="faq-a">
                                    <p style={{ margin: '0 0 8px 0' }}>
                                        In traditional flashcard apps, you type cards into a database days before
                                        studying them. In
                                        <strong>AlgoRecall</strong>, you log cards in-page right after attempting a
                                        problem on
                                        LeetCode or AlgoMonster. Because you just solved or attempted the problem, the
                                        floating bar prompt
                                        reads:
                                    </p>
                                    <div className="callout-box"
                                        style={{ margin: '10px 0', background: 'rgba(168, 199, 250, 0.08)', borderLeftColor: 'var(--md-primary)' }}>
                                        <p
                                            style={{ fontSize: '12px', fontWeight: '700', color: 'var(--md-text-high)', marginBottom: '4px' }}>
                                            <code>Save &amp; Rate Initial Difficulty: [Again] [Hard] [Good] [Easy]</code>
                                        </p>
                                        <p style={{ fontSize: '12px', color: 'var(--md-text-med)', margin: '0' }}>
                                            When you click one of these buttons, the extension creates the card
                                            (internally
                                            <code>State.New</code>) and <strong>immediately applies your selected button
                                                as your
                                                first review</strong>!
                                        </p>
                                    </div>
                                    <ul className="help-bullet-list" style={{ marginTop: '8px', fontSize: '12px' }}>
                                        <li>If you press 🔴 <strong>Again</strong> or 🟡 <strong>Hard</strong>: The card
                                            immediately
                                            moves from <code>New</code> → <span
                                                className="state-badge state-badge-learning">📖
                                                Learning</span> (short practice check-in in ~1–10 minutes).</li>
                                        <li>If you press 🟢 <strong>Good</strong> or 🔵 <strong>Easy</strong>: The card
                                            immediately
                                            graduates from <code>New</code> → <span
                                                className="state-badge state-badge-review">🏆
                                                Review</span> (long-term memory, due in 1–4+ days).</li>
                                    </ul>
                                    <p
                                        style={{ fontSize: '12px', color: 'var(--md-text-low)', margin: '8px 0 0 0', fontStyle: 'italic' }}>
                                        Result: Cards do not sit idle in the unstudied "New" stage; the AlgoRecall
                                        Engine immediately
                                        schedules your
                                        next review date from your very first click!
                                    </p>
                                </div>
                            </div>

                            <div className="faq-card">
                                <div className="faq-q">
                                    <span className="faq-icon">Q:</span>
                                    <span>What does "Graduated" or "Mastered" mean in AlgoRecall?</span>
                                </div>
                                <p className="faq-a">
                                    A card is considered <strong>Graduated</strong> when it has completed
                                    practice/relearning and achieved a memory stability of <strong>greater than 7
                                        days</strong> (<code>stability &gt; 7</code>). In analytics and badges, these
                                    cards
                                    count as established long-term knowledge.
                                </p>
                            </div>

                            <div className="faq-card">
                                <div className="faq-q">
                                    <span className="faq-icon">Q:</span>
                                    <span>What happens if I take a vacation and miss reviewing for a week?</span>
                                </div>
                                <p className="faq-a">
                                    Don't panic! The AlgoRecall Engine does not delete your cards or wipe out your
                                    progress. Due
                                    cards
                                    simply
                                    accumulate in your review queue sorted by due date. When you return, review them
                                    at
                                    your
                                    own pace. If you still remember an overdue card, the AlgoRecall Engine will actually
                                    reward it
                                    with a
                                    higher stability gain!
                                </p>
                            </div>

                            <div className="faq-card">
                                <div className="faq-q">
                                    <span className="faq-icon">Q:</span>
                                    <span>If I answer "Again", does the AlgoRecall Engine reset my card back to
                                        zero?</span>
                                </div>
                                <p className="faq-a">
                                    No! Unlike older SM-2 systems that wiped out all historical progress, the AlgoRecall
                                    Engine
                                    remembers
                                    that you previously mastered the problem. It temporarily drops stability and
                                    places
                                    the
                                    card into <span className="state-badge state-badge-relearning">Relearning</span>,
                                    but
                                    once
                                    you complete a quick refresher check, stability recovers much faster than
                                    starting
                                    from
                                    scratch.
                                </p>
                            </div>

                            <div className="faq-card">
                                <div className="faq-q">
                                    <span className="faq-icon">Q:</span>
                                    <span>Why do two cards reviewed on the same day have different next review
                                        dates?</span>
                                </div>
                                <p className="faq-a">
                                    The AlgoRecall Engine calculates dates independently for every card based on its
                                    historical
                                    repetition
                                    count, inherent difficulty rating, topic weights, and past lapses. A simple Hash
                                    Map
                                    problem will naturally have higher stability than an advanced Dynamic
                                    Programming
                                    problem.
                                </p>
                            </div>

                            <div className="faq-card">
                                <div className="faq-q">
                                    <span className="faq-icon">Q:</span>
                                    <span>What happens if I accidentally click the wrong rating button?</span>
                                </div>
                                <p className="faq-a">
                                    AlgoRecall features built-in <strong>Algorithmic Debouncing & Misclick
                                        Correction</strong>. If you click the intended rating button within 60
                                    seconds,
                                    the
                                    extension automatically rolls back to the card's previous snapshot and
                                    recalculates
                                    cleanly with your corrected rating.
                                </p>
                            </div>

                            <div className="faq-card">
                                <div className="faq-q">
                                    <span className="faq-icon">Q:</span>
                                    <span>Should I review cards before they are due?</span>
                                </div>
                                <p className="faq-a">
                                    Generally, no. Spaced repetition works because memory consolidation occurs right
                                    as
                                    memory traces begin to decay. Reviewing cards when retrievability is near 100%
                                    produces
                                    negligible stability increases and adds unnecessary workload.
                                </p>
                            </div>

                            <div className="faq-card">
                                <div className="faq-q">
                                    <span className="faq-icon">Q:</span>
                                    <span>Can I remove or delete a card I no longer want to practice?</span>
                                </div>
                                <p className="faq-a">
                                    Yes. You can click the <strong>Remove</strong> button directly inside the
                                    floating
                                    in-page tracker, or use the <strong>Data Dashboard</strong> (<a href="#"
                                        data-switch-tab="advanced"
                                        style={{ color: 'var(--md-primary)', textDecoration: 'underline' }}>Advanced
                                        Tab</a>) to
                                    search, filter, and delete cards individually or in bulk.
                                </p>
                            </div>

                            <div className="faq-card">
                                <div className="faq-q">
                                    <span className="faq-icon">Q:</span>
                                    <span>Does the AlgoRecall Engine guarantee I will never forget a problem?</span>
                                </div>
                                <p className="faq-a">
                                    Spaced repetition is probabilistic, not absolute. With the default 88% retention
                                    setting, you are mathematically expected to remember ~88 out of 100 problems
                                    when
                                    they
                                    become due. The other 12% trigger lapses (refresher rounds), which identify your
                                    weak
                                    spots and reinforce them.
                                </p>
                            </div>

                            <div className="faq-card">
                                <div className="faq-q">
                                    <span className="faq-icon">Q:</span>
                                    <span>How does the floating review queue determine which card to show
                                        next?</span>
                                </div>
                                <p className="faq-a">
                                    The review queue filters for all cards where <code>due &le; now</code> and sorts
                                    them
                                    ascending by due date (<code>a.due - b.due</code>). This ensures the most
                                    overdue
                                    cards
                                    are always shown first. You can also filter the session by specific topic tags
                                    (e.g.
                                    Graphs, Trees).
                                </p>
                            </div>

                            <div className="faq-card">
                                <div className="faq-q">
                                    <span className="faq-icon">Q:</span>
                                    <span>How can I customize my target retention or algorithm weights?</span>
                                </div>
                                <p className="faq-a">
                                    Open the extension popup, click the settings gear, and open <strong>AlgoRecall
                                        Engine
                                        Settings</strong>. You can adjust your target retention rate (0.70 to
                                    0.98),
                                    tune
                                    custom weights per topic tag, or train optimized parameters once you have logged
                                    50+
                                    reviews.
                                </p>
                            </div>
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
                <h2>⚙️ AlgoRecall Engine Customizer, Anki & Data Disclosures</h2>
                <p className="section-intro">
                    Advanced configuration options, custom FSRS weight parameters, bi-directional Anki synchronization, and legal licensing disclosures.
                </p>

                <div className="card card-accent mb-4">
                    <h3>🧠 Understanding AlgoRecall Engine Parameters (<i>w</i><sub>0</sub> – <i>w</i><sub>16</sub>)</h3>
                    <p>The AlgoRecall Engine uses 17 coefficients to compute memory stability updates upon grading:</p>
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

