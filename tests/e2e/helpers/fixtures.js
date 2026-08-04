/**
 * @file tests/e2e/helpers/fixtures.js
 * @description Canonical mock data fixtures for E2E tests.
 * Provides diverse card states (New, Learning, Review, Relearning), highlight marks,
 * notification settings, activity data, and FSRS parameters for deterministic testing.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// --- FSRS Card Fixtures ---

/** Card in "New" state — never reviewed */
const newCard = {
  id: 'card-new-001',
  problemTitle: 'Contains Duplicate',
  problemUrl: 'https://leetcode.com/problems/contains-duplicate/',
  tags: ['Array', 'Hash Table', 'Sorting'],
  state: 0,
  stability: 0,
  difficulty: 0,
  reps: 0,
  lapses: 0,
  lastReview: 0,
  due: 0,
  historyLog: [],
  approach: '',
  timeComplexity: '',
  spaceComplexity: ''
};

/** Card in "Learning" state (state=1) — 1 review done */
const learningCard = {
  id: 'card-learn-001',
  problemTitle: 'LRU Cache Design',
  problemUrl: 'https://leetcode.com/problems/lru-cache/',
  tags: ['Design', 'Doubly Linked List', 'Hash Map'],
  state: 1,
  stability: 5.0,
  difficulty: 6.8,
  reps: 1,
  lapses: 1,
  lastReview: Date.now() - (1 * MS_PER_DAY),
  due: Date.now() - (1000 * 60 * 30), // Due 30 min ago
  historyLog: [{ date: Date.now() - (1 * MS_PER_DAY), rating: 2 }],
  approach: 'Combine HashMap with Doubly LinkedList for O(1) ops.',
  timeComplexity: 'O(1)',
  spaceComplexity: 'O(capacity)'
};

/** Card in "Review" state (state=2) — stable, multiple reviews */
const reviewCard = {
  id: 'card-review-001',
  problemTitle: 'Two Sum',
  problemUrl: 'https://leetcode.com/problems/two-sum/',
  tags: ['Array', 'Hash Table'],
  state: 2,
  stability: 14.5,
  difficulty: 4.2,
  reps: 3,
  lapses: 0,
  lastReview: Date.now() - (2 * MS_PER_DAY),
  due: Date.now() - (1000 * 60 * 60), // Due 1h ago
  historyLog: [
    { date: Date.now() - (14 * MS_PER_DAY), rating: 3 },
    { date: Date.now() - (7 * MS_PER_DAY), rating: 3 },
    { date: Date.now() - (2 * MS_PER_DAY), rating: 4 }
  ],
  approach: 'Use a hash map to store complements for single pass lookup.',
  timeComplexity: 'O(n)',
  spaceComplexity: 'O(n)'
};

/** Card in "Relearning" state (state=3) — lapsed, high difficulty */
const relearningCard = {
  id: 'card-relearn-001',
  problemTitle: 'Sliding Window Maximum',
  problemUrl: 'https://leetcode.com/problems/sliding-window-maximum/',
  tags: ['Monotonic Queue', 'Array', 'Sliding Window'],
  state: 3,
  stability: 2.1,
  difficulty: 8.9,
  reps: 6,
  lapses: 3,
  lastReview: Date.now() - (12 * 60 * 60 * 1000),
  due: Date.now() + (2 * MS_PER_DAY),
  historyLog: [
    { date: Date.now() - (30 * MS_PER_DAY), rating: 1 },
    { date: Date.now() - (15 * MS_PER_DAY), rating: 2 },
    { date: Date.now() - (12 * 60 * 60 * 1000), rating: 1 }
  ],
  approach: 'Maintain monotonic decreasing double-ended queue of indices.',
  timeComplexity: 'O(n)',
  spaceComplexity: 'O(k)'
};

/** Card with future due date — not yet due */
const futureCard = {
  id: 'card-future-001',
  problemTitle: 'Merge K Sorted Lists',
  problemUrl: 'https://leetcode.com/problems/merge-k-sorted-lists/',
  tags: ['Heap', 'Linked List', 'Divide and Conquer'],
  state: 2,
  stability: 22.0,
  difficulty: 5.0,
  reps: 5,
  lapses: 0,
  lastReview: Date.now() - (4 * MS_PER_DAY),
  due: Date.now() + (18 * MS_PER_DAY),
  historyLog: [{ date: Date.now() - (4 * MS_PER_DAY), rating: 4 }],
  approach: 'Min-heap priority queue storing current node heads.',
  timeComplexity: 'O(N log k)',
  spaceComplexity: 'O(k)'
};

