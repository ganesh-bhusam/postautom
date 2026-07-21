import { CONFIG, getRandomDelay } from '../config.js';
import { logger } from '../utils/logger.js';

/**
 * Apex Human Interaction & Action Execution Unit
 * Direct Status Navigation Architecture - Zero Stale DOM Errors
 */
export class Interactor {
  /**
   * Type text into input with human micro-delays and React event dispatching
   * @param {import('playwright').Page} page
   * @param {import('playwright').ElementHandle} element
   * @param {string} text
   */
  static async humanType(page, element, text) {
    await element.focus();
    await page.waitForTimeout(300);

    // Type character by character with human delay
    for (const char of text) {
      await page.keyboard.type(char, {
        delay: getRandomDelay(CONFIG.TYPING_DELAY_MIN, CONFIG.TYPING_DELAY_MAX),
      });
    }

    // Force React input listeners to register text change and enable post button
    await element.evaluate((el) => {
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.waitForTimeout(500);
  }

  /**
   * Navigate safely to target tweet status page
   * @param {import('playwright').Page} page
   * @param {object} tweetData
   */
  static async navigateToTweet(page, tweetData) {
    const targetUrl = tweetData.tweetUrl && tweetData.tweetUrl.includes('/status/')
      ? tweetData.tweetUrl
      : `https://x.com/i/status/${tweetData.tweetId}`;

    logger.info(`Navigating directly to target tweet URL: ${targetUrl}...`);
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);
  }

  /**
   * Auto-like target tweet on direct status page
   * @param {import('playwright').Page} page
   * @param {object} tweetData
   */
  static async autoLike(page, tweetData) {
    if (!CONFIG.AUTO_LIKE_ENABLED) return;

    try {
      if (CONFIG.DRY_RUN) {
        logger.apex(`[DRY-RUN] Would click LIKE on Tweet [${tweetData.tweetId}]`);
        return;
      }

      // Check if already liked
      const unlikeButton = await page.$('[data-testid="unlike"]');
      if (unlikeButton) {
        logger.info(`Tweet [${tweetData.tweetId}] is already liked. Skipping like.`);
        return;
      }

      const likeButton = await page.waitForSelector('[data-testid="like"]', {
        state: 'visible',
        timeout: 6000,
      });

      if (likeButton) {
        await page.waitForTimeout(getRandomDelay(400, 900));
        await likeButton.click();
        logger.success(`Liked tweet by ${tweetData.author}`);
      }
    } catch (err) {
      logger.warn(`Could not like tweet [${tweetData.tweetId}]: ${err.message}`);
    }
  }

  /**
   * Post AI-generated reply to target tweet on status page
   * @param {import('playwright').Page} page
   * @param {object} tweetData
   * @param {string} replyText
   */
  static async autoReply(page, tweetData, replyText) {
    if (!CONFIG.AUTO_REPLY_ENABLED) return;

    const authorHandle = tweetData.author.startsWith('@') ? tweetData.author : `@${tweetData.author}`;

    try {
      if (CONFIG.DRY_RUN) {
        logger.apex(`[DRY-RUN] Would post reply to ${authorHandle}: "${replyText}"`);
        return;
      }

      logger.info(`Preparing reply for post by ${authorHandle}...`);

      // Step 1: Locate Reply Box (on Status Page or in Reply Modal)
      let replyBox = await page.$('[data-testid="tweetTextarea_0"]');

      if (!replyBox) {
        // If not directly visible, click reply button to open modal
        const replyBtn = await page.waitForSelector('[data-testid="reply"]', {
          state: 'visible',
          timeout: 6000,
        });
        if (replyBtn) {
          await replyBtn.click();
          await page.waitForTimeout(1000);
        }

        replyBox = await page.waitForSelector('[data-testid="tweetTextarea_0"]', {
          state: 'visible',
          timeout: 8000,
        });
      }

      if (!replyBox) {
        throw new Error('Reply text input box failed to appear.');
      }

      // Step 2: Simulate human reading pause
      const pauseTime = getRandomDelay(CONFIG.READING_PAUSE_MIN, CONFIG.READING_PAUSE_MAX);
      logger.info(`Simulating human composition pause (${pauseTime}ms)...`);
      await page.waitForTimeout(pauseTime);

      // Step 3: Type reply with human keystroke cadence
      logger.info(`Typing reply with human keystroke cadence...`);
      await Interactor.humanType(page, replyBox, replyText);

      // Step 4: Locate Post Submit Button (handling enabled state)
      const postBtnSelector = '[data-testid="tweetButtonInline"], [data-testid="tweetButton"]';
      const postButton = await page.waitForSelector(postBtnSelector, {
        state: 'visible',
        timeout: 10000,
      });

      if (!postButton) {
        throw new Error('Post submit button not found.');
      }

      // Ensure button is enabled (if disabled, click input and press Space/Backspace to trigger state)
      const isDisabled = await postButton.getAttribute('disabled');
      if (isDisabled !== null) {
        logger.info('Post button currently disabled. Re-triggering input events...');
        await replyBox.click();
        await page.keyboard.press('Space');
        await page.keyboard.press('Backspace');
        await page.waitForTimeout(800);
      }

      // Step 5: Click Post Button
      await postButton.click({ force: true });
      logger.success(`Successfully posted reply to ${authorHandle}: "${replyText}"`);

      // Step 6: Action Cooldown Jitter (Rate-Limit Protection)
      const cooldown = getRandomDelay(CONFIG.ACTION_COOLDOWN_MIN, CONFIG.ACTION_COOLDOWN_MAX);
      logger.info(`Enforcing rate-limit cooldown (${(cooldown / 1000).toFixed(1)}s)...`);
      await page.waitForTimeout(cooldown);
    } catch (err) {
      logger.error(`Failed to complete auto-reply on tweet [${tweetData.tweetId}]`, err);

      // Dismiss modal if present
      try {
        const closeBtn = await page.$('[data-testid="app-bar-close"]');
        if (closeBtn) await closeBtn.click();
      } catch (ignored) {}
    }
  }
}
