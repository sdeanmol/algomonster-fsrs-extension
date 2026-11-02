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

    it('handles outer/inner storage get errors in loadContent gracefully', () => {
      (chrome.storage.local.get as jest.Mock).mockImplementation(() => {
        throw new Error('Load content storage error');
      });

      expect(() => editor.loadContent()).not.toThrow();

      (chrome.storage.local.get as jest.Mock).mockImplementation((keys: any, cb: any) => {
        cb(null);
      });
      expect(() => editor.loadContent()).not.toThrow();
    });
  });

  describe('event bindings, markdown preview, and saveContent branches', () => {
    it('triggers auto-save timer on input changes', () => {
      editor.init();
      const textarea = document.getElementById('editor-textarea') as HTMLTextAreaElement;
      textarea.value = 'Updated approach notes';
      textarea.dispatchEvent(new Event('input'));

      const statusEl = document.getElementById('save-status');
      expect(statusEl?.textContent).toBe('Typing...');

      jest.advanceTimersByTime(350);
      expect(chrome.storage.local.set).toHaveBeenCalled();
    });

    it('handles click events for Save, Save & Close, and Header Back buttons', () => {
      editor.init();

      const saveBtn = document.getElementById('save-btn') as HTMLElement;
      saveBtn.click();
      expect(chrome.storage.local.set).toHaveBeenCalled();

      const saveCloseBtn = document.getElementById('save-close-btn') as HTMLElement;
      saveCloseBtn.click();
      expect(window.close).toHaveBeenCalled();

      const headerBackBtn = document.getElementById('header-back-btn') as HTMLElement;
      headerBackBtn.click();
      expect(window.close).toHaveBeenCalledTimes(2);
    });

    it('toggles markdown preview mode and renders HTML using AlgoRecall.Markdown or fallback regex', () => {
      editor.init();
      const previewToggleBtn = document.getElementById('preview-toggle-btn') as HTMLElement;
      const editorPreview = document.getElementById('editor-preview') as HTMLElement;
      const textarea = document.getElementById('editor-textarea') as HTMLTextAreaElement;

      textarea.value = '## Heading\n- Item 1\n`code`';

      // 1. Fallback regex rendering mode
      previewToggleBtn.click();
      expect(editor.isPreviewMode).toBe(true);
      expect(editorPreview.style.display).toBe('block');
      expect(editorPreview.innerHTML).toContain('<br>');

      // Toggle back to edit mode
      previewToggleBtn.click();
      expect(editor.isPreviewMode).toBe(false);

      // 2. Custom AlgoRecall.Markdown rendering mode
      (window as any).AlgoRecall = {
        Markdown: {
          render: (t: string) => `<h1>Rendered: ${t}</h1>`
        }
      };

      previewToggleBtn.click();
      expect(editorPreview.innerHTML).toContain('<h1>Rendered:');

      delete (window as any).AlgoRecall;
    });

    it('saves content matching cleanUrl when cardId is empty and handles existing draft object updating', () => {
      delete (window as any).location;
      (window as any).location = new URL('https://algo.monster/editor.html?url=https://leetcode.com/problems/two-sum');

      const cleanUrlEditor = new EditorManager();
      cleanUrlEditor.init();

      cleanUrlEditor.cardId = '';
      cleanUrlEditor.isCardExisting = true;
      cleanUrlEditor.saveContent();
      expect(chrome.storage.local.set).toHaveBeenCalled();

      // Non-existing card with existing draft object update
      cleanUrlEditor.isCardExisting = false;
      cleanUrlEditor.saveContent();
      expect(chrome.storage.local.set).toHaveBeenCalled();
    });

    it('handles saveContent callback when index is -1 or when inner/outer storage throws error', () => {
      editor.init();
      editor.isCardExisting = true;
      editor.cardId = 'non-existent-card-id';
      editor.cleanUrl = 'non-existent-url';

      const cb = jest.fn();
      editor.saveContent(cb);
      expect(cb).toHaveBeenCalled();

      (chrome.storage.local.get as jest.Mock).mockImplementation(() => {
        throw new Error('Save content storage error');
      });
      const errCb = jest.fn();
      editor.saveContent(errCb);
      expect(errCb).toHaveBeenCalled();
    });

    it('handles toast auto-hide timer and clean display URL fallback for invalid URLs', () => {
      expect(editor.getCleanDisplayUrl('invalid-url-string')).toBe('invalid-url-string');

      editor.showToast('Test toast');
      const toast = document.getElementById('status-toast');
      expect(toast?.classList.contains('show')).toBe(true);

      jest.advanceTimersByTime(2100);
      expect(toast?.classList.contains('show')).toBe(false);

      const origGEBI = document.getElementById;
      document.getElementById = () => { throw new Error('DOM Toast error'); };

      expect(() => editor.showToast('Test')).not.toThrow();

      document.getElementById = origGEBI;
    });

    it('handles pagehide and beforeunload save triggers', () => {
      editor.init();
      window.dispatchEvent(new Event('pagehide'));
      window.dispatchEvent(new Event('beforeunload'));
      expect(chrome.storage.local.set).toHaveBeenCalled();
    });

    it('displays empty state notice when previewing an empty or whitespace note', () => {
      editor.init();
      const previewToggleBtn = document.getElementById('preview-toggle-btn') as HTMLElement;
      const editorPreview = document.getElementById('editor-preview') as HTMLElement;
      const textarea = document.getElementById('editor-textarea') as HTMLTextAreaElement;

      textarea.value = '   \n   ';
      previewToggleBtn.click();
      expect(editor.isPreviewMode).toBe(true);
      expect(editorPreview.innerHTML).toContain('editor-preview-empty');
      expect(editorPreview.innerHTML).toContain('No content to preview');

      // Toggling back to edit mode restores textarea and focus
      previewToggleBtn.click();
      expect(editor.isPreviewMode).toBe(false);
      expect(textarea.style.display).toBe('');
      expect(editorPreview.style.display).toBe('none');
    });

    it('renders the Section 9 mandatory fixture correctly in editor preview mode', () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const markedLib = require('../../../../../features/common/marked.min.js');
      (global as any).marked = markedLib;
      (window as any).marked = markedLib;

      editor.init();
      const previewToggleBtn = document.getElementById('preview-toggle-btn') as HTMLElement;
      const editorPreview = document.getElementById('editor-preview') as HTMLElement;
      const textarea = document.getElementById('editor-textarea') as HTMLTextAreaElement;

      const MANDATORY_FIXTURE = `#### 1. The "Byheart" Vault (Memorization)
* **Mnemonic Anchors:** Use the acronym **B-R-S-D-C** ("**B**rains **R**emember **S**imple **D**ata **C**ases"):
  * **B** — **B**ackward (Work backward from the goal)
  * **R** — **R**elated (Recall a related problem with the same unknown)
  * **S** — **S**impler (Solve a simpler version, then add conditions back)
  * **D** — **D**ata (Ensure all data and constraints are utilized)
  * **C** — **C**ases (Test small cases to discover the mathematical rule)
  * *AIR Story (Association, Imagination, Ridiculous Thinking):* Imagine walking **Backward** through a door and bumping into a twin (**Related** person). The twin shrinks into a **Simpler** miniature version, starts eating a giant pile of raw **Data** sheets, and opens **Cases** of lightbulbs (**Small Cases**) that light up one by one!
* **Visual Cues (The Hide-and-Seek / Loci Journey):**
  * **Doorway:** Picture a giant red **Rewind / Backward** button mounted on your front door (Work backward from the goal).
  * **Living Room Mirror:** A mirror reflecting a twin problem, pointing at the prize and asking "What is the unknown?" (**Related problem**).
  * **Kitchen Table:** A pair of shears stripping away complex constraints from a device to reveal its core engine (**Simpler version**).
  * **Study Desk:** A neon-highlighted contract checking off every single input parameter and array size (**Did you use all the data?**).
  * **Nightstand:** A line of 10 small lightbulbs (1 through 10) where you toggle switches by hand to see which ones stay lit (**Try small cases**).

---

#### 2. The Feynman Check (Simplified Logic)
Imagine you are playing a tricky maze game. If starting at the beginning gives you too many paths and you keep getting lost, turn around and start at the finish line—walking backward often reveals only one clear path. If you still get stuck, look at what prize you are trying to get and ask if you've ever won a prize like that in a different game. If the game is too hard, remove one rule to make an easier version first. Make sure you didn't drop any secret clue cards that were given to you at the start. And if you need to find a secret code, test the game with tiny numbers (like 1, 2, or 3) on your fingers until you spot the repeating trick!

---`;

      textarea.value = MANDATORY_FIXTURE;

      previewToggleBtn.click();
      expect(editor.isPreviewMode).toBe(true);
      expect(textarea.style.display).toBe('none');
      expect(editorPreview.style.display).toBe('block');

      // Verify level 4 headings rendered
      expect(editorPreview.innerHTML).toContain('<h4>1. The "Byheart" Vault (Memorization)</h4>');
      expect(editorPreview.innerHTML).toContain('<h4>2. The Feynman Check (Simplified Logic)</h4>');

      // Verify nested bullet hierarchy
      expect(editorPreview.innerHTML).toContain('<strong>Mnemonic Anchors:</strong>');
      expect(editorPreview.innerHTML).toContain('<strong>B-R-S-D-C</strong>');
      expect(editorPreview.innerHTML).toContain('<strong>B</strong> — <strong>B</strong>ackward (Work backward from the goal)');
      expect(editorPreview.innerHTML).toContain('<em>AIR Story (Association, Imagination, Ridiculous Thinking):</em>');
      expect(editorPreview.innerHTML).toContain('<hr>');
      expect(editorPreview.innerHTML).toContain('<p>Imagine you are playing a tricky maze game.');

      delete (global as any).marked;
      delete (window as any).marked;
    });

    it('preserves raw markdown and allows repeated toggling between Edit and Preview without data loss', () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const markedLib = require('../../../../../features/common/marked.min.js');
      (global as any).marked = markedLib;
      (window as any).marked = markedLib;

      editor.init();
      const previewToggleBtn = document.getElementById('preview-toggle-btn') as HTMLElement;
      const editorPreview = document.getElementById('editor-preview') as HTMLElement;
      const textarea = document.getElementById('editor-textarea') as HTMLTextAreaElement;

      const initialMarkdown = '### Complexity Analysis\n- Time: **O(N)**\n- Space: *O(1)*\n\n```ts\nreturn 0;\n```';
      textarea.value = initialMarkdown;

      // Repeat toggle 5 times
      for (let i = 0; i < 5; i++) {
        previewToggleBtn.click(); // to Preview
        expect(editor.isPreviewMode).toBe(true);
        expect(editorPreview.innerHTML).toContain('<h3>Complexity Analysis</h3>');
        expect(textarea.value).toBe(initialMarkdown);

        previewToggleBtn.click(); // back to Edit
        expect(editor.isPreviewMode).toBe(false);
        expect(textarea.value).toBe(initialMarkdown);
      }

      delete (global as any).marked;
      delete (window as any).marked;
    });

    it('saves exact raw markdown string to storage from both Edit and Preview modes', () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const markedLib = require('../../../../../features/common/marked.min.js');
      (global as any).marked = markedLib;
      (window as any).marked = markedLib;

      editor.init();
      const previewToggleBtn = document.getElementById('preview-toggle-btn') as HTMLElement;
      const textarea = document.getElementById('editor-textarea') as HTMLTextAreaElement;

      const rawMarkdown = '#### Binary Search\n* Step 1: `mid = (lo + hi) / 2`\n* Step 2: **Compare** target';
      textarea.value = rawMarkdown;

      // 1. Save from Edit mode
      let savedData: any = null;
      (chrome.storage.local.set as jest.Mock).mockImplementation((data: any, cb?: any) => {
        savedData = data;
        if (cb) cb();
      });

      editor.saveContent();
      expect(savedData).not.toBeNull();
      expect(savedData.fsrsCards[0].approach).toBe(rawMarkdown);
      expect(savedData.fsrsCards[0].approach).not.toContain('<h4>');

      // 2. Switch to Preview mode
      previewToggleBtn.click();
      expect(editor.isPreviewMode).toBe(true);

      // Save from Preview mode
      savedData = null;
      editor.saveContent();
      expect(savedData).not.toBeNull();
      // MUST still be the raw Markdown, NOT the rendered HTML
      expect(savedData.fsrsCards[0].approach).toBe(rawMarkdown);
      expect(savedData.fsrsCards[0].approach).not.toContain('<h4>');

      delete (global as any).marked;
      delete (window as any).marked;
    });
  });
});
