const { chromium } = require('playwright');
const { injectChromePolyfill } = require('./tests/e2e/helpers/chrome-polyfill');
const os = require('os');
const path = require('path');
const fs = require('fs');

(async () => {
  const userDataDir = path.join(os.tmpdir(), `test-profile-${Date.now()}`);
  fs.mkdirSync(userDataDir, { recursive: true });
  const browser = await chromium.launchPersistentContext(userDataDir, {
    channel: 'chrome',
    headless: true
  });
  const page = await browser.newPage();
  await page.setContent('<html><body><h1>Hello</h1></body></html>');
  await page.evaluate(injectChromePolyfill, { test: 'value' });
  const val = await page.evaluate(() => window.__e2eStore);
  console.log('Value:', val);
  await browser.close();
})();
