import { Interactor } from '../actions/interactor.js';
import { MemoryManager } from '../utils/memory.js';
import { logger } from '../utils/logger.js';

/**
 * Apex Parallel Multi-Tab Worker Pool Engine
 * Spawns multiple parallel Playwright browser tabs to process tasks concurrently with ultra-fast execution.
 */
export class ParallelWorkerPool {
  /**
   * Process scraped target tweets concurrently across parallel worker tabs
   * @param {import('playwright').BrowserContext} context
   * @param {Array<object>} posts
   * @param {import('../ai/replyGenerator.js').ReplyGenerator} replyGen
   * @param {number} maxConcurrency
   */
  async processQueue(context, posts, replyGen, maxConcurrency = 5) {
    if (posts.length === 0) return 0;

    logger.apex(`----------------------------------------------------------------`);
    logger.apex(`PARALLEL WORKER POOL ACTIVATED`);
    logger.apex(`Processing ${posts.length} targets across ${maxConcurrency} parallel browser tabs...`);
    logger.apex(`----------------------------------------------------------------`);

    let completedCount = 0;
    const taskQueue = [...posts];

    // Create a pool of parallel worker page instances
    const workerCount = Math.min(maxConcurrency, posts.length);
    const workerPromises = [];

    for (let workerId = 1; workerId <= workerCount; workerId++) {
      workerPromises.push(
        this.runWorker(workerId, context, taskQueue, replyGen, () => {
          completedCount++;
        })
      );
    }

    // Wait for all parallel worker tabs to finish processing the queue
    await Promise.all(workerPromises);

    logger.success(`Parallel Worker Pool execution complete! Total processed: ${completedCount}/${posts.length}`);
    return completedCount;
  }

  /**
   * Individual worker tab thread pulling items from shared queue
   */
  async runWorker(workerId, context, taskQueue, replyGen, onTaskComplete) {
    logger.info(`[Worker Tab #${workerId}] Initialized and listening for tasks...`);

    // Create dedicated Playwright worker page tab
    const page = await context.newPage();

    try {
      while (taskQueue.length > 0) {
        if (page.isClosed()) break;

        const tweet = taskQueue.shift();
        if (!tweet) break;

        logger.info(`[Worker Tab #${workerId}] Picked up Tweet ID: ${tweet.tweetId} by ${tweet.author}`);

        try {
          // Step 1: Direct Status Page Navigation in Worker Tab
          await Interactor.navigateToTweet(page, tweet);

          // Step 2: Auto-Like Action
          await Interactor.autoLike(page, tweet);

          // Step 3: Generate Web UI LLM Reply
          const aiReply = await replyGen.generateReply(tweet.tweetText, tweet.author);

          // Step 4: Post Reply Action
          await Interactor.autoReply(page, tweet, aiReply);

          onTaskComplete();
          logger.success(`[Worker Tab #${workerId}] Completed target [${tweet.tweetId}]`);
        } catch (err) {
          logger.error(`[Worker Tab #${workerId}] Error processing tweet ${tweet.tweetId}`, err);
        }
      }
    } finally {
      if (!page.isClosed()) {
        await page.close();
        logger.info(`[Worker Tab #${workerId}] Queue empty. Closed worker tab.`);
      }
    }
  }
}
