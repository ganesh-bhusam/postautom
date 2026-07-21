import { LLMSwapper } from './llmSwapper.js';
import { CONFIG } from '../config.js';
import { logger } from '../utils/logger.js';

/**
 * Gemini AI Contextual Reply Engine backed by LLMSwapper
 */
export class ReplyGenerator {
  constructor() {
    this.swapper = new LLMSwapper();
  }

  /**
   * Initialize LLM Swapper with browser context
   * @param {import('playwright').BrowserContext} context
   */
  async initialize(context) {
    await this.swapper.initialize(context);
  }

  /**
   * Generates a context-aware human-like reply to an X post using LLMSwapper
   * @param {string} tweetText
   * @param {string} author
   * @returns {Promise<string>}
   */
  async generateReply(tweetText, author) {
    if (CONFIG.DRY_RUN) {
      return this.getFallbackReply(tweetText);
    }

    const systemPrompt = `You are a savvy, articulate, and authentic social media user on X (Twitter).
Your task is to craft a witty, natural, insightful reply to the following tweet written by ${author}.

RULES:
1. Maximum length: 240 characters (strict constraint).
2. Sound like a knowledgeable human. Do NOT sound like an AI bot (avoid corporate buzzwords, "Great tweet!", "I agree!", emojis overload, or generic praise).
3. Be conversational, direct, and engaging.
4. Output ONLY the raw reply text. Do not wrap in quotes or add metadata.

TWEET:
"${tweetText}"`;

    try {
      logger.ai(`Analyzing context & generating response for post by ${author}...`);
      let text = await this.swapper.generateResponse(systemPrompt);

      if (text.startsWith('"') && text.endsWith('"')) {
        text = text.slice(1, -1);
      }

      if (text.length > 280) {
        text = text.slice(0, 277) + '...';
      }

      logger.success(`Generated Reply: "${text}"`);
      return text;
    } catch (err) {
      logger.error(`LLM Swapper error: ${err.message}. Switching to fallback reply.`, err);
      return this.getFallbackReply(tweetText);
    }
  }

  /**
   * Fallback reply
   */
  getFallbackReply(tweetText) {
    const fallbacks = [
      'Spot on analysis, completely agree with this perspective.',
      'Fascinating takeaway. Thanks for putting this out there!',
      'Solid points raised here. The details really matter on this.',
      'Great insight. Worth paying close attention to as things evolve.',
    ];

    const idx = Math.floor(Math.random() * fallbacks.length);
    const fallback = fallbacks[idx];
    logger.ai(`Generated Fallback Reply: "${fallback}"`);
    return fallback;
  }
}
