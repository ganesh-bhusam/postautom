/**
 * Apex Automator Logger - High Visibility Terminal Logging System
 */

const ANSI = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
  gray: '\x1b[90m',
};

function timestamp() {
  return new Date().toISOString().substring(11, 19);
}

export const logger = {
  info: (msg) => {
    console.log(`${ANSI.gray}[${timestamp()}]${ANSI.reset} ${ANSI.cyan}ℹ [INFO]${ANSI.reset} ${msg}`);
  },

  success: (msg) => {
    console.log(`${ANSI.gray}[${timestamp()}]${ANSI.reset} ${ANSI.green}✔ [SUCCESS]${ANSI.reset} ${msg}`);
  },

  warn: (msg) => {
    console.warn(`${ANSI.gray}[${timestamp()}]${ANSI.reset} ${ANSI.yellow}⚠ [WARNING]${ANSI.reset} ${msg}`);
  },

  error: (msg, err = null) => {
    console.error(`${ANSI.gray}[${timestamp()}]${ANSI.reset} ${ANSI.red}✖ [ERROR]${ANSI.reset} ${msg}`);
    if (err && err.stack) {
      console.error(`${ANSI.dim}${err.stack}${ANSI.reset}`);
    }
  },

  apex: (msg) => {
    console.log(`${ANSI.gray}[${timestamp()}]${ANSI.reset} ${ANSI.magenta}${ANSI.bright}⚡ [APEX AUTOMATOR]${ANSI.reset} ${msg}`);
  },

  ai: (msg) => {
    console.log(`${ANSI.gray}[${timestamp()}]${ANSI.reset} ${ANSI.magenta}🤖 [GEMINI AI]${ANSI.reset} ${msg}`);
  },
};
