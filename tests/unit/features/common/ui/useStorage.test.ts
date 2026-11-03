import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { renderHook, act } from '@testing-library/preact-hooks';
import { useStorage } from '../../../../../features/common/ui/hooks/useStorage';

// Simple mock for hook testing if testing-library is not installed
describe('useStorage Preact Hook', () => {
    beforeEach(() => {
        (global.chrome.storage.local.get as jest.Mock).mockImplementation((keys: any, cb?: any) => {
            const res = { testKey: 'initialValue' };
            if (cb) cb(res);
            return Promise.resolve(res);
        });
        (global.chrome.storage.local.set as jest.Mock).mockImplementation((data: any, cb?: any) => {
            if (cb) cb();
            return Promise.resolve();
        });
    });

    it('defines the hook function', () => {
        expect(typeof useStorage).toBe('function');
    });
});

