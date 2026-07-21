import { CONFIG, validateConfig } from './src/config.js';
import { launchStealthBrowser } from './src/browser.js';
import { FeedScraper } from './src/scrapers/feedScraper.js';
import { ReplyGenerator } from './src/ai/replyGenerator.js';
import { ParallelWorkerPool } from './src/queue/parallelWorkerPool.js';
import { logger } from './src/utils/logger.js';
import { MemoryManager } from './src/utils/memory.js';

async function main() {
  console.log(`
===================================================================
   ⚡ APEX AUTOMATOR: X (TWITTER) AUTONOMOUS ENGINE ⚡
   Architecture: 100% 0-API | Parallel Multi-Tab Workers | LLM Swapper
===================================================================
  `);

  validateConfig();

  let context = null;

  try {
    // 1. Launch Ultra-Low Memory Stealth Browser Context
    context = await launchStealthBrowser();
    const mainPage = context.pages()[0] || (await context.newPage());

    // 2. Navigate to Target Feed
    logger.info(`Navigating to target X URL: ${CONFIG.X_TARGET_URL}...`);
    await mainPage.goto(CONFIG.X_TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await mainPage.waitForTimeout(3000);

    // 3. Verify Session / Login State
    const currentUrl = mainPage.url();
    if (currentUrl.includes('/login') || currentUrl.includes('/i/flow/login')) {
      logger.warn('------------------------------------------------------------------');
      logger.warn('X LOGIN REQUIRED!');
      logger.warn('Please log into your X account in the opened browser window.');
      logger.warn('Session cookies will save automatically in user_data_dir.');
      logger.warn('------------------------------------------------------------------');

      await mainPage.waitForURL((url) => url.toString().includes('/home'), { timeout: 180000 });
      logger.success('Login detected! Session saved to user_data_dir.');
    }

    // 4. Initialize Core Engine Components
    const scraper = new FeedScraper();
    const replyGen = new ReplyGenerator();
    await replyGen.initialize(context);
    const workerPool = new ParallelWorkerPool();

    // 5. Scrape Feed Posts
    const targetPosts = await scraper.scrapeFeed(mainPage, CONFIG.MAX_TARGET_POSTS);

    if (targetPosts.length === 0) {
      logger.warn('No new unprocessed posts found in feed scan.');
    } else {
      // 6. Process Queue in PARALLEL across 5 Concurrent Worker Tabs
      await workerPool.processQueue(
        context,
        targetPosts,
        replyGen,
        CONFIG.CONCURRENT_WORKER_TABS
      );
    }

    MemoryManager.logNodeMemoryUsage();
    logger.apex('Parallel Execution cycle completed successfully. System ready for next run.');
  } catch (err) {
    logger.error('Fatal engine error during execution lifecycle', err);
  } finally {
    if (context) {
      logger.info('Shutting down stealth browser context...');
      await context.close();
    }
    process.exit(0);
  }
}

main();
