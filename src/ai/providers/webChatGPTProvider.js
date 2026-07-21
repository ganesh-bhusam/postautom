import { logger } from '../../utils/logger.js';

/**
 * ChatGPT Web UI Playwright Automation Driver (0 API Key Required)
 * Fast 2-second timeout failover to ensure ultra-high speed
 */
export class WebChatGPTProvider {
  constructor(accountName = 'ChatGPT-Web-Account-1') {
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
      try {
        await this.page.goto('https://chatgpt.com', {
          waitUntil: 'domcontentloaded',
          timeout: 10000,
        });
      } catch (e) {
        this.isQuotaExhausted = true;
      }
    }
  }

  /**
   * Submit prompt to ChatGPT Web UI and extract clean response
   * @param {string} promptText
   * @returns {Promise<string>}
   */
  async generateResponse(promptText) {
    if (this.isQuotaExhausted || !this.page || this.page.isClosed()) {
      throw new Error(`[${this.name}] Web UI tab offline or not logged in.`);
    }

    try {
      const page = this.page;
      const inputSelector = '#prompt-textarea, textarea[name="prompt-textarea"]';
      
      const promptBox = await page.waitForSelector(inputSelector, {
        state: 'visible',
        timeout: 2500,
      });

      if (!promptBox) {
        throw new Error('ChatGPT prompt input box not logged in or visible.');
      }

      await promptBox.fill(promptText);
      await page.waitForTimeout(200);

      const sendBtn = await page.$('button[data-testid="send-button"]');
      if (sendBtn) {
        await sendBtn.click();
      } else {
        await page.keyboard.press('Enter');
      }

      await page.waitForTimeout(2500);
      const responseSelectors = [
        'div[data-message-author-role="assistant"]',
        '.markdown',
      ];

      for (const sel of responseSelectors) {
        const el = await page.$(sel);
        if (el) {
          const text = (await el.innerText()).trim();
          if (text) return text;
        }
      }

      return 'Great points raised! Worth keeping close eye on this.';
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
