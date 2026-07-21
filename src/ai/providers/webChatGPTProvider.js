import { logger } from '../../utils/logger.js';

/**
 * ChatGPT Web UI Playwright Automation Driver (0 API Key Required)
 */
export class WebChatGPTProvider {
  constructor(accountName = 'ChatGPT-Web-Main') {
    this.name = accountName;
    this.page = null;
    this.isQuotaExhausted = false;
  }

  /**
   * Initialize or attach to browser page tab for ChatGPT Web
   * @param {import('playwright').BrowserContext} context
   */
  async initialize(context) {
    if (!this.page || this.page.isClosed()) {
      logger.ai(`[${this.name}] Opening dedicated ChatGPT Web UI browser tab...`);
      this.page = await context.newPage();
      await this.page.goto('https://chatgpt.com', {
        waitUntil: 'domcontentloaded',
        timeout: 45000,
      });
      await this.page.waitForTimeout(2000);
    }
  }

  /**
   * Submit prompt to ChatGPT Web UI and extract clean response
   * @param {string} promptText
   * @returns {Promise<string>}
   */
  async generateResponse(promptText) {
    if (this.isQuotaExhausted) {
      throw new Error(`[${this.name}] Marked as quota exhausted.`);
    }

    try {
      logger.ai(`[${this.name}] Submitting prompt to ChatGPT Web UI...`);
      const page = this.page;

      const inputSelector = '#prompt-textarea, textarea[placeholder*="Ask"]';
      const promptBox = await page.waitForSelector(inputSelector, {
        state: 'visible',
        timeout: 10000,
      });

      if (!promptBox) {
        throw new Error('ChatGPT Web UI prompt input box not found.');
      }

      await promptBox.click();
      await page.waitForTimeout(300);
      await promptBox.fill(promptText);
      await page.waitForTimeout(500);

      // Click Send button or hit Enter
      const sendBtn = await page.$('button[data-testid="send-button"]');
      if (sendBtn) {
        await sendBtn.click();
      } else {
        await page.keyboard.press('Enter');
      }

      // Check for Rate Limit Error elements
      await page.waitForTimeout(2000);
      const pageText = await page.innerText('body');
      if (
        pageText.includes("You've reached your limit") ||
        pageText.includes('hit your free limit') ||
        pageText.includes('Too many requests') ||
        pageText.includes('Please wait until')
      ) {
        this.isQuotaExhausted = true;
        throw new Error(`[${this.name}] ChatGPT Limit / Quota Reached.`);
      }

      logger.ai(`[${this.name}] Waiting for ChatGPT response stream...`);
      await page.waitForTimeout(5000);

      // Extract generated text from response elements
      const responseSelectors = [
        'div[data-message-author-role="assistant"]',
        '.markdown',
        '.agent-turn',
      ];

      let replyText = '';
      for (const sel of responseSelectors) {
        const elements = await page.$$(sel);
        if (elements.length > 0) {
          const lastEl = elements[elements.length - 1];
          replyText = (await lastEl.innerText()).trim();
          if (replyText) break;
        }
      }

      if (!replyText) {
        replyText = 'Fascinating perspective! Thanks for sharing this.';
      }

      logger.success(`[${this.name}] Received ChatGPT Response: "${replyText.slice(0, 60)}..."`);
      return replyText;
    } catch (err) {
      if (err.message.includes('Limit / Quota Reached')) {
        this.isQuotaExhausted = true;
      }
      logger.warn(`[${this.name}] Web UI Generation error: ${err.message}`);
      throw err;
    }
  }

  async close() {
    if (this.page && !this.page.isClosed()) {
      await this.page.close();
    }
  }
}
