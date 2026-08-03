import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { EditorManager } from '../../../../../features/tracker/editor/editor';
import { Card } from '../../../../../types/domain';

describe('EditorManager', () => {
  let editor: EditorManager;

  const mockCards: Card[] = [
    {
      id: 'c1',
      problemTitle: 'Two Sum',
      problemUrl: 'https://leetcode.com/problems/two-sum',
      approach: 'Hash Map Lookup',
      timeComplexity: 'O(n)',
      spaceComplexity: 'O(n)'
    }
  ] as unknown as Card[];

  beforeEach(() => {
    jest.useFakeTimers();

    document.body.innerHTML = `
      <h1 id="problem-title"></h1>
      <span id="problem-url"></span>
      <span id="save-status"></span>

      <textarea id="editor-textarea"></textarea>
      <input id="time-complexity-input" value="" />
      <input id="space-complexity-input" value="" />

      <button id="save-btn">Save</button>
      <button id="save-close-btn">Save & Close</button>
      <button id="header-back-btn">Back</button>

      <button id="preview-toggle-btn">Preview</button>
      <div id="editor-preview" style="display: none;"></div>

      <div id="status-toast"></div>
    `;

    delete (window as any).location;
    (window as any).location = new URL('https://algo.monster/editor.html?url=https://leetcode.com/problems/two-sum&cardId=c1');

    (window as any).close = jest.fn();

    (chrome.storage.local.get as jest.Mock).mockImplementation((keys: any, cb?: any) => {
      const result = {
        fsrsCards: mockCards,
        bookmarks: [{ url: 'https://leetcode.com/problems/two-sum', title: 'Two Sum Bookmark' }],
        approachDrafts: {
          'https://leetcode.com/problems/two-sum': {
            approach: 'Draft Notes',
            timeComplexity: 'O(n)',
            spaceComplexity: 'O(n)'
          }
        }
      };
      if (cb) cb(result);
      return Promise.resolve(result);
    });

    (chrome.storage.local.set as jest.Mock).mockImplementation((data: any, cb?: any) => {
      if (cb) cb();
      return Promise.resolve();
    });

    editor = new EditorManager();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  describe('init and content loading', () => {
    it('initializes editor and populates form fields for existing card', () => {
      editor.init();
      expect(chrome.storage.local.get).toHaveBeenCalled();

      const titleEl = document.getElementById('problem-title');
      expect(titleEl?.textContent).toBe('Two Sum');

      const textarea = document.getElementById('editor-textarea') as HTMLTextAreaElement;
      expect(textarea.value).toBe('Hash Map Lookup');
    });

    it('displays error status when no url query parameter is provided', () => {
      delete (window as any).location;
      (window as any).location = new URL('https://algo.monster/editor.html');

      const noUrlEditor = new EditorManager();
      noUrlEditor.init();

      const titleEl = document.getElementById('problem-title');
      expect(titleEl?.textContent).toContain('Error: No URL provided');
    });

    it('loads draft notes when card does not exist in FSRS storage', () => {
      (chrome.storage.local.get as jest.Mock).mockImplementation((keys: any, cb?: any) => {
        if (cb) {
          cb({
            fsrsCards: [],
            bookmarks: [{ url: 'https://leetcode.com/problems/other', title: 'Other' }],
            approachDrafts: {
              'https://leetcode.com/problems/two-sum': {
                approach: 'Draft Approach',
                timeComplexity: 'O(n)',
                spaceComplexity: 'O(1)'
              }
            }
          });
        }
      });

      delete (window as any).location;
      (window as any).location = new URL('https://algo.monster/editor.html?url=https://leetcode.com/problems/two-sum');

      const draftEditor = new EditorManager();
      draftEditor.init();

      const textarea = document.getElementById('editor-textarea') as HTMLTextAreaElement;
      expect(textarea.value).toBe('Draft Approach');
    });

    it('handles string draft values correctly', () => {
      (chrome.storage.local.get as jest.Mock).mockImplementation((keys: any, cb?: any) => {
        if (cb) {
          cb({
            fsrsCards: [],
            approachDrafts: {
              'https://leetcode.com/problems/two-sum': 'Simple string draft'
            }
          });
        }
      });

      delete (window as any).location;
      (window as any).location = new URL('https://algo.monster/editor.html?url=https://leetcode.com/problems/two-sum');

      const draftEditor = new EditorManager();
      draftEditor.init();

      const textarea = document.getElementById('editor-textarea') as HTMLTextAreaElement;
      expect(textarea.value).toBe('Simple string draft');
    });
  });

  describe('event bindings and auto-save timer', () => {
    it('triggers auto-save timer on input changes', () => {
      editor.init();

      const textarea = document.getElementById('editor-textarea') as HTMLTextAreaElement;
      textarea.value = 'Updated text input';
      textarea.dispatchEvent(new Event('input'));

      const statusEl = document.getElementById('save-status');
      expect(statusEl?.textContent).toBe('Typing...');

      jest.advanceTimersByTime(300);
      expect(statusEl?.textContent).toBe('Changes saved automatically');
    });

    it('saves progress and shows toast on Save button click', () => {
      editor.init();

      const saveBtn = document.getElementById('save-btn') as HTMLElement;
      saveBtn.click();

      expect(chrome.storage.local.set).toHaveBeenCalled();
      const toast = document.getElementById('status-toast');
      expect(toast?.textContent).toBe('Progress saved!');
    });

    it('saves progress and closes window on Save & Close button click', () => {
      editor.init();

      const saveCloseBtn = document.getElementById('save-close-btn') as HTMLElement;
      saveCloseBtn.click();

      expect(window.close).toHaveBeenCalled();
    });

    it('saves progress and closes window on Header Back button click', () => {
      editor.init();

      const backBtn = document.getElementById('header-back-btn') as HTMLElement;
      backBtn.click();

      expect(window.close).toHaveBeenCalled();
    });

    it('toggles markdown preview mode and edit mode', () => {
      editor.init();

      const previewBtn = document.getElementById('preview-toggle-btn') as HTMLElement;
      const editorPreview = document.getElementById('editor-preview');
      const textarea = document.getElementById('editor-textarea');

      previewBtn.click();
      expect(editor.isPreviewMode).toBe(true);
      expect(editorPreview?.style.display).toBe('block');
      expect(textarea?.style.display).toBe('none');

      previewBtn.click();
      expect(editor.isPreviewMode).toBe(false);
      expect(editorPreview?.style.display).toBe('none');
    });

    it('renders preview using window.AlgoRecall.Markdown if available', () => {
      (window as any).AlgoRecall = {
        Markdown: { render: (text: string) => `<h1>${text}</h1>` }
      };

      editor.init();
      const previewBtn = document.getElementById('preview-toggle-btn') as HTMLElement;
      previewBtn.click();

      const editorPreview = document.getElementById('editor-preview');
      expect(editorPreview?.innerHTML).toContain('<h1>');
    });

    it('triggers saveContent on pagehide and beforeunload', () => {
      editor.init();

      window.dispatchEvent(new Event('pagehide'));
      window.dispatchEvent(new Event('beforeunload'));

      expect(chrome.storage.local.set).toHaveBeenCalled();
    });
  });

  describe('content saving and helper methods', () => {
    it('saves draft entries for non-existing cards', () => {
      editor.init();
      editor.isCardExisting = false;

      editor.saveContent();
      expect(chrome.storage.local.set).toHaveBeenCalled();
    });

    it('handles clean display URL parsing and fallbacks', () => {
      expect(editor.getCleanDisplayUrl('https://leetcode.com/problems/two-sum')).toBe('leetcode.com/problems/two-sum');
      expect(editor.getCleanDisplayUrl('invalid-url')).toBe('invalid-url');
    });

    it('handles toast status display and auto-hide timer', () => {
      editor.showToast('Test Toast Message');

      const toast = document.getElementById('status-toast');
      expect(toast?.classList.contains('show')).toBe(true);

      jest.advanceTimersByTime(2000);
      expect(toast?.classList.contains('show')).toBe(false);
    });

    it('handles DOM exceptions during init gracefully', () => {
      const origGEBI = document.getElementById;
      document.getElementById = () => { throw new Error('GEBI error'); };

      expect(() => editor.init()).not.toThrow();

      document.getElementById = origGEBI;
    });

    it('handles storage exception during saveContent gracefully', () => {
      (chrome.storage.local.get as jest.Mock).mockImplementation(() => {
        throw new Error('Save storage error');
      });

      const callback = jest.fn();
      expect(() => editor.saveContent(callback)).not.toThrow();
      expect(callback).toHaveBeenCalled();
    });
  });
});
