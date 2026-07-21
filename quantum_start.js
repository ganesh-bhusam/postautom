import { CONFIG, validateConfig } from './src/config.js';
import { launchStealthBrowser } from './src/browser.js';
import { FeedScraper } from './src/scrapers/feedScraper.js';
import { QuantumEngine } from './src/engine/quantumEngine.js';
import { logger } from './src/utils/logger.js';
import { MemoryManager } from './src/utils/memory.js';

async function runQuantumEngine() {
  console.log(`
===================================================================
   ⚡ APEX QUANTUM ENGINE: 50-PARALLEL WORKER THREAD ENGINE ⚡
   Architecture: Multi-Threaded Async Workers | 0-API | 0 RAM Bloat
===================================================================
  `);

  validateConfig();
  let context = null;

  try {
    context = await launchStealthBrowser();
    const mainPage = context.pages()[0] || (await context.newPage());

    logger.info(`Navigating to X timeline feed: ${CONFIG.X_TARGET_URL}...`);
    await mainPage.goto(CONFIG.X_TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await mainPage.waitForTimeout(3000);

    const scraper = new FeedScraper();
    const targetPosts = await scraper.scrapeFeed(mainPage, 50); // Scrape up to 50 posts

    if (targetPosts.length === 0) {
      logger.warn('No new unprocessed posts found in feed scan.');
    } else {
      // Execute 50-Parallel Quantum Engine
      const quantum = new QuantumEngine(50); // 50 Parallel Worker Threads
      await quantum.executeParallelPool(context, targetPosts);
    }

    MemoryManager.logNodeMemoryUsage();
    logger.apex('Quantum Engine execution cycle completed successfully.');
  } catch (err) {
    logger.error('Fatal error during Quantum Engine execution', err);
  } finally {
    if (context) {
      await context.close();
    }
    process.exit(0);
  }
}

runQuantumEngine();
