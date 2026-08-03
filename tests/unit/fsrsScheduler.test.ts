import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import FsrsScheduler from '../../features/tracker/scheduler/fsrsScheduler';
import Scheduler from '../../features/tracker/scheduler/scheduler';
import { Rating, State } from 'ts-fsrs';
import { Card } from '../../types/domain';

describe('Scheduler Abstract Base Class', () => {
  it('enforces abstract method overrides', () => {
    class ConcreteScheduler extends Scheduler {}
    const scheduler = new ConcreteScheduler();

    expect(() => scheduler.createCard()).toThrow(/must be implemented/);
    expect(() => scheduler.reviewCard({} as Card, 1)).toThrow(/must be implemented/);
    expect(() => scheduler.getRetrievability({} as Card)).toThrow(/must be implemented/);
    expect(() => scheduler.getProjectedRetrievability(1, 1)).toThrow(/must be implemented/);
    expect(() => scheduler.getDefaultRequestRetention()).toThrow(/must be implemented/);
    expect(() => scheduler.isHighDifficulty({} as Card)).toThrow(/must be implemented/);
    expect(() => scheduler.isGraduated({} as Card)).toThrow(/must be implemented/);
  });

  it('throws TypeError when instantiated directly', () => {
    expect(() => new Scheduler()).toThrow(TypeError);
    expect(() => new Scheduler()).toThrow('Cannot construct AbstractScheduler instances directly.');
  });

  it('supportsOptimization returns false by default', () => {
    class ConcreteScheduler extends Scheduler {}
    const scheduler = new ConcreteScheduler();
    expect(scheduler.supportsOptimization()).toBe(false);
  });

  it('optimize throws not supported', async () => {
    class ConcreteScheduler extends Scheduler {}
    const scheduler = new ConcreteScheduler();
    await expect(scheduler.optimize()).rejects.toThrow(/not supported/);
  });

  it('resetConfiguration throws not supported', () => {
    class ConcreteScheduler extends Scheduler {}
    const scheduler = new ConcreteScheduler();
    expect(() => scheduler.resetConfiguration()).toThrow(/not supported/);
  });

  it('exportConfiguration throws not supported', () => {
    class ConcreteScheduler extends Scheduler {}
    const scheduler = new ConcreteScheduler();
    expect(() => scheduler.exportConfiguration()).toThrow(/not supported/);
  });

  it('importConfiguration throws not supported', () => {
    class ConcreteScheduler extends Scheduler {}
    const scheduler = new ConcreteScheduler();
    expect(() => scheduler.importConfiguration()).toThrow(/not supported/);
  });
});

