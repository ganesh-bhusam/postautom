/**
 * Apex Automator - Native Chrome Extension Content Script
 * Runs inside X web pages with 0 CDP / 0 Playwright footprint
 */

console.log('⚡ [Apex Extension] Content Script injected into X web context.');

// Scan feed periodically and report to background service worker
function scanFeed() {
  const tweets = [];
  const tweetElements = document.querySelectorAll('[data-testid="tweet"]');

  tweetElements.forEach((el) => {
    try {
      const textEl = el.querySelector('[data-testid="tweetText"]');
      const tweetText = textEl ? textEl.innerText.trim() : '';

      const userEl = el.querySelector('[data-testid="User-Name"]');
      const userText = userEl ? userEl.innerText : '';
      const authorMatch = userText.match(/@[\w_]+/);
      const author = authorMatch ? authorMatch[0] : '@unknown';

      let tweetId = '';
      const timeEl = el.querySelector('time');
      if (timeEl) {
        const anchor = timeEl.closest('a');
        if (anchor && anchor.href.includes('/status/')) {
          tweetId = anchor.href.split('/status/')[1].split('?')[0];
        }
      }

      if (tweetText && tweetId) {
        tweets.push({
          tweetId,
          author,
          tweetText,
          tweetUrl: `https://x.com/i/status/${tweetId}`,
        });
      }
    } catch (ignored) {}
  });

  if (tweets.length > 0) {
    chrome.runtime.sendMessage({
      action: 'TWEETS_SCRAPED',
      tweets,
    });
  }
}

// Observe feed mutations naturally
const observer = new MutationObserver(() => {
  scanFeed();
});

observer.observe(document.body, { childList: true, subtree: true });

// Listen for execution commands from background script
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'POST_REPLY') {
    console.log('⚡ [Apex Extension] Executing native reply on Tweet:', msg);
    executeNativeReply(msg.tweetId, msg.replyText);
    sendResponse({ status: 'SUCCESS' });
  }
});

/**
 * Execute native reply inside browser window
 */
async function executeNativeReply(tweetId, replyText) {
  // If on direct status page, locate reply textarea
  let replyArea = document.querySelector('[data-testid="tweetTextarea_0"]');

  if (!replyArea) {
    const replyBtn = document.querySelector('[data-testid="reply"]');
    if (replyBtn) {
      replyBtn.click();
      await new Promise((r) => setTimeout(r, 800));
      replyArea = document.querySelector('[data-testid="tweetTextarea_0"]');
    }
  }

  if (replyArea) {
    replyArea.focus();
    // Native execCommand / input event dispatch
    document.execCommand('insertText', false, replyText);
    replyArea.dispatchEvent(new Event('input', { bubbles: true }));

    await new Promise((r) => setTimeout(r, 1200));

    const postBtn = document.querySelector('[data-testid="tweetButtonInline"], [data-testid="tweetButton"]');
    if (postBtn) {
      postBtn.click();
      console.log('✔ [Apex Extension] Successfully posted native reply!');
    }
  }
}

// Initial scan
scanFeed();
