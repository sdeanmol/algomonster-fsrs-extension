import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { HighlightsHelpers } from '../../features/highlighter/manager/highlights-helpers';

describe('HighlightsHelpers', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
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
    it('calls navigator.clipboard.writeText and shows success toast', async () => {
      const toast = document.createElement('div');
      toast.id = 'status-toast';
      document.body.appendChild(toast);

      const writeTextMock = jest.fn().mockImplementation(() => Promise.resolve());
      Object.assign(navigator, {
        clipboard: {
          writeText: writeTextMock
        }
      });

      await HighlightsHelpers.copyToClipboard('Hello World');
      expect(writeTextMock).toHaveBeenCalledWith('Hello World');
      expect(toast.textContent).toBe('Snippet copied to clipboard!');
      expect(toast.classList.contains('show')).toBe(true);
    });

    it('shows failure toast when clipboard write fails', async () => {
      const toast = document.createElement('div');
      toast.id = 'status-toast';
      document.body.appendChild(toast);

      Object.assign(navigator, {
        clipboard: {
          writeText: jest.fn().mockImplementation(() => Promise.reject(new Error('Permission denied')))
        }
      });

      await HighlightsHelpers.copyToClipboard('Failed Copy');
      expect(toast.textContent).toBe('Failed to copy text.');
    });
  });

  describe('showToast', () => {
    it('removes show class after timeout', () => {
      jest.useFakeTimers();
      const toast = document.createElement('div');
      toast.id = 'status-toast';
      document.body.appendChild(toast);

      HighlightsHelpers.showToast('Test Message');
      expect(toast.textContent).toBe('Test Message');
      expect(toast.classList.contains('show')).toBe(true);

      jest.advanceTimersByTime(2100);
      expect(toast.classList.contains('show')).toBe(false);
      jest.useRealTimers();
    });

    it('returns early when status-toast element is missing', () => {
      expect(() => HighlightsHelpers.showToast('Missing Toast')).not.toThrow();
    });
  });

  describe('Global window bindings', () => {
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