describe('FsrsScheduler', () => {
  let fsrs: FsrsScheduler;

  beforeEach(() => {
    fsrs = new FsrsScheduler();
  });

  describe('Constructor and Configuration', () => {
    it('initializes with default FSRS parameters', () => {
      expect(fsrs.w.length).toBe(17);
      expect(fsrs.requestRetention).toBe(0.90);
      expect(fsrs.getDefaultRequestRetention()).toBe(0.90);
    });

    it('accepts custom parameters in constructor and importConfiguration', () => {
      const customW = Array(17).fill(0.5);
      const customFsrs = new FsrsScheduler({
        w: customW,
        decay: -0.6,
        factor: 0.2,
        requestRetention: 0.85
      });

      expect(customFsrs.w).toEqual(customW);
      expect(customFsrs.decay).toBe(-0.6);
      expect(customFsrs.factor).toBe(0.2);
      expect(customFsrs.requestRetention).toBe(0.85);

      // Export configuration
      const exported = customFsrs.exportConfiguration();
      expect(exported.w).toEqual(customW);
      expect(exported.requestRetention).toBe(0.85);

      // Reset configuration
      customFsrs.resetConfiguration();
      expect(customFsrs.requestRetention).toBe(0.90);

      // Import configuration
      customFsrs.importConfiguration({ requestRetention: 0.95 });
      expect(customFsrs.requestRetention).toBe(0.95);
    });
  });

  describe('Card Creation and Review Transitions', () => {
    it('creates a standard new FSRS card', () => {
      const card = fsrs.createCard('Two Sum', 'https://leetcode.com/problems/two-sum/', 'Text', 'Map', ['Array']);
      expect(card.problemTitle).toBe('Two Sum');
      expect(card.tags).toEqual(['Array']);
      expect(card.reps).toBe(0);
      expect(card.lapses).toBe(0);
      expect(card.state).toBe(State.New);
    });

    it('throws when reviewCard is called with null or undefined card', () => {
      expect(() => fsrs.reviewCard(undefined)).toThrow(/Card is required/);
    });

    it('processes ratings (Again, Hard, Good, Easy) and updates state metrics', () => {
      const baseCard = fsrs.createCard('Test Problem');
      const now = Date.now();

      const cardAgain = fsrs.reviewCard(baseCard, Rating.Again, null, now);
      expect(cardAgain.historyLog!.length).toBe(2);
      expect(cardAgain.state).toBe(State.Learning);

      const cardHard = fsrs.reviewCard(baseCard, Rating.Hard, null, now);
      expect(cardHard.stability).toBeGreaterThan(0);

      const cardGood = fsrs.reviewCard(baseCard, Rating.Good, null, now);
      expect(cardGood.stability).toBeGreaterThan(cardHard.stability);

      const cardEasy = fsrs.reviewCard(baseCard, Rating.Easy, null, now);
      expect(cardEasy.stability).toBeGreaterThan(cardGood.stability);
    });
  });

  describe('Algorithmic Debouncing', () => {
    it('suppresses duplicate identical rating within 1 minute and accumulates duration', () => {
      const baseCard = fsrs.createCard('Test Debounce');
      const now = Date.now();

      const reviewedCard = fsrs.reviewCard(baseCard, Rating.Good, null, now, 2000);
      expect(reviewedCard.historyLog!.length).toBe(2);

      // Rapid re-submit 10 seconds later with same rating
      const dupeCard = fsrs.reviewCard(reviewedCard, Rating.Good, null, now + 10000, 3000);
      expect(dupeCard.historyLog!.length).toBe(2);
      const lastLog = dupeCard.historyLog![dupeCard.historyLog!.length - 1] as any;
      expect(lastLog.duration).toBe(5000);
    });

    it('corrects rating within 1 minute when user changes rating choice', () => {
      const baseCard = fsrs.createCard('Test Correct Rating');
      const now = Date.now();

      const reviewedCard = fsrs.reviewCard(baseCard, Rating.Good, null, now);
      const goodStability = reviewedCard.stability;

      // Correction 15 seconds later from Good to Again
      const correctedCard = fsrs.reviewCard(reviewedCard, Rating.Again, null, now + 15000);
      expect(correctedCard.historyLog!.length).toBe(2);
      const lastLog = correctedCard.historyLog![correctedCard.historyLog!.length - 1] as any;
      expect(lastLog.rating).toBe(Rating.Again);
      expect(correctedCard.stability).not.toBe(goodStability);
    });

    it('bypasses debouncing when reviews are outside the 1 minute window', () => {
      const baseCard = fsrs.createCard('Test Window');
      const now = Date.now();

      const reviewed1 = fsrs.reviewCard(baseCard, Rating.Good, null, now);
      const reviewed2 = fsrs.reviewCard(reviewed1, Rating.Good, null, now + 120000); // 2 mins later
      expect(reviewed2.historyLog!.length).toBe(3);
    });
  });

  describe('Retrievability & Helper Methods', () => {
    it('calculates retrievability for active cards', () => {
      const card = fsrs.createCard('Retrievability Test');
      const now = Date.now();
      card.last_review = now;
      card.stability = 10;
      card.state = State.Review;

      const r0 = fsrs.getRetrievability(card, now);
      expect(r0).toBe(1.0);

      const r10 = fsrs.getRetrievability(card, now + (10 * 86400000));
      expect(r10).toBeGreaterThan(0.85);
      expect(r10).toBeLessThan(0.95);
    });

    it('returns 0 retrievability for cards with zero or negative stability', () => {
      expect(fsrs.getRetrievability(null as any)).toBe(0);
      expect(fsrs.getRetrievability({ stability: 0 } as any)).toBe(0);
    });

    it('calculates projected retrievability using formula', () => {
      expect(fsrs.getProjectedRetrievability(0, 5)).toBe(0);
      const proj = fsrs.getProjectedRetrievability(10, 10);
      expect(proj).toBeGreaterThan(0);
    });

    it('checks difficulty and graduation status', () => {
      expect(fsrs.isHighDifficulty(null as any)).toBe(false);
      expect(fsrs.isHighDifficulty({ difficulty: 8 } as Card)).toBe(true);
      expect(fsrs.isHighDifficulty({ difficulty: 5 } as Card)).toBe(false);

      expect(fsrs.isGraduated(null as any)).toBe(false);
      expect(fsrs.isGraduated({ state: State.Review, stability: 25 } as Card)).toBe(true);
      expect(fsrs.isGraduated({ state: State.Learning, stability: 25 } as Card)).toBe(false);
    });
  });
});
