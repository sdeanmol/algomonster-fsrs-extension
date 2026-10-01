#!/usr/bin/env node
/**
 * @file scripts/check-artifact-isolation.js
 * @description Automated artifact isolation audit for Chrome and Firefox extension builds.
 *
 * Verifies:
 *   - Chrome artifact does NOT contain Firefox-only strings/URLs
 *   - Firefox artifact does NOT contain Chrome-only strings/URLs
 *   - Each artifact contains the correct browser-specific strings
 *
 * Usage:
 *   node scripts/check-artifact-isolation.js
 *
 * Exit codes:
 *   0 = all checks pass
 *   1 = one or more violations found
 */

const fs = require('fs');
const path = require('path');

// ─────────────────────────────────────────────────────────────────────────────
// Configuration: browser-specific strings/URLs that must be isolated
// ─────────────────────────────────────────────────────────────────────────────

const CHROME_ONLY = [
  'chromewebstore.google.com',
  'Rate on Chrome Web Store',
  'Chrome Web Store',
  'Rate us 5 stars on Chrome Web Store',
];

const FIREFOX_ONLY = [
  'addons.mozilla.org',
  'Rate on Firefox Add-ons',
  'Firefox Add-ons',
  'Rate us 5 stars on Firefox Add-ons',
];

const CHROME_REQUIRED = [
  'chromewebstore.google.com',
];

const FIREFOX_REQUIRED = [
  'addons.mozilla.org',
];

const DIST_CHROME = path.join(__dirname, '..', 'dist', 'chrome');
const DIST_FIREFOX = path.join(__dirname, '..', 'dist', 'firefox');

// ─────────────────────────────────────────────────────────────────────────────
// Utility: collect all JS files recursively in a directory
// ─────────────────────────────────────────────────────────────────────────────

function collectJsFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectJsFiles(full));
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      results.push(full);
    }
  }
  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility: search all JS files for a string
// ─────────────────────────────────────────────────────────────────────────────

function findInFiles(files, pattern) {
  const matches = [];
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    if (content.includes(pattern)) {
      matches.push(path.relative(process.cwd(), file));
    }
  }
  return matches;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main audit
// ─────────────────────────────────────────────────────────────────────────────

