import { describe, it, expect } from '@jest/globals';
import { generateSummaryReport } from '../../../../../features/dashboard/summary/summaryGenerator';
import { Card } from '../../../../../types/domain';

describe('summaryGenerator Utility', () => {
  const fixedNow = new Date('2026-08-03T12:00:00Z').getTime();

  const sampleCards: Card[] = [
    {
      id: 'card-1',
      problemTitle: 'Two Sum',
      problemUrl: 'https://leetcode.com/problems/two-sum',
      due: fixedNow + 86400000,
      stability: 5.5,
      difficulty: 4.2,
      elapsedDays: 2,
      scheduledDays: 5,
      reps: 4,
      lapses: 0,
      state: 2,
      tags: ['Array', 'Hash Table'],
      historyLog: [
        { date: fixedNow - 2 * 86400000, rating: 3 },
        { date: fixedNow - 5 * 86400000, rating: 3 },
        { date: fixedNow - 10 * 86400000, rating: 4 }
      ]
    } as unknown as Card,
    {
      id: 'card-2',
      problemTitle: 'Course Schedule',
      problemUrl: 'https://leetcode.com/problems/course-schedule',
      due: fixedNow - 3600000,
      stability: 1.2,
      difficulty: 8.1,
      elapsedDays: 1,
      scheduledDays: 1,
      reps: 5,
      lapses: 3,
      state: 3,
      tags: ['Graph', 'BFS'],
      historyLog: [
        { date: fixedNow - 1 * 86400000, rating: 1 },
        { date: fixedNow - 3 * 86400000, rating: 2 }
      ]
    } as unknown as Card
  ];

  const sampleActivity = {
    '2026-08-03': 1,
    '2026-08-02': 2,
    '2026-08-01': 1,
    '2026-07-30': 1
  };

  it('generates weekly summary report accurately', () => {
    const report = generateSummaryReport(sampleCards, sampleActivity, 'weekly', fixedNow);

    expect(report.period).toBe('weekly');
    expect(report.periodLabel).toBe('Weekly Digest');
    expect(report.totalDaysInPeriod).toBe(7);

    expect(report.totalReviews).toBe(4);
    expect(report.retentionRate).toBe(75);
    expect(report.leechCount).toBe(1);

    expect(report.weakestTopics.length).toBeGreaterThan(0);
    const graphTopic = report.weakestTopics.find(t => t.tag === 'Graph');
    expect(graphTopic).toBeDefined();
    expect(graphTopic?.retentionRate).toBe(50);
  });

  it('generates monthly summary report accurately', () => {
    const report = generateSummaryReport(sampleCards, sampleActivity, 'monthly', fixedNow);

    expect(report.period).toBe('monthly');
    expect(report.periodLabel).toBe('Monthly Digest');
    expect(report.totalDaysInPeriod).toBe(30);

    expect(report.totalReviews).toBe(5);
    expect(report.activeDays).toBeGreaterThan(0);
  });

  it('handles empty cards and empty activity gracefully', () => {
    const report = generateSummaryReport([], {}, 'weekly', fixedNow);

    expect(report.totalReviews).toBe(0);
    expect(report.retentionRate).toBe(100);
    expect(report.leechCount).toBe(0);
    expect(report.newCardsLearned).toBe(0);
    expect(report.insights.some(i => i.title === 'Quiet Study Period')).toBe(true);
  });
});
