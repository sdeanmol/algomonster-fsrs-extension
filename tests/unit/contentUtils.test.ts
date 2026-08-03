import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { Utils } from '../../content/utils';

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
});
