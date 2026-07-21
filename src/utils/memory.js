import { logger } from './logger.js';

/**
 * Memory Management Utility for Browser and Node process
 */
export class MemoryManager {
  /**
   * Triggers Chrome DevTools Protocol (CDP) forced garbage collection
   * @param {import('playwright').Page} page 
   */
  static async triggerCDPGarbageCollection(page) {
    try {
      const client = await page.context().newCDPSession(page);
      await client.send('Memory.forciblyPurgeJavaScriptMemory');
      await client.detach();
      logger.info('CDP: Forcibly purged browser JavaScript memory heap.');
    } catch (err) {
      logger.warn(`CDP GC purge notice: ${err.message}`);
    }
  }

  /**
   * Log current Node.js heap memory usage statistics
   */
  static logNodeMemoryUsage() {
    const memoryUsage = process.memoryUsage();
    const heapUsedMB = (memoryUsage.heapUsed / 1024 / 1024).toFixed(2);
    const heapTotalMB = (memoryUsage.heapTotal / 1024 / 1024).toFixed(2);
    const rssMB = (memoryUsage.rss / 1024 / 1024).toFixed(2);

    logger.info(`RAM Stats - Node Heap: ${heapUsedMB} MB / ${heapTotalMB} MB | RSS: ${rssMB} MB`);
  }
}
