import { GoogleGenerativeAI } from '@google/generative-ai';
import { logger } from '../../utils/logger.js';

/**
 * Free API Key Rotator & Provider Pool
 */
export class FreeApiRotator {
  constructor(apiKeys = []) {
    this.apiKeys = apiKeys.filter(Boolean);
    this.currentIndex = 0;
    this.keyCooldowns = new Map(); // key -> cooldown expiry timestamp
  }

  /**
   * Add API key to pool
   */
  addKey(key) {
    if (key && !this.apiKeys.includes(key)) {
      this.apiKeys.push(key);
    }
  }

  /**
   * Get next available non-cooldown API Key
   */
  getNextKey() {
    if (this.apiKeys.length === 0) return null;

    const now = Date.now();
    for (let i = 0; i < this.apiKeys.length; i++) {
      const idx = (this.currentIndex + i) % this.apiKeys.length;
      const key = this.apiKeys[idx];
      const cooldownUntil = this.keyCooldowns.get(key) || 0;

      if (now >= cooldownUntil) {
        this.currentIndex = (idx + 1) % this.apiKeys.length;
        return key;
      }
    }
    return null; // All keys currently on rate-limit cooldown
  }

  /**
   * Mark key as rate-limited / quota exhausted
   */
  markKeyCooldown(key, cooldownMs = 300000) { // Default 5 min cooldown
    logger.warn(`API Key [${key.slice(0, 8)}...] rate limited. Setting ${cooldownMs / 1000}s cooldown.`);
    this.keyCooldowns.set(key, Date.now() + cooldownMs);
  }

  /**
   * Generate content using available free API key pool
   */
  async generateContent(prompt, modelName = 'gemini-2.5-flash') {
    let attempts = 0;
    const maxAttempts = Math.max(1, this.apiKeys.length);

    while (attempts < maxAttempts) {
      const key = this.getNextKey();
      if (!key) {
        throw new Error('All free API keys are currently rate-limited or exhausted.');
      }

      try {
        logger.ai(`Generating response using Free API Key pool (Key #${this.currentIndex}/${this.apiKeys.length})...`);
        const genAI = new GoogleGenerativeAI(key);
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(prompt);
        const text = result.response ? result.response.text().trim() : '';

        if (text) {
          return text;
        }
      } catch (err) {
        const isQuotaErr = err.message.includes('429') || err.message.includes('quota') || err.message.includes('RESOURCE_EXHAUSTED');
        if (isQuotaErr) {
          this.markKeyCooldown(key, 600000); // 10 min cooldown for quota limit
        } else {
          logger.warn(`API Key error: ${err.message}`);
        }
      }

      attempts++;
    }

    throw new Error('Failed to generate output after trying all free API keys.');
  }
}
