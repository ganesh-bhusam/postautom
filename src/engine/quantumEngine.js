import { Interactor } from '../actions/interactor.js';
import { ReplyGenerator } from '../ai/replyGenerator.js';
import { logger } from '../utils/logger.js';
import { MemoryManager } from '../utils/memory.js';

/**
 * Apex Quantum Architecture: High-Performance Parallel Worker Engine
 * Executes actual auto-likes and auto-replies across parallel worker tabs in Playwright.
 */
export class QuantumEngine {
  constructor(concurrency = 5) {
    this.concurrency = concurrency; // Number of parallel worker tabs (e.g. 5 concurrent browser tabs)
  }

  /**
   * Run parallel worker queue execution cycle
   * @param {import('playwright').BrowserContext} context
   * @param {Array<object>} posts
   */
  async executeParallelPool(context, posts) {
    if (posts.length === 0) {
      logger.warn('No target posts provided to Quantum Engine.');
      return 0;
    }

    const workerCount = Math.min(this.concurrency, posts.length);

    logger.apex(`===================================================================`);
    logger.apex(`⚡ QUANTUM ENGINE ACTIVATED: Running ${workerCount} Parallel Worker Tabs ⚡`);
    logger.apex(`Processing ${posts.length} targets with live auto-likes & auto-replies...`);
    logger.apex(`===================================================================`);

    const replyGen = new ReplyGenerator();
    await replyGen.initialize(context);

    let completedCount = 0;
    const taskQueue = [...posts];

    // Create pool of parallel worker page instances
    const workerPromises = [];

    for (let workerId = 1; workerId <= workerCount; workerId++) {
      workerPromises.push(
        this.runWorkerTab(workerId, context, taskQueue, replyGen, () => {
          completedCount++;
        })
      );
    }

    await Promise.all(workerPromises);

    MemoryManager.logNodeMemoryUsage();
    logger.success(`Quantum execution complete! Successfully processed and posted: ${completedCount}/${posts.length}`);
    return completedCount;
  }

  /**
   * Thread worker page tab running actual browser actions
   */
  async runWorkerTab(workerId, context, taskQueue, replyGen, onComplete) {
    logger.info(`[Quantum Worker Tab #${workerId}] Initialized browser tab...`);
    const page = await context.newPage();

    try {
      while (taskQueue.length > 0) {
        if (page.isClosed()) break;

        const tweet = taskQueue.shift();
        if (!tweet) break;

        logger.info(`----------------------------------------------------------------`);
        logger.info(`[Quantum Worker Tab #${workerId}] Processing Tweet ID: ${tweet.tweetId} by ${tweet.author}`);

        try {
          // Step 1: Direct Status Page Navigation (Guarantees zero stale DOM element handles)
          await Interactor.navigateToTweet(page, tweet);

          // Step 2: Live Auto-Like Action on X
          await Interactor.autoLike(page, tweet);

          // Step 3: Generate Contextual AI Response via LLM Swapper
          const aiReply = await replyGen.generateReply(tweet.tweetText, tweet.author);

          // Step 4: Live Auto-Reply Submission on X
          await Interactor.autoReply(page, tweet, aiReply);

          onComplete();
          logger.success(`[Quantum Worker Tab #${workerId}] Finished & posted on target [${tweet.tweetId}]`);
        } catch (err) {
          logger.error(`[Quantum Worker Tab #${workerId}] Error on tweet ${tweet.tweetId}`, err);
        }
      }
    } finally {
      if (!page.isClosed()) {
        await page.close();
        logger.info(`[Quantum Worker Tab #${workerId}] Queue empty. Closed worker tab.`);
      }
    }
  }
}
