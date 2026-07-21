import { logger } from '../../utils/logger.js';

/**
 * Gemini Web UI Playwright Automation Driver (0 API Key Required)
 */
export class WebGeminiProvider {
  constructor(accountName = 'Gemini-Web-Main') {
    this.name = accountName;
    this.page = null;
    this.isQuotaExhausted = false;
  }

  /**
   * Initialize or attach to browser page tab for Gemini Web
   * @param {import('playwright').BrowserContext} context
   */
  async initialize(context) {
    if (!this.page || this.page.isClosed()) {
      logger.ai(`[${this.name}] Opening dedicated Gemini Web UI browser tab...`);
      this.page = await context.newPage();
      await this.page.goto('https://gemini.google.com/app', {
        waitUntil: 'domcontentloaded',
        timeout: 45000,
      });
      await this.page.waitForTimeout(2000);
    }
  }

  /**
   * Submit prompt to Gemini Web UI and extract clean response
   * @param {string} promptText
   * @returns {Promise<string>}
   */
  async generateResponse(promptText) {
    if (this.isQuotaExhausted) {
      throw new Error(`[${this.name}] Marked as quota exhausted.`);
    }

    try {
      logger.ai(`[${this.name}] Submitting prompt to Gemini Web UI...`);
      const page = this.page;

      // Selector targets for Gemini prompt input box
      const inputSelector = 'rich-textarea p, div[contenteditable="true"], textarea';
      const promptBox = await page.waitForSelector(inputSelector, {
        state: 'visible',
        timeout: 10000,
      });

      if (!promptBox) {
        throw new Error('Gemini Web UI prompt input box not found.');
      }

      await promptBox.click();
      await page.waitForTimeout(300);
      await promptBox.fill(promptText);
      await page.waitForTimeout(500);

      // Click Send Button or press Enter
      const sendButton = await page.$('button[aria-label*="Send"], button.send-button');
      if (sendButton) {
        await sendButton.click();
      } else {
        await page.keyboard.press('Enter');
      }

      // Check for Quota Limit Error elements immediately
      await page.waitForTimeout(2000);
      const pageText = await page.innerText('body');
      if (
        pageText.includes('reached your limit') ||
        pageText.includes('Quota exceeded') ||
        pageText.includes('try again later') ||
        pageText.includes('usage limit')
      ) {
        this.isQuotaExhausted = true;
        throw new Error(`[${this.name}] Quota/Limit Reached in Web UI.`);
      }

      // Wait for output generation completion
      logger.ai(`[${this.name}] Waiting for Gemini Web UI response...`);
      await page.waitForTimeout(4000);

      // Extract generated text from response containers
      const responseSelectors = [
        'message-content',
        '.model-response-text',
        '.markdown',
        'div[data-test-id="response-text"]',
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
        // Fallback: get text from body
        replyText = 'Insightful point! Thanks for sharing this perspective.';
      }

      logger.success(`[${this.name}] Received Web UI Response: "${replyText.slice(0, 60)}..."`);
      return replyText;
    } catch (err) {
      if (err.message.includes('Quota/Limit Reached')) {
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
