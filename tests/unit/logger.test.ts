import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { Logger } from '../../features/common/logger';

describe('Logger', () => {
  beforeEach(() => {
    jest.spyOn(console, 'debug').mockImplementation(() => {});
    jest.spyOn(console, 'info').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'group').mockImplementation(() => {});
    jest.spyOn(console, 'groupEnd').mockImplementation(() => {});
    jest.spyOn(console, 'time').mockImplementation(() => {});
    jest.spyOn(console, 'timeEnd').mockImplementation(() => {});

    jest.spyOn(Logger as any, '_flushLogs').mockImplementation(async () => {});

    (Logger as any).devMode = true;
    (Logger as any).logQueue = [];
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('logs debug messages when devMode is true', () => {
    Logger.debug('TestModule', 'test message', { data: 1 });
    expect(console.debug).toHaveBeenCalled();
    expect((Logger as any).logQueue.length).toBe(1);
  });

  it('does not log debug messages when devMode is false', () => {
    (Logger as any).devMode = false;
    Logger.debug('TestModule', 'test message');
    expect(console.debug).not.toHaveBeenCalled();
    expect((Logger as any).logQueue.length).toBe(0);
  });

  it('always logs error messages regardless of devMode', () => {
    (Logger as any).devMode = false;
    Logger.error('TestModule', 'test error', new Error('Something went wrong'));
    expect(console.error).toHaveBeenCalled();
    expect((Logger as any).logQueue.length).toBe(1);
    expect((Logger as any).logQueue[0].level).toBe('ERROR');
  });

  it('logs fatal messages properly', () => {
    (Logger as any).devMode = false;
    Logger.fatal('TestModule', 'critical failure');
    expect(console.error).toHaveBeenCalled();
    expect((Logger as any).logQueue.length).toBe(1);
    expect((Logger as any).logQueue[0].level).toBe('ERROR');
    expect((Logger as any).logQueue[0].message).toContain('FATAL: critical failure');
  });

  it('handles groups and timers', () => {
    Logger.group('TestModule', 'MyGroup');
    expect(console.group).toHaveBeenCalled();

    Logger.time('TestModule', 'MyTimer');
    expect(console.time).toHaveBeenCalled();

    Logger.timeEnd('TestModule', 'MyTimer');
    expect(console.timeEnd).toHaveBeenCalled();

    Logger.groupEnd();
    expect(console.groupEnd).toHaveBeenCalled();
  });

  it('silently ignores groups and timers in prod mode', () => {
    (Logger as any).devMode = false;
    Logger.group('TestModule', 'MyGroup');
    Logger.time('TestModule', 'MyTimer');
    Logger.timeEnd('TestModule', 'MyTimer');
    Logger.groupEnd();

    expect(console.group).not.toHaveBeenCalled();
    expect(console.time).not.toHaveBeenCalled();
    expect(console.timeEnd).not.toHaveBeenCalled();
    expect(console.groupEnd).not.toHaveBeenCalled();
  });

  it('logs info messages with data', () => {
    Logger.info('TestModule', 'info message', { key: 'value' });
    expect(console.info).toHaveBeenCalled();
    expect((Logger as any).logQueue.length).toBe(1);
  });

  it('logs info messages without data', () => {
    Logger.info('TestModule', 'info no data');
    expect(console.info).toHaveBeenCalled();
  });

  it('logs warn messages with data', () => {
    Logger.warn('TestModule', 'warn message', { extra: 42 });
    expect(console.warn).toHaveBeenCalled();
  });

  it('logs warn messages without data', () => {
    Logger.warn('TestModule', 'warn no data');
    expect(console.warn).toHaveBeenCalled();
  });

  it('does not log warn messages when devMode is false', () => {
    (Logger as any).devMode = false;
    Logger.warn('TestModule', 'hidden warn');
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('does not log info messages when devMode is false', () => {
    (Logger as any).devMode = false;
    Logger.info('TestModule', 'hidden info');
    expect(console.info).not.toHaveBeenCalled();
  });

  it('logs error with Error instance properly', () => {
    (Logger as any).devMode = false;
    Logger.error('TestModule', 'error occurred', new Error('fail'));
    expect(console.error).toHaveBeenCalled();
  });

  it('logs error with plain object data', () => {
    (Logger as any).devMode = false;
    Logger.error('TestModule', 'error with data', { detail: 123 });
    expect(console.error).toHaveBeenCalled();
  });

  it('logs debug messages without data', () => {
    Logger.debug('TestModule', 'debug no data');
    expect(console.debug).toHaveBeenCalled();
  });

  it('getBufferedLogs returns accumulated logs', () => {
    Logger.debug('TestModule', 'buffered log');
    const logs = Logger.getBufferedLogs();
    expect(Array.isArray(logs)).toBe(true);
  });

  it('clearBufferedLogs empties the buffer', () => {
    Logger.debug('TestModule', 'to be cleared');
    Logger.clearBufferedLogs();
    const logs = Logger.getBufferedLogs();
    expect(logs.length).toBe(0);
  });

  it('timer tracks duration and cleans up', () => {
    Logger.time('TestModule', 'perfTimer');
    Logger.timeEnd('TestModule', 'perfTimer');
    expect(console.time).toHaveBeenCalled();
    expect(console.timeEnd).toHaveBeenCalled();
    expect(console.debug).toHaveBeenCalled(); // debug for completion log
  });

  it('timeEnd does nothing for unknown timer', () => {
    Logger.timeEnd('TestModule', 'unknownTimer');
    // Should not throw, just returns early
    expect(console.timeEnd).not.toHaveBeenCalled();
  });
});
