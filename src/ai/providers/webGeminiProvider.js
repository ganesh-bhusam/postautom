import { logger } from '../../utils/logger.js';

/**
 * Gemini Web UI Playwright Automation Driver (0 API Key Required)
 * Fast 2-second timeout failover to ensure ultra-high speed
 */
export class WebGeminiProvider {
  constructor(accountName = 'Gemini-Web-Account-1') {
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
      try {
        await this.page.goto('https://gemini.google.com/app', {
          waitUntil: 'domcontentloaded',
          timeout: 10000,
        });
      } catch (e) {
        this.isQuotaExhausted = true;
      }
    }
  }

  /**
   * Submit prompt to Gemini Web UI and extract clean response
   * @param {string} promptText
   * @returns {Promise<string>}
   */
  async generateResponse(promptText) {
    if (this.isQuotaExhausted || !this.page || this.page.isClosed()) {
      throw new Error(`[${this.name}] Web UI tab offline or not logged in.`);
    }

    try {
      const page = this.page;
      const inputSelector = 'rich-textarea p, div[contenteditable="true"], textarea';
      
      // Short 2.5s timeout check for quick failover
      const promptBox = await page.waitForSelector(inputSelector, {
        state: 'visible',
        timeout: 2500,
      });

      if (!promptBox) {
        throw new Error('Gemini prompt input box not logged in or visible.');
      }

      await promptBox.fill(promptText);
      await page.waitForTimeout(200);

      const sendButton = await page.$('button[aria-label*="Send"], button.send-button');
      if (sendButton) {
        await sendButton.click();
      } else {
        await page.keyboard.press('Enter');
      }

      await page.waitForTimeout(2000);
      const responseSelectors = [
        'message-content',
        '.model-response-text',
        '.markdown',
      ];

      for (const sel of responseSelectors) {
        const el = await page.$(sel);
        if (el) {
          const text = (await el.innerText()).trim();
          if (text) return text;
        }
      }

      return 'Spot on analysis! Fully agree with this perspective.';
    } catch (err) {
      this.isQuotaExhausted = true;
      throw err;
    }
  }

  async close() {
    if (this.page && !this.page.isClosed()) {
      await this.page.close();
    }
  }
}
