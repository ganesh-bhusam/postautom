import { WebGeminiProvider } from './providers/webGeminiProvider.js';
import { WebChatGPTProvider } from './providers/webChatGPTProvider.js';
import { logger } from '../utils/logger.js';

/**
 * Apex Multi-Account Web UI LLM Swapper (100% 0-API Key Required)
 */
export class LLMSwapper {
  constructor() {
    this.providers = [];
    this.activeProviderIndex = 0;
    this.browserContext = null;
    this.initialized = false;
  }

  /**
   * Pre-warm and initialize Web UI account tabs in background
   * @param {import('playwright').BrowserContext} context
   */
  async initialize(context) {
    this.browserContext = context;
    logger.apex('LLM Swapper: Initializing 100% Zero-API Web UI Account Drivers...');

    // Account 1: Primary Gemini Web UI
    const gemini1 = new WebGeminiProvider('Gemini-Web-Account-1');
    this.providers.push(gemini1);

    // Account 2: ChatGPT Web UI
    const chatgpt1 = new WebChatGPTProvider('ChatGPT-Web-Account-1');
    this.providers.push(chatgpt1);

    // Account 3: Secondary Gemini Web UI
    const gemini2 = new WebGeminiProvider('Gemini-Web-Account-2');
    this.providers.push(gemini2);

    this.initialized = true;
  }

  /**
   * Generate response using Web UI providers with automatic failover swapping
   * @param {string} promptText
   * @returns {Promise<string>}
   */
  async generateResponse(promptText) {
    if (this.providers.length === 0) {
      return this.getFallbackReply();
    }

    let attempts = 0;
    const maxAttempts = this.providers.length;

    while (attempts < maxAttempts) {
      const provider = this.providers[this.activeProviderIndex];

      if (!provider.isQuotaExhausted) {
        try {
          if (this.browserContext) {
            await provider.initialize(this.browserContext);
          }

          logger.ai(`[LLM SWAPPER] Routing prompt to active Web UI account: ${provider.name}`);
          const text = await provider.generateResponse(promptText);

          if (text) {
            return text;
          }
        } catch (err) {
          logger.warn(`Web UI Provider [${provider.name}] exhausted/error: ${err.message}. SWAPPING to next LLM account...`);
        }
      }

      // SWAP to next provider in pool
      this.activeProviderIndex = (this.activeProviderIndex + 1) % this.providers.length;
      attempts++;
    }

    logger.error('All Web UI LLM accounts reached limit/quota. Using smart fallback reply.');
    return this.getFallbackReply();
  }

  getFallbackReply() {
    const defaultReplies = [
      'Spot on analysis! Absolutely agree with this perspective.',
      'Great points raised. Really worth keeping an eye on how this develops.',
      'Solid breakdown. Thanks for putting this out there!',
    ];
    return defaultReplies[Math.floor(Math.random() * defaultReplies.length)];
  }

  async close() {
    for (const p of this.providers) {
      try {
        await p.close();
      } catch (ignored) {}
    }
  }
}
