import { WebSocketServer } from 'ws';
import fs from 'fs';
import path from 'path';
import { LLMSwapper } from '../src/ai/llmSwapper.js';
import { CONFIG } from '../src/config.js';
import { logger } from '../src/utils/logger.js';

const PORT = 8080;
const HISTORY_FILE = path.resolve('./history.json');

/**
 * Load history set of processed tweets
 */
function loadHistory() {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      return new Set(JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8')));
    }
  } catch (e) {}
  return new Set();
}

/**
 * Save history set
 */
function saveHistory(historySet) {
  try {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(Array.from(historySet), null, 2));
  } catch (e) {}
}

const history = loadHistory();
const swapper = new LLMSwapper();

console.log(`
===================================================================
   ⚡ APEX AUTOMATOR: LOCAL AI DAEMON WEBSOCKET SERVER ⚡
   Listening on ws://localhost:${PORT} | Ready for Extension IPC
===================================================================
`);

const wss = new WebSocketServer({ port: PORT });

wss.on('connection', (ws) => {
  logger.success(`Chrome Extension connected to Local AI Daemon.`);

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);

      if (data.type === 'PROCESS_TWEETS') {
        const tweets = data.tweets || [];
        logger.info(`Received ${tweets.length} scraped tweets from Extension.`);

        for (const tweet of tweets) {
          if (history.has(tweet.tweetId)) continue;

          history.add(tweet.tweetId);
          saveHistory(history);

          logger.apex(`[Daemon Queue] Processing Tweet ID: ${tweet.tweetId} by ${tweet.author}`);
          logger.info(`Tweet Content: "${tweet.tweetText.slice(0, 60)}..."`);

          // 1. Generate Contextual AI Response
          const prompt = `Craft a witty, natural, authentic reply under 240 chars to this tweet by ${tweet.author}: "${tweet.tweetText}"`;
          const replyText = await swapper.generateResponse(prompt);

          logger.success(`Generated Reply: "${replyText}"`);

          // 2. Apply Natural Human Jitter Pause (Human reading/thinking simulation)
          const jitterMs = Math.floor(Math.random() * (45000 - 15000 + 1)) + 15000;
          logger.info(`Simulating human thinking pause (${(jitterMs / 1000).toFixed(1)}s)...`);
          await new Promise((r) => setTimeout(r, jitterMs));

          // 3. Send Execution Command back to Extension
          ws.send(JSON.stringify({
            action: 'EXECUTE_REPLY',
            tweetId: tweet.tweetId,
            author: tweet.author,
            replyText,
          }));

          // Process one tweet per batch interval for account safety
          break;
        }
      }
    } catch (err) {
      logger.error('Daemon message processing error', err);
    }
  });

  ws.on('close', () => {
    logger.warn('Chrome Extension disconnected from Local AI Daemon.');
  });
});
