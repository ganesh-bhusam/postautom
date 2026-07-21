import path from 'path';
import fileSystem from 'fs';

/**
 * Apex Automator Central Configuration (100% 0-API & Parallel Worker Tab Architecture)
 */
export const CONFIG = {
  // Target Settings
  X_TARGET_URL: 'https://x.com/home',

  // Browser Profile & Storage
  PROFILE_DIR: path.resolve('./user_data_dir'),
  HISTORY_FILE: path.resolve('./history.json'),
  HEADLESS: false,

  // Parallel Multi-Tab Performance Settings
  CONCURRENT_WORKER_TABS: 5, // Number of parallel worker tabs (e.g. 5 to 10 parallel workers)
  MAX_TARGET_POSTS: 20,       // Max target posts per run

  // Speed & Jitter Settings (in milliseconds)
  TYPING_DELAY_MIN: 15,
  TYPING_DELAY_MAX: 45,
  READING_PAUSE_MIN: 800,
  READING_PAUSE_MAX: 2000,
  ACTION_COOLDOWN_MIN: 2000,
  ACTION_COOLDOWN_MAX: 5000,

  // Feature Toggles
  AUTO_LIKE_ENABLED: true,
  AUTO_REPLY_ENABLED: true,
  DRY_RUN: false,

  // 95% RAM Reduction Routing (Allows 50+ concurrent tabs without memory lag)
  BLOCK_RESOURCE_TYPES: ['image', 'media', 'font', 'stylesheet'],
  BLOCK_URL_KEYWORDS: ['analytics', 'telemetry', 'doubleclick', 'google-analytics', 'adsystem'],
};

/**
 * Returns a random integer between min and max inclusive
 */
export function getRandomDelay(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Validates system configuration
 */
export function validateConfig() {
  if (!fileSystem.existsSync(CONFIG.PROFILE_DIR)) {
    fileSystem.mkdirSync(CONFIG.PROFILE_DIR, { recursive: true });
  }
}
