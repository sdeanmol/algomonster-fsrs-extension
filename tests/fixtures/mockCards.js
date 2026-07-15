module.exports = [
  {
    id: "uuid-1",
    problemTitle: "Two Sum",
    problemUrl: "https://leetcode.com/problems/two-sum/",
    tags: ["Array", "Hash Table"],
    state: 0, // 0 = New
    stability: 0,
    difficulty: 0,
    reps: 0,
    lapses: 0,
    lastReview: 0,
    historyLog: [],
    approach: "Use a hash map to store complements"
  },
  {
    id: "uuid-2",
    problemTitle: "LRU Cache",
    problemUrl: "https://leetcode.com/problems/lru-cache/",
    tags: ["Design", "Linked List"],
    state: 2, // 2 = Review
    stability: 20,
    difficulty: 5.5,
    reps: 3,
    lapses: 1,
    lastReview: Date.now() - (5 * 24 * 60 * 60 * 1000), // 5 days ago
    historyLog: [{ date: Date.now() - (5 * 24 * 60 * 60 * 1000), rating: 3 }],
    approach: "Double linked list + Hash map"
  }
];
