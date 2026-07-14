/**
 * @file content/state.js
 * @description Global state manager declarations shared across the content script scope.
 * Injected sequentially by manifest.json before other script files (utils, highlighter, tracker, content)
 * to act as a shared memory layer on targeted domains.
 * Upstream dependencies: features/tracker/fsrs.js (instantiates FSRS class).
 * Downstream dependencies: content/utils.js, features/highlighter/highlighter.js, content/notifications.js, features/tracker/tracker.js, content/content.js.
 */

// Instantiated FSRS algorithm controller
const fsrs = new FSRS();

// Active collection of study cards/patterns loaded from storage
let cards = [];

// URL caching to prevent duplicate triggers on SPA change transitions
let lastCheckedUrl = window.location.href;

// Optional tag weights profile mappings
let topicWeights = {};

// Active theme indicator
let currentTheme = 'dark';

// --- Highlighter State ---
// Saved user text highlight models
let marks = [];

// Saved page bookmarks
let bookmarks = [];

// Injected notes/highlights content collections
let pagecontents = [];

// User settings layout preferences
let chromeSettings = {
    defaultHighlightColor: '#f1c40f',
    recentColors: ['#f1c40f', '#e74c3c', '#3498db', '#2ecc71', '#9b59b6'],
    showMarkerPopup: true,
    activePaletteIndex: 0,
    palettes: [
        { name: 'Default', colors: ['#f1c40f', '#e74c3c', '#3498db', '#2ecc71', '#9b59b6'] },
        { name: 'Warm Pastels', colors: ['#ffadad', '#ffd6a5', '#fdffb6', '#caffbf', '#9bf6ff'] },
        { name: 'Ocean Breeze', colors: ['#a8dadc', '#457b9d', '#1d3557', '#e63946', '#f1faee'] },
        { name: 'Forest Moss', colors: ['#2d6a4f', '#40916c', '#52b788', '#74c69d', '#95d5b2'] },
        { name: 'Sunset Glow', colors: ['#f72585', '#7209b7', '#3f0712', '#f77f00', '#fcbf49'] }
    ]
};

// Set tracking registered custom CSS Highlights to avoid double DOM element styling
let activeHighlightStyles = new Set();

// Debounce timer ID for dynamic layout observer highlights updates
let highlightDebounceTimer = null;

// Active ranges map for Hover tracking
let activeMarkRanges = [];
let hoveredMarkId = null;
let hideTooltipTimer = null;

