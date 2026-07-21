import { Interactor } from '../actions/interactor.js';
import { MemoryManager } from '../utils/memory.js';
import { logger } from '../utils/logger.js';

/**
 * Apex Sequential Worker Pool Queue Engine
 */
export class WorkerPool {
  /**
   * Process scraped target tweets sequentially through the AI & Interaction Pipeline
   * @param {import('playwright').Page} page
   * @param {Array<object>} posts
   * @param {import('../ai/replyGenerator.js').ReplyGenerator} replyGen
   * @param {number} maxReplies
   */
  async processQueue(page, posts, replyGen, maxReplies) {
    logger.apex(`Worker Pool initialized. Processing ${posts.length} queued targets...`);
    let processedCount = 0;

    for (let i = 0; i < posts.length; i++) {
      if (processedCount >= maxReplies) {
        logger.apex(`Reached max replies limit (${maxReplies}) for this session execution.`);
        break;
      }

      if (page.isClosed()) {
        logger.warn('Browser page closed during queue processing.');
        break;
      }

      const tweet = posts[i];
      logger.info(`----------------------------------------------------------------`);
      logger.info(`[Queue ${i + 1}/${posts.length}] Processing Tweet ID: ${tweet.tweetId} by ${tweet.author}`);

      try {
        // 1. Direct Tweet Navigation (Guarantees zero stale DOM element handles)
        await Interactor.navigateToTweet(page, tweet);

        // 2. Auto-Like Action on Direct Status Page
        await Interactor.autoLike(page, tweet);

        // 3. Generate Gemini / Multi-LLM Reply
        const aiReply = await replyGen.generateReply(tweet.tweetText, tweet.author);

        // 4. Post Reply Action on Direct Status Page
        await Interactor.autoReply(page, tweet, aiReply);

        processedCount++;

        // 5. Periodically Purge Memory via CDP
        if (processedCount % 2 === 0 && !page.isClosed()) {
          await MemoryManager.triggerCDPGarbageCollection(page);
          MemoryManager.logNodeMemoryUsage();
        }
      } catch (err) {
        logger.error(`Worker error on tweet ${tweet.tweetId}`, err);
      }
    }

    logger.success(`Queue execution complete. Successfully processed ${processedCount} posts.`);
    return processedCount;
  }
}