/** All cards as a combined fixture set */
const allCards = [newCard, learningCard, reviewCard, relearningCard, futureCard];

// --- Highlight Marks Fixtures ---

const mockMarks = [
  {
    id: 'hl-101',
    url: 'https://leetcode.com/problems/two-sum/',
    text: 'Hash Map single-pass lookup guarantees O(n) runtime.',
    color: '#ffeb3b',
    type: 'highlight',
    createdAt: Date.now() - 100000,
    note: 'Key insight for array lookup',
    category: 'Key Insight',
    highlightSource: {
      startMeta: { parentTagName: 'p', parentIndex: 0, textOffset: 0, parentDomPath: [0, 1] },
      endMeta: { parentTagName: 'p', parentIndex: 0, textOffset: 48, parentDomPath: [0, 1] }
    }
  },
  {
    id: 'hl-102',
    url: 'https://leetcode.com/problems/binary-search/',
    text: 'Always check boundary condition left <= right.',
    color: '#4caf50',
    type: 'highlight',
    createdAt: Date.now() - 50000,
    note: 'Off-by-one prevention',
    category: 'Gotcha',
    highlightSource: {
      startMeta: { parentTagName: 'p', parentIndex: 0, textOffset: 0, parentDomPath: [0, 2] },
      endMeta: { parentTagName: 'p', parentIndex: 0, textOffset: 46, parentDomPath: [0, 2] }
    }
  }
];

// --- Chrome Settings Fixtures ---

const mockChromeSettings = {
  defaultHighlightColor: '#ffeb3b',
  recentColors: ['#ffeb3b', '#e74c3c', '#3498db', '#2ecc71', '#9b59b6'],
  showMarkerPopup: true,
  showCharts: true,
  activePaletteIndex: 0,
  palettes: [
    { name: 'Default', colors: ['#ffeb3b', '#e74c3c', '#3498db', '#2ecc71', '#9b59b6'] },
    { name: 'Warm Pastels', colors: ['#ffadad', '#ffd6a5', '#fdffb6', '#caffbf', '#9bf6ff'] }
  ]
};

// --- Notification Settings Fixtures ---

const mockNotificationSettings = {
  enabled: true,
  frequency: '60',
  priority: '2',
  requireInteraction: true,
  quietHoursEnabled: false,
  quietHoursStart: '23:00',
  quietHoursEnd: '07:00'
};

// --- Activity Data Fixtures (7-day streak) ---

function buildActivityData(days = 30) {
  const activity = {};
  for (let i = 0; i < days; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const key = date.toISOString().split('T')[0];
    activity[key] = Math.floor(Math.random() * 10) + 3;
  }
  return activity;
}

const mockActivity7Days = buildActivityData(7);

// --- FSRS Global Parameters Fixture ---

const mockFsrsParams = {
  requestRetention: 0.90,
  decay: -0.5,
  factor: 0.234567,
  maximumInterval: 36500,
  w: [0.4, 0.6, 2.4, 5.8, 4.93, 0.94, 0.86, 0.01, 1.49, 0.14, 0.94, 2.18, 0.05, 0.34, 1.26, 0.29, 2.61]
};

// --- Bookmarks & Drafts Fixtures ---

const mockBookmarks = [
  { url: 'https://leetcode.com/problems/3sum/', title: '3Sum Triplet Target' }
];

const mockApproachDrafts = {
  'https://leetcode.com/problems/3sum/': {
    approach: 'Sort the array, iterate with fixed pointer, use two pointers for remaining target.',
    timeComplexity: 'O(n^2)',
    spaceComplexity: 'O(1)'
  }
};

// --- Whitelisted Websites ---

const defaultWhitelistedSites = [
  { domain: 'algo.monster' },
  { domain: 'systemdesignschool.io' },
  { domain: 'leetcode.com' },
  { domain: 'codeforces.com' },
  { domain: 'codechef.com' },
  { domain: 'atcoder.jp' },
  { domain: 'hackerrank.com' },
  { domain: 'hackerearth.com' },
  { domain: 'codewars.com' },
  { domain: 'codingame.com' }
];

module.exports = {
  // Individual card fixtures
  newCard,
  learningCard,
  reviewCard,
  relearningCard,
  futureCard,
  allCards,

  // Highlight fixtures
  mockMarks,

  // Settings fixtures
  mockChromeSettings,
  mockNotificationSettings,
  mockFsrsParams,
  defaultFsrsParams: mockFsrsParams,

  // Activity fixtures
  mockActivity7Days,
  buildActivityData,

  // Data fixtures
  mockBookmarks,
  mockApproachDrafts,
  defaultWhitelistedSites,

  // Time constants
  MS_PER_DAY
};
