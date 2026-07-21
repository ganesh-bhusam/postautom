import fs from 'fs';
import { CONFIG, getRandomDelay } from '../config.js';
import { logger } from '../utils/logger.js';

/**
 * Apex X Feed Scraper & DOM Extractor
 * Extracts pure serializable metadata to eliminate DOM Stale Element errors.
 */
export class FeedScraper {
  constructor() {
    this.history = this.loadHistory();
  }

  /**
   * Load history registry of already processed tweets
   */
  loadHistory() {
    try {
      if (fs.existsSync(CONFIG.HISTORY_FILE)) {
        const raw = fs.readFileSync(CONFIG.HISTORY_FILE, 'utf-8');
        return new Set(JSON.parse(raw));
      }
    } catch (err) {
      logger.warn(`Could not load history file, starting clean: ${err.message}`);
    }
    return new Set();
  }

  /**
   * Save history registry to file
   */
  saveHistory() {
    try {
      fs.writeFileSync(
        CONFIG.HISTORY_FILE,
        JSON.stringify(Array.from(this.history), null, 2)
      );
    } catch (err) {
      logger.error('Failed to save history file', err);
    }
  }

  /**
   * Scroll X feed smoothly and scrape visible tweet metadata
   * @param {import('playwright').Page} page
   * @param {number} targetCount
   */
  async scrapeFeed(page, targetCount = 10) {
    logger.info(`Scanning X timeline feed for target posts (Target count: ${targetCount})...`);
    const scrapedPosts = [];
    let scrollAttempts = 0;
    const maxScrolls = 25;

    while (scrapedPosts.length < targetCount && scrollAttempts < maxScrolls) {
      if (page.isClosed()) {
        logger.warn('Browser page closed during feed scanning.');
        break;
      }

      // Extract tweets currently visible in the DOM
      const rawTweets = await page.$$('[data-testid="tweet"]');

      for (const tweetHandle of rawTweets) {
        if (scrapedPosts.length >= targetCount) break;

        try {
          // Extract Tweet Text
          const textEl = await tweetHandle.$('[data-testid="tweetText"]');
          const tweetText = textEl ? (await textEl.innerText()).trim() : '';

          // Extract User Handle
          const userEl = await tweetHandle.$('[data-testid="User-Name"]');
          const userText = userEl ? await userEl.innerText() : '';
          const authorMatch = userText.match(/@[\w_]+/);
          let author = authorMatch ? authorMatch[0] : '';
          // Clean handle (ensure single @)
          author = author ? (author.startsWith('@') ? author : `@${author}`) : '@unknown';

          // Skip ad posts / promoted posts
          const isPromoted = userText.includes('Ad') || userText.includes('Promoted');
          if (isPromoted) continue;

          // Extract Status Link / Tweet ID
          let tweetId = '';
          let tweetUrl = '';

          const timeLinkEl = await tweetHandle.$('time');
          if (timeLinkEl) {
            const anchorEl = await timeLinkEl.evaluateHandle((el) => el.closest('a'));
            if (anchorEl) {
              const href = await anchorEl.getAttribute('href');
              if (href && href.includes('/status/')) {
                const parts = href.split('/status/');
                tweetId = parts[1] ? parts[1].split('?')[0] : '';
                tweetUrl = `https://x.com${href.split('?')[0]}`;
              }
            }
          }

          // Fallback Tweet ID if status link not found
          if (!tweetId && tweetText) {
            tweetId = `${author.replace('@', '')}_${tweetText.slice(0, 15).replace(/\W+/g, '_')}`;
            tweetUrl = `https://x.com/home`;
          }

          if (!tweetId || this.history.has(tweetId)) {
            continue; // Skip duplicates or previously processed tweets
          }

          // Check if post has reply button
          const replyButton = await tweetHandle.$('[data-testid="reply"]');
          if (!tweetText || !replyButton) {
            continue;
          }

          scrapedPosts.push({
            tweetId,
            author,
            tweetText,
            tweetUrl,
          });

          this.history.add(tweetId);
          logger.success(`Scraped Post [${tweetId}] by ${author}: "${tweetText.slice(0, 50).replace(/\n/g, ' ')}..."`);
        } catch (err) {
          continue;
        }
      }

      if (scrapedPosts.length < targetCount && !page.isClosed()) {
        const scrollDelta = getRandomDelay(450, 900);
        await page.evaluate((delta) => {
          window.scrollBy({ top: delta, behavior: 'smooth' });
        }, scrollDelta);

        const pause = getRandomDelay(1500, 3000);
        await page.waitForTimeout(pause);
        scrollAttempts++;
      }
    }

    this.saveHistory();
    logger.apex(`Feed scan complete. Retained ${scrapedPosts.length} fresh unprocessed posts.`);
    return scrapedPosts;
  }
}
