/**
 * Apex Automator - Extension Background Service Worker
 * Manages WebSocket IPC with Local AI Daemon (ws://localhost:8080)
 */

let socket = null;
let isConnected = false;

function connectDaemon() {
  console.log('[Apex Extension] Connecting to Local AI Daemon on ws://localhost:8080...');
  socket = new WebSocket('ws://localhost:8080');

  socket.onopen = () => {
    isConnected = true;
    console.log('[Apex Extension] Connected to Local AI Daemon WebSocket server.');
  };

  socket.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      console.log('[Apex Extension] Received message from Daemon:', msg);

      if (msg.action === 'EXECUTE_REPLY') {
        // Forward execution command to active tab contentScript
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0] && tabs[0].id) {
            chrome.tabs.sendMessage(tabs[0].id, {
              action: 'POST_REPLY',
              tweetId: msg.tweetId,
              replyText: msg.replyText,
              author: msg.author,
            });
          }
        });
      }
    } catch (err) {
      console.error('[Apex Extension] Error parsing Daemon message:', err);
    }
  };

  socket.onclose = () => {
    isConnected = false;
    console.warn('[Apex Extension] Daemon WebSocket disconnected. Reconnecting in 5s...');
    setTimeout(connectDaemon, 5000);
  };

  socket.onerror = (err) => {
    console.error('[Apex Extension] WebSocket error:', err);
  };
}

// Initialize Daemon connection
connectDaemon();

// Listen for messages from contentScript
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'TWEETS_SCRAPED') {
    if (isConnected && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        type: 'PROCESS_TWEETS',
        tweets: request.tweets,
      }));
      sendResponse({ status: 'ACK' });
    } else {
      sendResponse({ status: 'DAEMON_DISCONNECTED' });
    }
  }
  return true;
});
