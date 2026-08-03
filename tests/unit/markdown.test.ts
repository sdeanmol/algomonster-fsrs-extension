import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { Markdown } from '../../features/common/markdown';

describe('Markdown Component', () => {
  beforeEach(() => {
    Markdown.init();
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

    delete (global as any).marked;
  });

  it('strips inline script event handlers (onclick, onload) and javascript: URIs', () => {
    (global as any).marked = {
      setOptions: jest.fn(),
      parse: (str: string) => `<a href="javascript:alert(1)" onclick="doSomething()">Link</a>`
    };

    const rendered = Markdown.render('[Link](javascript:alert(1))');
    expect(rendered).not.toContain('javascript:');
    expect(rendered).not.toContain('onclick=');

    delete (global as any).marked;
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

    delete (global as any).marked;
  });
});
