import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';
import { CONFIG, getRandomDelay } from '../config.js';
import { FeedScraper } from '../scrapers/feedScraper.js';
import { ReplyGenerator } from '../ai/replyGenerator.js';
import { Interactor } from '../actions/interactor.js';
import { logger } from '../utils/logger.js';
import { MemoryManager } from '../utils/memory.js';

const ACCOUNTS_FILE = path.resolve('./accounts.json');

/**
 * Apex Multi-Account Profile Isolation Engine
 * Manages 50 isolated browser profiles & proxies with zero account cross-contamination
 */
export class MultiAccountEngine {
  constructor(accountCount = 50) {
    this.accountCount = accountCount;
    this.accounts = this.loadOrCreateAccounts();
  }

  /**
   * Load accounts registry or generate 50 isolated account configs
   */
  loadOrCreateAccounts() {
    if (fs.existsSync(ACCOUNTS_FILE)) {
      try {
        const data = JSON.parse(fs.readFileSync(ACCOUNTS_FILE, 'utf-8'));
        logger.apex(`Loaded ${data.length} accounts from accounts.json`);
        return data;
      } catch (e) {}
    }

    // Auto-generate 50 isolated account profiles
    const generated = [];
    for (let i = 1; i <= this.accountCount; i++) {
      generated.push({
        id: `account_${i}`,
        name: `X Account #${i}`,
        profileDir: `./profiles/account_${i}`,
        targetUrl: CONFIG.X_TARGET_URL,
        proxy: null,
      });
    }

    try {
      fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(generated, null, 2));
      logger.apex(`Generated 50 isolated account profile registry in accounts.json`);
    } catch (e) {}

    return generated;
  }

  /**
   * Execute multi-account automation across account profiles
   */
  async executeAllAccounts() {
    logger.apex(`===================================================================`);
    logger.apex(`⚡ MULTI-ACCOUNT ENGINE ACTIVATED: Running ${this.accounts.length} Isolated Accounts ⚡`);
    logger.apex(`===================================================================`);

    let totalProcessed = 0;

    for (let i = 0; i < this.accounts.length; i++) {
      const acc = this.accounts[i];
      logger.info(`------------------------------------------------------------------`);
      logger.apex(`[Account ${i + 1}/${this.accounts.length}] Starting profile: ${acc.id} (${acc.name})`);

      const count = await this.runSingleAccountProfile(acc);
      totalProcessed += count;

      MemoryManager.logNodeMemoryUsage();

      // Account-level cooldown jitter between accounts
      const cooldown = getRandomDelay(CONFIG.ACTION_COOLDOWN_MIN, CONFIG.ACTION_COOLDOWN_MAX);
      logger.info(`Account profile complete. Inter-account cooldown pause (${(cooldown / 1000).toFixed(1)}s)...`);
      await new Promise((r) => setTimeout(r, cooldown));
    }

    logger.success(`Multi-Account Execution complete! Processed across all accounts: ${totalProcessed}`);
    return totalProcessed;
  }

  /**
   * Run automation for a single isolated account profile
   */
  async runSingleAccountProfile(account) {
    const profilePath = path.resolve(account.profileDir);
    if (!fs.existsSync(profilePath)) {
      fs.mkdirSync(profilePath, { recursive: true });
    }

    const launchOptions = {
      headless: CONFIG.HEADLESS,
      viewport: { width: 1280, height: 800 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0.0.0 Safari/537.36',
      args: [
        '--disable-blink-features=AutomationControlled',
        '--js-flags="--max-old-space-size=128 --expose-gc"',
        '--no-sandbox',
      ],
    };

    if (account.proxy) {
      launchOptions.proxy = account.proxy;
      logger.info(`[${account.id}] Proxy bound: ${account.proxy.server}`);
    }

    let context = null;
    let processed = 0;

    try {
      context = await chromium.launchPersistentContext(profilePath, launchOptions);

      // Asset Interception Routing for ~95% RAM Reduction
      await context.route('**/*', (route) => {
        const req = route.request();
        if (CONFIG.BLOCK_RESOURCE_TYPES.includes(req.resourceType())) {
          return route.abort();
        }
        return route.continue();
      });

      const page = context.pages()[0] || (await context.newPage());

      logger.info(`[${account.id}] Navigating to X feed...`);
      await page.goto(account.targetUrl || CONFIG.X_TARGET_URL, {
        waitUntil: 'domcontentloaded',
        timeout: 45000,
      });
      await page.waitForTimeout(3000);

      // Verify Login state
      if (page.url().includes('/login') || page.url().includes('/i/flow/login')) {
        logger.warn(`[${account.id}] LOGIN REQUIRED! Please log into ${account.name} in the open window.`);
        await page.waitForURL((u) => u.toString().includes('/home'), { timeout: 120000 });
        logger.success(`[${account.id}] Session saved to ${account.profileDir}`);
      }

      // Initialize Scraper & AI
      const scraper = new FeedScraper();
      const replyGen = new ReplyGenerator();
      await replyGen.initialize(context);

      const targetPosts = await scraper.scrapeFeed(page, 3); // 3 target posts per account

      for (const tweet of targetPosts) {
        if (page.isClosed()) break;

        logger.info(`[${account.id}] Processing post ${tweet.tweetId} by ${tweet.author}`);
        await Interactor.navigateToTweet(page, tweet);
        await Interactor.autoLike(page, tweet);

        const replyText = await replyGen.generateReply(tweet.tweetText, tweet.author);
        await Interactor.autoReply(page, tweet, replyText);

        processed++;
      }
    } catch (err) {
      logger.error(`[${account.id}] Error in profile execution`, err);
    } finally {
      if (context) {
        await context.close();
        logger.info(`[${account.id}] Profile closed safely.`);
      }
    }

    return processed;
  }
}
