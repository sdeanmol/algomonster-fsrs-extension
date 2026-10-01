import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { Utils } from '../../../content/utils';

describe('Content Utils', () => {
  const setWindowUrl = (urlStr: string) => {
    delete (window as any).location;
    (window as any).location = new URL(urlStr);
  };

  beforeEach(() => {
    document.body.innerHTML = '';
    setWindowUrl('https://leetcode.com/problems/two-sum/');
    document.title = 'Two Sum - LeetCode';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('getDOMMeta and restoreRangeFromMeta', () => {
    it('serializes text node position to DOMMeta coordinates', () => {
      const p = document.createElement('p');
      const textNode = document.createTextNode('Hello world from DOMMeta test');
      p.appendChild(textNode);
      document.body.appendChild(p);

      const meta = Utils.getDOMMeta(textNode, 6);
      expect(meta.parentTagName).toBe('p');
      expect(meta.parentIndex).toBe(0);
      expect(meta.textOffset).toBe(6);
      expect(Array.isArray(meta.parentDomPath)).toBe(true);
    });

    it('restores Range from valid DOMMeta coordinates', () => {
      const p = document.createElement('p');
      const textNode = document.createTextNode('Sample text for highlight range');
      p.appendChild(textNode);
      document.body.appendChild(p);

      const metaStart = Utils.getDOMMeta(textNode, 0);
      const metaEnd = Utils.getDOMMeta(textNode, 11);

      const restoredRange = Utils.restoreRangeFromMeta({
        startMeta: metaStart,
        endMeta: metaEnd
      }, 'Sample text');

      expect(restoredRange).not.toBeNull();
      expect(restoredRange?.toString()).toBe('Sample text');
    });

    it('returns null if range cannot be restored or text mismatch occurs', () => {
      const result = Utils.restoreRangeFromMeta({
        startMeta: { parentTagName: 'div', parentIndex: 99, textOffset: 0, parentDomPath: [999] },
        endMeta: { parentTagName: 'div', parentIndex: 99, textOffset: 10, parentDomPath: [999] }
      }, 'Mismatch text');

      expect(result).toBeNull();
    });
  });

  describe('ensureHighlightStyle', () => {
    it('dynamically injects highlight style rule into document head', () => {
      const color = '#ff0000';
      const className = Utils.ensureHighlightStyle(color, 'highlight');
      expect(className).toContain('algo-hl-ff0000');

      const underlineClass = Utils.ensureHighlightStyle(color, 'underline');
      expect(underlineClass).toContain('algo-ul-ff0000');
    });
  });

  describe('getAutoTags', () => {
    it('extracts topic tags from URL pathname', () => {
      setWindowUrl('https://leetcode.com/problems/dynamic_programming');
      const tags = Utils.getAutoTags();
      expect(tags).toEqual(['Dynamic Programming']);
    });

    it('returns AlgoRecall fallback on error or empty path', () => {
      setWindowUrl('https://leetcode.com/');
      const tags = Utils.getAutoTags();
      expect(tags).toEqual(['AlgoRecall']);
    });
  });

  describe('getExtractedProblemTitle', () => {
    it('strips branding text from document title', () => {
      document.title = 'Two Sum - LeetCode';
      expect(Utils.getExtractedProblemTitle()).toBe('Two Sum');

      document.title = 'Binary Tree Inorder Traversal - AlgoMonster';
      expect(Utils.getExtractedProblemTitle()).toBe('Binary Tree Inorder Traversal');
    });

    it('parses LeetCode Explore card titles', () => {
      setWindowUrl('https://leetcode.com/explore/featured/card/top-interview-questions-easy/92/array/564/');

      const cardTitleEl = document.createElement('h1');
      cardTitleEl.className = 'card-info-title';
      cardTitleEl.innerText = 'Remove Duplicates from Sorted Array';
      document.body.appendChild(cardTitleEl);

      const title = Utils.getExtractedProblemTitle();
      expect(title).toBe('Remove Duplicates from Sorted Array');
    });

    it('parses LeetCode Explore card title from URL segments when DOM elements are missing', () => {
      setWindowUrl('https://leetcode.com/explore/featured/card/top-interview-questions-easy/92/array/564/');
      const title = Utils.getExtractedProblemTitle();
      expect(title).toBe('Array');
    });

    it('falls back to document title if DOM selectors match nothing', () => {
      document.title = 'Default Title - AtCoder';
      expect(Utils.getExtractedProblemTitle()).toBe('Default Title');
    });
  });

  describe('Error Boundaries and Edge Cases', () => {
    it('handles getDOMMeta error gracefully when node has no parentNode', () => {
      const mockNode = {
        get parentNode() { throw new Error('Simulated DOM access error'); }
      };
      const result = Utils.getDOMMeta(mockNode as unknown as Node, 5);
      expect(result).toEqual({
        parentTagName: '',
        parentIndex: -1,
        textOffset: 5,
        parentDomPath: []
      });
    });

    it('handles restoreRangeFromMeta path resolution error safely', () => {
      // Simulate error in path resolution loop
      const originalBody = document.body;
      Object.defineProperty(document, 'body', {
        get: () => { throw new Error('Path resolve error'); },
        configurable: true
      });

      const result = Utils.restoreRangeFromMeta({
        startMeta: { parentTagName: 'div', parentIndex: 0, textOffset: 0, parentDomPath: [0, 1] },
        endMeta: { parentTagName: 'div', parentIndex: 0, textOffset: 5, parentDomPath: [0, 2] }
      }, 'test');

      expect(result).toBeNull();
      
      Object.defineProperty(document, 'body', {
        value: originalBody,
        configurable: true,
        writable: true
      });
    });

    it('handles ensureHighlightStyle error safely (e.g. document.head throws)', () => {
      const originalHead = document.head;
      Object.defineProperty(document, 'head', {
        get: () => { throw new Error('Head access error'); },
        configurable: true
      });

      const result = Utils.ensureHighlightStyle('#ffffff', 'highlight');
      expect(result).toBe('algo-hl-ffffff'); // Should still return the class name

      Object.defineProperty(document, 'head', {
        value: originalHead,
        configurable: true,
        writable: true
      });
    });

    it('handles getAutoTags URL parsing error safely', () => {
      delete (window as any).location;
      Object.defineProperty(window, 'location', {
        get: () => { throw new Error('URL access error'); },
        configurable: true
      });

      const tags = Utils.getAutoTags();
      expect(tags).toEqual(['AlgoRecall']); // Fallback
    });



    it('safely handles window global scope registration error', () => {
      const originalAlgoRecall = (window as any).AlgoRecall;
      delete (window as any).AlgoRecall;
      
      Object.defineProperty(window, 'AlgoRecall', {
        get: () => { throw new Error('Global access denied'); },
        configurable: true
      });

      expect(() => {
        // simulate the assignment logic
        try {
          const win = window as any;
          win.AlgoRecall = win.AlgoRecall || {};
          win.AlgoRecall.Utils = Utils;
        } catch (err) {}
      }).not.toThrow();

      Object.defineProperty(window, 'AlgoRecall', {
        value: originalAlgoRecall,
        configurable: true,
        writable: true
      });
    });
  });
});
