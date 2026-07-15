const { Logger } = require('../../features/common/logger.js');

describe('Logger', () => {
    beforeEach(() => {
        // Mock console methods
        jest.spyOn(console, 'debug').mockImplementation(() => {});
        jest.spyOn(console, 'info').mockImplementation(() => {});
        jest.spyOn(console, 'warn').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
        jest.spyOn(console, 'group').mockImplementation(() => {});
        jest.spyOn(console, 'groupEnd').mockImplementation(() => {});
        jest.spyOn(console, 'time').mockImplementation(() => {});
        jest.spyOn(console, 'timeEnd').mockImplementation(() => {});

        // Prevent flushing to test queue accumulation
        jest.spyOn(Logger, '_flushLogs').mockImplementation(async () => {});

        // Reset Logger state
        Logger.devMode = true;
        Logger.logQueue = [];
        jest.clearAllMocks();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('logs debug messages when devMode is true', () => {
        Logger.debug('TestModule', 'test message', { data: 1 });
        expect(console.debug).toHaveBeenCalled();
        expect(Logger.logQueue.length).toBe(1);
    });

    it('does not log debug messages when devMode is false', () => {
        Logger.devMode = false;
        Logger.debug('TestModule', 'test message');
        expect(console.debug).not.toHaveBeenCalled();
        expect(Logger.logQueue.length).toBe(0);
    });

    it('always logs error messages regardless of devMode', () => {
        Logger.devMode = false;
        Logger.error('TestModule', 'test error', new Error('Something went wrong'));
        expect(console.error).toHaveBeenCalled();
        expect(Logger.logQueue.length).toBe(1);
        expect(Logger.logQueue[0].level).toBe('ERROR');
    });

    it('logs fatal messages properly', () => {
        Logger.devMode = false;
        Logger.fatal('TestModule', 'critical failure');
        expect(console.error).toHaveBeenCalled();
        expect(Logger.logQueue.length).toBe(1);
        expect(Logger.logQueue[0].level).toBe('ERROR');
        expect(Logger.logQueue[0].message).toContain('FATAL: critical failure');
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
        Logger.devMode = false;
        Logger.group('TestModule', 'MyGroup');
        Logger.time('TestModule', 'MyTimer');
        Logger.timeEnd('TestModule', 'MyTimer');
        Logger.groupEnd();

        expect(console.group).not.toHaveBeenCalled();
        expect(console.time).not.toHaveBeenCalled();
        expect(console.timeEnd).not.toHaveBeenCalled();
        expect(console.groupEnd).not.toHaveBeenCalled();
    });
});
