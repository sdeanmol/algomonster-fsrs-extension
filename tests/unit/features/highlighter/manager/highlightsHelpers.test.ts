import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { HighlightsHelpers } from '../../../../../features/highlighter/manager/highlights-helpers';

describe('HighlightsHelpers', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    HighlightsHelpers.onToast = undefined;
  });

  afterEach(() => {
    HighlightsHelpers.onToast = undefined;
  });

  describe('escapeHtml', () => {
    it('escapes special HTML characters', () => {
      const input = '<script>alert("xss")</script> & "quote"';
      const escaped = HighlightsHelpers.escapeHtml(input);
      expect(escaped).not.toContain('<script>');
      expect(escaped).toContain('&lt;script&gt;');
      expect(escaped).toContain('&amp;');
    });

    it('returns empty string for empty input', () => {
      expect(HighlightsHelpers.escapeHtml('')).toBe('');
    });
  });

  describe('highlightSearchMatch', () => {
    it('wraps query matches in <mark> tags', () => {
      const text = 'Quick brown fox jumps over lazy dog';
      const result = HighlightsHelpers.highlightSearchMatch(text, 'fox');
      expect(result).toBe('Quick brown <mark>fox</mark> jumps over lazy dog');
    });

    it('returns escaped text if query is empty', () => {
      const text = 'Plain <b>text</b>';
      const result = HighlightsHelpers.highlightSearchMatch(text, '');
      expect(result).toBe('Plain &lt;b&gt;text&lt;/b&gt;');
    });

    it('handles regex special characters safely', () => {
      const text = 'Cost is $10.00 (USD)';
      const result = HighlightsHelpers.highlightSearchMatch(text, '$10.00');
      expect(result).toContain('<mark>$10.00</mark>');
    });
  });

  describe('getCleanDisplayUrl', () => {
    it('extracts hostname and pathname from URL', () => {
      const url = 'https://algo.monster/problems/two_sum?ref=123#solution';
      expect(HighlightsHelpers.getCleanDisplayUrl(url)).toBe('algo.monster/problems/two_sum');
    });

    it('returns raw URL fallback on invalid URL', () => {
      const invalid = 'not-a-valid-url';
      expect(HighlightsHelpers.getCleanDisplayUrl(invalid)).toBe('not-a-valid-url');
    });
  });

  describe('copyToClipboard', () => {
    it('calls navigator.clipboard.writeText and shows success toast via onToast', async () => {
      const toastMock = jest.fn();
      HighlightsHelpers.onToast = toastMock;

      const writeTextMock = jest.fn().mockImplementation(() => Promise.resolve());
      Object.assign(navigator, {
        clipboard: {
          writeText: writeTextMock
        }
      });

      await HighlightsHelpers.copyToClipboard('Hello World');
      expect(writeTextMock).toHaveBeenCalledWith('Hello World');
      expect(toastMock).toHaveBeenCalledWith('Snippet copied to clipboard!');
    });

    it('shows failure toast via onToast when clipboard write fails', async () => {
      const toastMock = jest.fn();
      HighlightsHelpers.onToast = toastMock;

      Object.assign(navigator, {
        clipboard: {
          writeText: jest.fn().mockImplementation(() => Promise.reject(new Error('Permission denied')))
        }
      });

      await HighlightsHelpers.copyToClipboard('Failed Copy');
      expect(toastMock).toHaveBeenCalledWith('Failed to copy text.');
    });
  });

  describe('showToast', () => {
    it('delegates to onToast callback when registered', () => {
      const toastMock = jest.fn();
      HighlightsHelpers.onToast = toastMock;

      HighlightsHelpers.showToast('Test Message');
      expect(toastMock).toHaveBeenCalledWith('Test Message');
    });

    it('falls back to non-DOM logging without throwing when onToast is not registered', () => {
      HighlightsHelpers.onToast = undefined;
      expect(() => HighlightsHelpers.showToast('Missing Toast')).not.toThrow();
    });
  });

  describe('Error boundaries in escapeHtml, highlightSearchMatch, and showToast', () => {
    it('handles document.createElement throwing in escapeHtml fallback', () => {
      const origCreate = document.createElement;
      document.createElement = () => { throw new Error('DOM Error'); };

      const escaped = HighlightsHelpers.escapeHtml('<script>alert(1)</script>');
      expect(escaped).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');

      document.createElement = origCreate;
    });

    it('handles regex error fallback in highlightSearchMatch', () => {
      jest.spyOn(HighlightsHelpers, 'escapeHtml').mockImplementationOnce(() => {
        throw new Error('Escape error');
      });

      expect(() => HighlightsHelpers.highlightSearchMatch('Text', 'query')).not.toThrow();
    });

    it('handles exception inside onToast callback gracefully', () => {
      HighlightsHelpers.onToast = () => {
        throw new Error('Toast callback error');
      };

      expect(() => HighlightsHelpers.showToast('Test Toast')).not.toThrow();
    });

    it('executes global window helper functions', async () => {
      expect(typeof window.escapeHtml).toBe('function');
      expect(window.escapeHtml('<b>hi</b>')).toContain('&lt;b&gt;');

      expect(typeof window.highlightSearchMatch).toBe('function');
      expect(window.highlightSearchMatch('hello world', 'world')).toContain('<mark>world</mark>');

      expect(typeof window.getCleanDisplayUrl).toBe('function');
      expect(window.getCleanDisplayUrl('https://example.com/test')).toBe('example.com/test');

      expect(typeof window.showToast).toBe('function');
      expect(() => window.showToast('Global Toast')).not.toThrow();

      const writeTextMock = jest.fn().mockImplementation(() => Promise.resolve());
      Object.assign(navigator, { clipboard: { writeText: writeTextMock } });
      await window.copyToClipboard('Global Copy');
      expect(writeTextMock).toHaveBeenCalledWith('Global Copy');
    });
  });
});


