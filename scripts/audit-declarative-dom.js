#!/usr/bin/env node
/**
 * @file scripts/audit-declarative-dom.js
 * @description Automated AST-based static audit verifying the complete elimination of
 * imperative DOM manipulation across extension-owned UI files, while respecting
 * justified architectural boundaries.
 * 
 * Boundaries:
 * 1. Boundary 2: Host container injection into third-party DOM in `content/content.ts`.
 * 2. Boundary 3: Pre-mount theme synchronization (`features/common/theme-sync.ts`)
 *    and download fallbacks (`features/common/data/backupManager.ts`, `features/common/services/actionService.ts`).
 * 3. Mount Target: Top-level Preact `render(<App />, document.getElementById('root'))`
 *    strictly in entry points.
 */

const fs = require('fs');
const path = require('path');

// Resolve TypeScript compiler API reliably from local node_modules
let ts;
try {
    ts = require('typescript');
} catch (_) {
    try {
        ts = require(path.resolve(process.cwd(), 'node_modules/typescript'));
    } catch (e) {
        console.error('Failed to load typescript module:', e);
        process.exit(1);
    }
}

// Files explicitly exempted under justified architectural boundaries
const JUSTIFIED_BOUNDARIES = new Set([
    'content/content.ts',
    'features/common/theme-sync.ts',
    'features/common/data/backupManager.ts',
    'features/common/services/actionService.ts'
]);

// Extension-owned UI target files specified in R1
const TARGET_UI_FILES = [
    'features/tracker/tracker.tsx',
    'features/tracker/editor/editor.tsx',
    'features/tracker/config/fsrsConfig.tsx',
    'features/dashboard/popup/stats.tsx',
    'features/highlighter/highlighter.tsx',
    'features/highlighter/options/highlightOptions.tsx',
    'features/dashboard/popup/rating.tsx',
    'features/dashboard/analytics/analytics.tsx',
    'features/highlighter/manager/highlights.tsx',
    'features/dashboard/popup/search.tsx',
    'features/dashboard/popup/heatmap.tsx',
    'features/dashboard/popup/popup.tsx',
    'features/dashboard/analytics/memory/memory.tsx',
    'features/dashboard/analytics/tags/tags.tsx',
    'features/dashboard/analytics/performance/performance.tsx',
    'features/dashboard/analytics/insights/insights.tsx'
];

function isJustifiedBoundary(filePath) {
    const norm = filePath.replace(/\\/g, '/');
    for (const b of JUSTIFIED_BOUNDARIES) {
        if (norm.endsWith(b) || norm === b || b.endsWith(norm) || norm.endsWith(path.basename(b))) {
            return true;
        }
    }
    return false;
}

