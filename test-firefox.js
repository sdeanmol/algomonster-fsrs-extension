const { firefox } = require('playwright');
(async () => {
  try {
    const browser = await firefox.launchPersistentContext('/tmp/ff-profile', {
      headless: false,
      args: [
        '--disable-extensions-except=' + process.cwd() + '/dist/firefox',
        '--load-extension=' + process.cwd() + '/dist/firefox'
      ]
    });
    console.log("Firefox launched successfully");
    await browser.close();
  } catch (e) {
    console.error("Firefox launch failed", e);
  }
})();
