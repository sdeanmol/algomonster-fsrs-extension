import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { Markdown } from '../../../../features/common/markdown';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const markedLib = require('../../../../features/common/marked.min.js');

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

describe('Markdown Component', () => {
  beforeEach(() => {
    Markdown.init();
  });

  afterEach(() => {
    delete (global as any).marked;
    delete (window as any).marked;
  });

  it('returns empty string for empty, null, or invalid input', () => {
    expect(Markdown.render('')).toBe('');
    expect(Markdown.render(null as any)).toBe('');
    expect(Markdown.render(undefined as any)).toBe('');
    expect(Markdown.render(123 as any)).toBe('');
  });

  it('uses fallback plain-text HTML escaping when marked is not available', () => {
    const text = 'Line 1\nLine 2 & <script>alert("xss")</script>';
    const rendered = Markdown.render(text);

    expect(rendered).toContain('Line 1<br>Line 2 &amp; &lt;script&gt;alert(\"xss\")&lt;/script&gt;');
  });

  it('parses markdown and sanitizes dangerous tags (script, iframe, object, embed, form)', () => {
    (global as any).marked = {
      setOptions: jest.fn(),
      parse: (str: string) => `<p>Safe text</p><script>alert(1)</script><iframe src="x"></iframe><form><input/></form>`
    };

    const rendered = Markdown.render('# Safe Text');
    expect(rendered).toContain('<p>Safe text</p>');
    expect(rendered).not.toContain('<script>');
    expect(rendered).not.toContain('<iframe');
    expect(rendered).not.toContain('<form>');
  });

  it('strips inline script event handlers (onclick, onload) and javascript: URIs', () => {
    (global as any).marked = {
      setOptions: jest.fn(),
      parse: (str: string) => `<a href="javascript:alert(1)" onclick="doSomething()">Link</a>`
    };

    const rendered = Markdown.render('[Link](javascript:alert(1))');
    expect(rendered).not.toContain('javascript:');
    expect(rendered).not.toContain('onclick=');
  });

  it('handles marked.parse exceptions gracefully with fallback escaping', () => {
    (global as any).marked = {
      setOptions: jest.fn(),
      parse: () => {
        throw new Error('Parse error');
      }
    };

    const rendered = Markdown.render('Error Test & <tag>');
    expect(rendered).toBe('Error Test &amp; &lt;tag&gt;');
  });

  it('strips inline event handlers with single quotes', () => {
    (global as any).marked = {
      setOptions: jest.fn(),
      parse: (str: string) => `<button onload='alert(1)'>Click</button>`
    };

    const rendered = Markdown.render('button');
    expect(rendered).not.toContain("onload=");
  });

  it('initializes marked setOptions when marked is present', () => {
    const setOptions = jest.fn();
    (global as any).marked = {
      setOptions,
      parse: jest.fn()
    };

    Markdown.init();
    expect(setOptions).toHaveBeenCalledWith(expect.objectContaining({
      breaks: true,
      gfm: true
    }));
  });

  it('handles errors inside Markdown.init gracefully', () => {
    (global as any).marked = {
      setOptions: () => {
        throw new Error('Init error');
      },
      parse: jest.fn()
    };

    expect(() => Markdown.init()).not.toThrow();
  });

  describe('Full Markdown Rendering with marked.min.js', () => {
    beforeEach(() => {
      (global as any).marked = markedLib;
      (window as any).marked = markedLib;
      Markdown.init();
    });

    it('renders heading levels h1 through h6 correctly', () => {
      const headings = '# Heading 1\n## Heading 2\n### Heading 3\n#### Heading 4\n##### Heading 5\n###### Heading 6';
      const rendered = Markdown.render(headings);

      expect(rendered).toContain('<h1>Heading 1</h1>');
      expect(rendered).toContain('<h2>Heading 2</h2>');
      expect(rendered).toContain('<h3>Heading 3</h3>');
      expect(rendered).toContain('<h4>Heading 4</h4>');
      expect(rendered).toContain('<h5>Heading 5</h5>');
      expect(rendered).toContain('<h6>Heading 6</h6>');
    });

    it('renders bold, italic, and bold/italic combinations', () => {
      const text = '**bold text** and *italic text* and ***bold italic***';
      const rendered = Markdown.render(text);

      expect(rendered).toContain('<strong>bold text</strong>');
      expect(rendered).toContain('<em>italic text</em>');
      expect(rendered).toMatch(/<(strong|em)><(strong|em)>bold italic<\/\2><\/\1>/);
    });

    it('renders ordered and unordered lists with nested hierarchy', () => {
      const listMarkdown = `* Item A
  * Sub A1
  * Sub A2
* Item B

1. Step 1
2. Step 2
   1. Substep 2a
   2. Substep 2b`;
      const rendered = Markdown.render(listMarkdown);

      expect(rendered).toContain('<ul>');
      expect(rendered).toContain('<li>Item A');
      expect(rendered).toContain('<li>Sub A1</li>');
      expect(rendered).toContain('<ol>');
      expect(rendered).toContain('<li>Step 1</li>');
      expect(rendered).toContain('<li>Substep 2a</li>');
    });

    it('renders horizontal rules (--- and ***)', () => {
      const hrMarkdown = 'Section A\n\n---\n\nSection B\n\n***\n\nSection C';
      const rendered = Markdown.render(hrMarkdown);

      expect(rendered).toContain('<hr>');
      expect(rendered.match(/<hr>/g)?.length).toBe(2);
    });

    it('renders inline code and fenced code blocks', () => {
      const codeMarkdown = 'Use `const x = 10;` in your code.\n\n```typescript\nfunction solve(): number {\n  return 42;\n}\n```';
      const rendered = Markdown.render(codeMarkdown);

      expect(rendered).toContain('<code>const x = 10;</code>');
      expect(rendered).toContain('<pre>');
      expect(rendered).toContain('<code class="language-typescript">');
      expect(rendered).toContain('return 42;');
    });

    it('renders blockquotes', () => {
      const bq = '> This is a blockquote note.\n> Second line of quote.';
      const rendered = Markdown.render(bq);

      expect(rendered).toContain('<blockquote>');
      expect(rendered).toContain('This is a blockquote note.');
    });

    it('renders links and preserves safe https/http URLs', () => {
      const linkMarkdown = '[AlgoMonster](https://algo.monster) and [LeetCode](https://leetcode.com)';
      const rendered = Markdown.render(linkMarkdown);

      expect(rendered).toContain('<a href="https://algo.monster">AlgoMonster</a>');
      expect(rendered).toContain('<a href="https://leetcode.com">LeetCode</a>');
    });

    it('renders unicode characters and emojis faithfully', () => {
      const unicode = '### Problem 🚀 — O(N × log N) • Résumé & 💡 insights: "quoted"';
      const rendered = Markdown.render(unicode);

      expect(rendered).toContain('🚀');
      expect(rendered).toContain('—');
      expect(rendered).toContain('•');
      expect(rendered).toContain('Résumé');
      expect(rendered).toContain('💡');
    });

    it('correctly renders the complete Section 9 mandatory test fixture', () => {
      const rendered = Markdown.render(MANDATORY_FIXTURE);

      // 1. Headings (level 4)
      expect(rendered).toContain('<h4>1. The "Byheart" Vault (Memorization)</h4>');
      expect(rendered).toContain('<h4>2. The Feynman Check (Simplified Logic)</h4>');

      // 2. Bold anchors and nested acronyms
      expect(rendered).toContain('<strong>Mnemonic Anchors:</strong>');
      expect(rendered).toContain('<strong>B-R-S-D-C</strong>');
      expect(rendered).toContain('<strong>B</strong>rains <strong>R</strong>emember <strong>S</strong>imple <strong>D</strong>ata <strong>C</strong>ases');

      // 3. Sub-bullets B-R-S-D-C
      expect(rendered).toContain('<strong>B</strong> — <strong>B</strong>ackward (Work backward from the goal)');
      expect(rendered).toContain('<strong>R</strong> — <strong>R</strong>elated (Recall a related problem with the same unknown)');
      expect(rendered).toContain('<strong>S</strong> — <strong>S</strong>impler (Solve a simpler version, then add conditions back)');
      expect(rendered).toContain('<strong>D</strong> — <strong>D</strong>ata (Ensure all data and constraints are utilized)');
      expect(rendered).toContain('<strong>C</strong> — <strong>C</strong>ases (Test small cases to discover the mathematical rule)');

      // 4. AIR story with italic and bold combinations
      expect(rendered).toContain('<em>AIR Story (Association, Imagination, Ridiculous Thinking):</em>');
      expect(rendered).toContain('walking <strong>Backward</strong> through a door');
      expect(rendered).toContain('<strong>Related</strong> person');
      expect(rendered).toContain('<strong>Simpler</strong> miniature version');
      expect(rendered).toContain('raw <strong>Data</strong> sheets');
      expect(rendered).toContain('<strong>Small Cases</strong>');

      // 5. Visual Cues nested hierarchy
      expect(rendered).toContain('<strong>Visual Cues (The Hide-and-Seek / Loci Journey):</strong>');
      expect(rendered).toContain('<strong>Doorway:</strong>');
      expect(rendered).toContain('<strong>Living Room Mirror:</strong>');
      expect(rendered).toContain('<strong>Kitchen Table:</strong>');
      expect(rendered).toContain('<strong>Study Desk:</strong>');
      expect(rendered).toContain('<strong>Nightstand:</strong>');

      // 6. Horizontal rules
      expect(rendered).toContain('<hr>');
      expect(rendered.match(/<hr>/g)?.length).toBe(2);

      // 7. Paragraph narrative
      expect(rendered).toContain('<p>Imagine you are playing a tricky maze game.');
    });

    describe('Security and XSS Sanitization with DOMPurify', () => {
      it('neutralizes unquoted event handlers (e.g. <img src=x onerror=alert(1)>)', () => {
        const attack = '<img src=x onerror=alert(1)>';
        const rendered = Markdown.render(attack);

        expect(rendered).not.toContain('onerror');
        expect(rendered).not.toContain('alert');
        expect(rendered).toContain('<img src="x">');
      });

      it('neutralizes quoted event handlers (e.g. <img src="x" onerror="alert(1)">)', () => {
        const attack = '<img src="x" onerror="alert(1)">';
        const rendered = Markdown.render(attack);

        expect(rendered).not.toContain('onerror');
        expect(rendered).not.toContain('alert');
        expect(rendered).toContain('<img src="x">');
      });

      it('strips svg onload injection', () => {
        const attack = '<svg onload="alert(1)"><circle r="10"/></svg>';
        const rendered = Markdown.render(attack);

        expect(rendered).not.toContain('onload');
        expect(rendered).not.toContain('alert');
      });

      it('strips javascript: URIs in markdown links', () => {
        const attack = '[Malicious Link](javascript:alert("XSS"))';
        const rendered = Markdown.render(attack);

        expect(rendered).not.toContain('javascript:');
        expect(rendered).not.toContain('alert');
      });

      it('strips data:text/html URIs in markdown links', () => {
        const attack = '[Data Link](data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==)';
        const rendered = Markdown.render(attack);

        expect(rendered).not.toContain('data:text/html');
        expect(rendered).not.toContain('PHNjcmlwdD5');
      });

      it('strips <form>, <input>, <button>, and <select> tags', () => {
        const attack = '<form action="/steal"><input name="token" value="secret"><button type="submit">Send</button></form>';
        const rendered = Markdown.render(attack);

        expect(rendered).not.toContain('<form');
        expect(rendered).not.toContain('<input');
        expect(rendered).not.toContain('<button');
      });

      it('strips <script>, <iframe>, <object>, and <embed> tags', () => {
        const attack = '<script>fetch("evil.com")</script><iframe src="evil.com"></iframe><embed src="flash.swf">';
        const rendered = Markdown.render(attack);

        expect(rendered).not.toContain('<script');
        expect(rendered).not.toContain('<iframe');
        expect(rendered).not.toContain('<embed');
      });
    });
  });
});