function auditFile(filePath) {
    if (isJustifiedBoundary(filePath)) {
        return { filePath, violations: [], isBoundary: true };
    }

    const code = fs.readFileSync(filePath, 'utf8');
    const sf = ts.createSourceFile(filePath, code, ts.ScriptTarget.Latest, true);
    const violations = [];

    function report(node, type, detail) {
        const { line, character } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
        violations.push({
            file: filePath,
            line: line + 1,
            col: character + 1,
            type,
            detail,
            snippet: node.getText(sf).slice(0, 100).replace(/\s+/g, ' ')
        });
    }

    function checkNode(node) {
        // 1. Call Expressions
        if (ts.isCallExpression(node)) {
            const expr = node.expression;
            if (ts.isPropertyAccessExpression(expr)) {
                const objText = expr.expression.getText(sf);
                const prop = expr.name.text;

                // document.getElementById
                if (objText === 'document' && prop === 'getElementById') {
                    const arg0 = node.arguments[0] ? node.arguments[0].getText(sf).replace(/['"]/g, '') : '';
                    if (arg0 !== 'root') {
                        report(node, 'document.getElementById', `Forbidden element query for #${arg0}`);
                    }
                }

                // document.querySelector / querySelectorAll
                if (objText === 'document' && (prop === 'querySelector' || prop === 'querySelectorAll')) {
                    const arg0 = node.arguments[0] ? node.arguments[0].getText(sf).replace(/['"]/g, '') : '';
                    if (arg0 !== '#root') {
                        report(node, 'document.' + prop, `Forbidden querySelector('${arg0}')`);
                    }
                }

                // element.querySelector / querySelectorAll
                if (objText !== 'document' && (prop === 'querySelector' || prop === 'querySelectorAll')) {
                    report(node, 'element.' + prop, `Forbidden element query`);
                }

                // document.createElement / createElementNS
                if (objText === 'document' && (prop === 'createElement' || prop === 'createElementNS')) {
                    report(node, 'document.' + prop, `Imperative element creation`);
                }

                // DOM manipulation methods: appendChild, removeChild, replaceChild, insertBefore
                if (['appendChild', 'removeChild', 'replaceChild', 'insertBefore'].includes(prop)) {
                    report(node, '.' + prop, `Imperative DOM tree mutation`);
                }

                // classList methods: add, remove, toggle, replace
                if (['add', 'remove', 'toggle', 'replace'].includes(prop) && objText.endsWith('classList')) {
                    report(node, 'classList.' + prop, `Imperative class mutation`);
                }

                // addEventListener on DOM elements (excluding window, chrome, process)
                if (prop === 'addEventListener' || prop === 'removeEventListener') {
                    if (!['window', 'chrome.storage.onChanged', 'chrome.storage.local', 'chrome.runtime.onMessage'].includes(objText)) {
                        if (!(objText === 'document' && node.arguments[0] && node.arguments[0].getText(sf).includes('DOMContentLoaded'))) {
                            report(node, '.' + prop, `Manual event listener attachment`);
                        }
                    }
                }

                // .style.setProperty
                if (prop === 'setProperty' && objText.endsWith('style')) {
                    report(node, 'style.setProperty', `Imperative style mutation`);
                }
            }
        }

        // 2. Binary Expressions (Assignments)
        if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
            const left = node.left;
            if (ts.isPropertyAccessExpression(left)) {
                const prop = left.name.text;
                if (['innerHTML', 'innerText', 'textContent', 'outerHTML'].includes(prop)) {
                    report(node, '.' + prop + ' =', `Imperative HTML/text assignment`);
                }

                // .style.<prop> =
                if (ts.isPropertyAccessExpression(left.expression) && left.expression.name.text === 'style') {
                    report(node, '.style.<prop> =', `Imperative style assignment`);
                }
            }
        }

        ts.forEachChild(node, checkNode);
    }

    checkNode(sf);
    return { filePath, violations, isBoundary: false };
}

function main() {
    console.log('════════════════════════════════════════════════════════════');
    console.log('DECLARATIVE PREACT 11 DOM AUDIT');
    console.log('════════════════════════════════════════════════════════════\n');

    const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
    const filesToAudit = args.length > 0 ? args : TARGET_UI_FILES;

    let totalViolations = 0;
    const fileResults = [];

    for (const target of filesToAudit) {
        if (fs.existsSync(target)) {
            const res = auditFile(target);
            fileResults.push(res);
            totalViolations += res.violations.length;
        } else {
            console.warn(`[WARN] File not found: ${target}`);
        }
    }

    for (const res of fileResults) {
        const mark = res.violations.length === 0 ? '✓ PASS' : '✗ FAIL';
        const note = res.isBoundary ? ' [justified boundary]' : '';
        console.log(`${mark}: ${res.filePath} (${res.violations.length} imperative DOM calls${note})`);
        if (res.violations.length > 0 && res.violations.length <= 5) {
            for (const v of res.violations) {
                console.log(`    L${v.line}:${v.col} [${v.type}] ${v.snippet}`);
            }
        } else if (res.violations.length > 5) {
            for (const v of res.violations.slice(0, 3)) {
                console.log(`    L${v.line}:${v.col} [${v.type}] ${v.snippet}`);
            }
            console.log(`    ... and ${res.violations.length - 3} more`);
        }
    }

    console.log('\n════════════════════════════════════════════════════════════');
    console.log(`AUDIT SUMMARY: ${totalViolations} imperative DOM manipulation calls detected.`);
    console.log(`Target: 0 imperative calls outside justified boundaries.`);
    console.log('════════════════════════════════════════════════════════════');

    if (process.argv.includes('--strict') && totalViolations > 0) {
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = {
    auditFile,
    isJustifiedBoundary,
    JUSTIFIED_BOUNDARIES,
    TARGET_UI_FILES,
    main
};
