import { describe, it, expect, jest, beforeEach } from '@jest/globals';

describe('content/state.ts', () => {
  beforeEach(() => {
    delete (window as any).AlgoRecall;
    delete (window as any).FsrsScheduler;
    jest.resetModules();
  });

  it('initializes window.AlgoRecall.state with fallback scheduler when FsrsScheduler is undefined', async () => {
    delete (window as any).FsrsScheduler;

    await import('../../../content/state');

    const algoRecall = (window as any).AlgoRecall;
    expect(algoRecall).toBeDefined();
    expect(algoRecall.state).toBeDefined();
    expect(algoRecall.state.cards).toEqual([]);
    expect(algoRecall.state.currentTheme).toBe('dark');
    expect(algoRecall.state.chromeSettings.defaultHighlightColor).toBe('#f1c40f');
    expect(algoRecall.state.chromeSettings.palettes.length).toBe(5);
  });

  it('instantiates FsrsScheduler when window.FsrsScheduler constructor is present', async () => {
    class MockFsrsScheduler {
      name = 'MockFsrsScheduler';
    }
    (window as any).FsrsScheduler = MockFsrsScheduler;

    await import('../../../content/state');

    const algoRecall = (window as any).AlgoRecall;
    expect(algoRecall.state.scheduler).toBeInstanceOf(MockFsrsScheduler);
  });

  it('catches constructor exceptions and falls back to dummy scheduler instance', async () => {
    (window as any).FsrsScheduler = class ThrowingScheduler {
      constructor() {
        throw new Error('Scheduler instantiation error');
      }
    };

    await import('../../../content/state');

    const algoRecall = (window as any).AlgoRecall;
    expect(algoRecall.state).toBeDefined();
    expect(algoRecall.state.scheduler).toEqual({});
  });

  it('catches non-Error thrown exceptions in constructor', async () => {
    (window as any).FsrsScheduler = class ThrowingStringScheduler {
      constructor() {
        throw 'String error thrown';
      }
    };

    await import('../../../content/state');

    const algoRecall = (window as any).AlgoRecall;
    expect(algoRecall.state).toBeDefined();
    expect(algoRecall.state.scheduler).toEqual({});
  });
});
