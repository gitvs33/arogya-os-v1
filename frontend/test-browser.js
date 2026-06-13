import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('BROWSER ERROR:', msg.text());
    }
  });
  
  page.on('pageerror', err => {
    console.log('PAGE ERROR:', err.message);
  });
  
  try {
    await page.goto('http://localhost:5173/admin', { waitUntil: 'networkidle0' });
    console.log('Page loaded');
    // Click on a few tabs
    const tabs = ['User Management', 'Role Management', 'Department Setup', 'Master Data', 'System Settings', 'Workflow Setup', 'Device Integration', 'Security & Access', 'Audit Logs', 'Backup & Restore'];
    
    for (const tab of tabs) {
      console.log('Clicking tab:', tab);
      const [button] = await page.$x(`//button[contains(., '${tab}')]`);
      if (button) {
        await button.click();
        await page.waitForTimeout(500); // let react render
      }
    }
  } catch(e) {
    console.log('Script error', e);
  }
  
  await browser.close();
})();
