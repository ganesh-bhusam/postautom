import { MultiAccountEngine } from './src/engine/multiAccountEngine.js';
import { validateConfig } from './src/config.js';
import { logger } from './src/utils/logger.js';
import { MemoryManager } from './src/utils/memory.js';

async function runMultiAccountEngine() {
  console.log(`
===================================================================
   ⚡ APEX MULTI-ACCOUNT ENGINE: 50 ISOLATED PROFILES ⚡
   Architecture: Profile Isolation | Proxy Routing | 0-API | Stealth
===================================================================
  `);

  validateConfig();

  try {
    const engine = new MultiAccountEngine(50); // 50 Isolated Account Profiles
    await engine.executeAllAccounts();

    MemoryManager.logNodeMemoryUsage();
    logger.apex('Multi-Account Engine execution cycle completed successfully.');
  } catch (err) {
    logger.error('Fatal error during Multi-Account Engine execution', err);
  } finally {
    process.exit(0);
  }
}

runMultiAccountEngine();
