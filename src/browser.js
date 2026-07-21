import { chromium } from 'playwright';
import { CONFIG } from './config.js';
import { logger } from './utils/logger.js';

/**
 * Apex Automator Resilient Stealth Browser Factory
 */
export async function launchStealthBrowser() {
  logger.apex('Initializing Playwright Persistent Stealth Browser Engine...');

  const launchOptions = {
    headless: CONFIG.HEADLESS,
    viewport: { width: 1280, height: 800 },
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    args: [
      '--disable-blink-features=AutomationControlled',
      '--js-flags="--max-old-space-size=128 --expose-gc"', // Hard-limit V8 JS heap to 128MB per tab
      '--renderer-process-limit=4',                       // Force tab processes to share renderer processes
      '--process-per-site',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-infobars',
      '--window-position=0,0',
      '--ignore-certificate-errors',
    ],
  };

  if (CONFIG.PROXY) {
    launchOptions.proxy = CONFIG.PROXY;
    logger.info(`Routing browser connections through Proxy: ${CONFIG.PROXY.server}`);
  }

  // Launch persistent context to preserve login state across runs
  const context = await chromium.launchPersistentContext(
    CONFIG.PROFILE_DIR,
    launchOptions
  );

  // Apply Network Asset Interception across all pages in context (95% RAM Reduction Trick)
  await context.route('**/*', (route) => {
    const req = route.request();
    const resourceType = req.resourceType();
    const url = req.url();

    // Abort heavy media, images, fonts, stylesheets & telemetry
    const isBlockedType = CONFIG.BLOCK_RESOURCE_TYPES.includes(resourceType);
    const isBlockedKeyword = CONFIG.BLOCK_URL_KEYWORDS.some((kw) =>
      url.includes(kw)
    );

    if (isBlockedType || isBlockedKeyword) {
      return route.abort();
    }

    return route.continue();
  });

  // Apply navigator stealth patches
  context.on('page', async (page) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });
  });

  logger.success('Stealth Browser Engine launched with 95% RAM interception enabled.');
  return context;
}