function run() {
  let passed = 0;
  let failed = 0;

  const chromeFiles = collectJsFiles(DIST_CHROME);
  const firefoxFiles = collectJsFiles(DIST_FIREFOX);

  if (chromeFiles.length === 0) {
    console.error('ERROR: No JS files found in dist/chrome — run npm run build:chrome first');
    process.exit(1);
  }
  if (firefoxFiles.length === 0) {
    console.error('ERROR: No JS files found in dist/firefox — run npm run build:firefox first');
    process.exit(1);
  }

  console.log(`\n${'═'.repeat(60)}`);
  console.log('BROWSER ARTIFACT ISOLATION AUDIT');
  console.log(`${'═'.repeat(60)}\n`);

  // ── 1. Chrome artifact must NOT contain Firefox-only strings ──────────────
  console.log('► Chrome artifact: must NOT contain Firefox-only content');
  for (const pattern of FIREFOX_ONLY) {
    const found = findInFiles(chromeFiles, pattern);
    if (found.length > 0) {
      console.error(`  ✗ FAIL: Firefox-only string "${pattern}" found in Chrome artifact:`);
      found.forEach(f => console.error(`      ${f}`));
      failed++;
    } else {
      console.log(`  ✓ PASS: "${pattern}" not in Chrome build`);
      passed++;
    }
  }

  // ── 2. Firefox artifact must NOT contain Chrome-only strings ──────────────
  console.log('\n► Firefox artifact: must NOT contain Chrome-only content');
  for (const pattern of CHROME_ONLY) {
    const found = findInFiles(firefoxFiles, pattern);
    if (found.length > 0) {
      console.error(`  ✗ FAIL: Chrome-only string "${pattern}" found in Firefox artifact:`);
      found.forEach(f => console.error(`      ${f}`));
      failed++;
    } else {
      console.log(`  ✓ PASS: "${pattern}" not in Firefox build`);
      passed++;
    }
  }

  // ── 3. Chrome artifact must CONTAIN required Chrome strings ───────────────
  console.log('\n► Chrome artifact: must CONTAIN required Chrome-specific content');
  for (const pattern of CHROME_REQUIRED) {
    const found = findInFiles(chromeFiles, pattern);
    if (found.length === 0) {
      console.error(`  ✗ FAIL: Required Chrome string "${pattern}" missing from Chrome artifact`);
      failed++;
    } else {
      console.log(`  ✓ PASS: "${pattern}" present in Chrome build`);
      passed++;
    }
  }

  // ── 4. Firefox artifact must CONTAIN required Firefox strings ─────────────
  console.log('\n► Firefox artifact: must CONTAIN required Firefox-specific content');
  for (const pattern of FIREFOX_REQUIRED) {
    const found = findInFiles(firefoxFiles, pattern);
    if (found.length === 0) {
      console.error(`  ✗ FAIL: Required Firefox string "${pattern}" missing from Firefox artifact`);
      failed++;
    } else {
      console.log(`  ✓ PASS: "${pattern}" present in Firefox build`);
      passed++;
    }
  }

  // ── 5. Manifest isolation ─────────────────────────────────────────────────
  console.log('\n► Manifest isolation');
  const chromeManifest = path.join(DIST_CHROME, 'manifest.json');
  const firefoxManifest = path.join(DIST_FIREFOX, 'manifest.json');

  if (fs.existsSync(chromeManifest)) {
    const m = JSON.parse(fs.readFileSync(chromeManifest, 'utf8'));
    if (m.browser_specific_settings) {
      console.error('  ✗ FAIL: Chrome manifest contains browser_specific_settings (Firefox-only field)');
      failed++;
    } else {
      console.log('  ✓ PASS: Chrome manifest has no browser_specific_settings');
      passed++;
    }
    if (m.background && m.background.service_worker) {
      console.log('  ✓ PASS: Chrome manifest uses service_worker for background');
      passed++;
    } else {
      console.error('  ✗ FAIL: Chrome manifest missing background.service_worker');
      failed++;
    }
  } else {
    console.error('  ✗ FAIL: Chrome manifest.json not found');
    failed++;
  }

  if (fs.existsSync(firefoxManifest)) {
    const m = JSON.parse(fs.readFileSync(firefoxManifest, 'utf8'));
    if (m.browser_specific_settings && m.browser_specific_settings.gecko) {
      console.log('  ✓ PASS: Firefox manifest has browser_specific_settings.gecko');
      passed++;
    } else {
      console.error('  ✗ FAIL: Firefox manifest missing browser_specific_settings.gecko');
      failed++;
    }
    if (m.background && m.background.scripts) {
      console.log('  ✓ PASS: Firefox manifest uses scripts for background');
      passed++;
    } else {
      console.error('  ✗ FAIL: Firefox manifest missing background.scripts');
      failed++;
    }
    if (!m.cross_origin_embedder_policy) {
      console.log('  ✓ PASS: Firefox manifest has no cross_origin_embedder_policy (Chrome-only field)');
      passed++;
    } else {
      console.error('  ✗ FAIL: Firefox manifest contains cross_origin_embedder_policy (Chrome-only)');
      failed++;
    }
  } else {
    console.error('  ✗ FAIL: Firefox manifest.json not found');
    failed++;
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`ARTIFACT ISOLATION AUDIT COMPLETE`);
  console.log(`  Passed: ${passed}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Result: ${failed === 0 ? '✅ ALL CHECKS PASSED' : '❌ VIOLATIONS FOUND'}`);
  console.log(`${'═'.repeat(60)}\n`);

  process.exit(failed > 0 ? 1 : 0);
}

run();
