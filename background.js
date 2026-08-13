/**
 * X-links, background.js (Service Worker)
 *
 * PROBLEM BEING SOLVED:
 * Our agency manages multiple clients, each with their own Canva team.
 * When someone clicks a Canva design link from Slack/email, it opens in
 * whichever Canva team is currently active, potentially the wrong client's
 * team, and Canva's server logs the view even if the user navigates away.
 *
 * SOLUTION:
 * Use declarativeNetRequest (rules.json) to intercept the HTTP request
 * BEFORE it reaches Canva's servers, the design page never loads and
 * Canva never logs the view.
 *
 * This background worker handles:
 * 1. Logging intercepted URLs (using onBeforeNavigate, fires before request)
 * 2. Updating the extension badge count
 * 3. Receiving team info from content_team.js and updating the icon
 */

const CANVA_HOME = 'https://www.canva.com/';

// ─── URL patterns that declarativeNetRequest blocks ───────────────────────────
// (These must match what's in rules.json)

const DESIGN_URL_PATTERNS = [
  /^https?:\/\/([^/]+\.)?canva\.com\/([^/]+\/)*design\//i
];

function isDesignUrl(url) {
  return DESIGN_URL_PATTERNS.some(p => p.test(url));
}

function isCanvaDomain(urlStr) {
  try {
    const url = new URL(urlStr);
    return url.hostname === 'canva.com' || url.hostname.endsWith('.canva.com');
  } catch (e) {
    return false;
  }
}

// ─── Log intercepted navigations ─────────────────────────────────────────────
// onBeforeNavigate fires BEFORE the network request is made.
// We check if the navigation was initiated from within Canva (either current tab or opener tab is Canva)
// to align the logging with declarativeNetRequest's whitelisting of canva.com.

chrome.webNavigation.onBeforeNavigate.addListener(
  (details) => {
    // Main frame only
    if (details.frameId !== 0) return;

    // Only log if it's genuinely a design URL
    if (!isDesignUrl(details.url)) return;



    chrome.tabs.get(details.tabId, (tab) => {
      if (chrome.runtime.lastError || !tab) {
        logInterceptedNavigation(details.url);
        return;
      }

      // If current page is Canva, it was initiated from Canva
      if (tab.url && isCanvaDomain(tab.url)) {
        return; // Don't log: allowed by declarativeNetRequest
      }

      // If opener tab page is Canva, it was initiated from Canva (e.g. middle-click link to open in new tab)
      if (tab.openerTabId) {
        chrome.tabs.get(tab.openerTabId, (openerTab) => {
          if (!chrome.runtime.lastError && openerTab && openerTab.url && isCanvaDomain(openerTab.url)) {
            return; // Don't log: allowed by declarativeNetRequest
          }
          logInterceptedNavigation(details.url);
        });
      } else {
        logInterceptedNavigation(details.url);
      }
    });
  },
  {
    url: [
      { hostSuffix: 'canva.com', urlMatches: '/design/' }
    ]
  }
);

// ─── Clean up bypass session rules on load commit ────────────────────────────

chrome.webNavigation.onCommitted.addListener(
  (details) => {
    if (details.frameId !== 0) return;
    if (!isDesignUrl(details.url)) return;

    // Remove the temporary bypass session rule for this tab and the copy-paste whitelist rule
    chrome.declarativeNetRequest.updateSessionRules({
      removeRuleIds: [details.tabId, 999999]
    });


  },
  {
    url: [
      { hostSuffix: 'canva.com', urlMatches: '/design/' }
    ]
  }
);

// ─── Logging ──────────────────────────────────────────────────────────────────

function logInterceptedNavigation(url) {
  chrome.storage.local.get({ blockedLinks: [] }, (data) => {
    const updated = [{ url, timestamp: Date.now() }, ...data.blockedLinks].slice(0, 200);
    chrome.storage.local.set({ blockedLinks: updated });
  });
}

// ─── Dynamic Icon Generator ───────────────────────────────────────────────────
// Takes initials + color directly from the Canva DOM (via content_team.js).
// Mirrors the exact same badge style Canva uses in the sidebar.

function generateTeamIconData(initials, color) {
  const sizes = [16, 32, 48];
  const imageData = {};

  for (const size of sizes) {
    const canvas = new OffscreenCanvas(size, size);
    const ctx = canvas.getContext('2d');
    const radius = size * 0.22;

    // Team color background
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(0, 0, size, size, radius);
    ctx.fill();

    // Depth gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, size);
    gradient.addColorStop(0, 'rgba(255,255,255,0.15)');
    gradient.addColorStop(1, 'rgba(0,0,0,0.1)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.roundRect(0, 0, size, size, radius);
    ctx.fill();

    // Initials, white, bold, same as Canva sidebar
    ctx.fillStyle = '#ffffff';
    const fontSize = Math.floor(size * (initials.length > 1 ? 0.44 : 0.56));
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(initials, size / 2, size / 2 + size * 0.02);

    imageData[size] = ctx.getImageData(0, 0, size, size);
  }

  return imageData;
}

function setTeamIcon(tabId, initials, color) {
  if (!initials) {
    chrome.action.setIcon({
      tabId: tabId,
      path: { 16: 'icons/icon16.png', 48: 'icons/icon48.png', 128: 'icons/icon128.png' }
    });
    chrome.action.setTitle({ tabId: tabId, title: 'X-links' });
    return;
  }

  const imageData = generateTeamIconData(initials, color);
  chrome.action.setIcon({ tabId, imageData });
  chrome.action.setTitle({ tabId, title: `X-links, Team ${initials}` });
}

// ─── Message Handler ──────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Team badge detected by content_team.js, receives initials + color directly from DOM
  if (message.type === 'teamDetected' && sender.tab) {
    const { initials, color } = message;
    const tabId = sender.tab.id;

    setTeamIcon(tabId, initials || null, color || null);

    // Save team color/initials mapped per tabId
    chrome.storage.local.get({ tabTeams: {} }, (data) => {
      const tabTeams = data.tabTeams;
      if (initials) {
        tabTeams[tabId] = { initials, color };
        // Save globally as the last active team detected for the warning screen
        chrome.storage.local.set({ lastDetectedTeam: { initials, color } });
      } else {
        delete tabTeams[tabId];
      }
      chrome.storage.local.set({ tabTeams });
    });
  }

  // Warning screen requests the original URL of the redirect (Legacy - now parsed from query string)
  if (message.type === 'getOriginalUrl') {
    sendResponse({ url: null });
  }

  // Warning screen requests to temporarily whitelist a copied URL for 5 seconds
  if (message.type === 'whitelistUrlTemporarily') {
    const url = message.url;
    if (url) {
      const tempRuleId = 999999;
      chrome.declarativeNetRequest.updateSessionRules({
        addRules: [{
          id: tempRuleId,
          priority: 2,
          action: { type: 'allow' },
          condition: {
            urlFilter: url,
            resourceTypes: ['main_frame']
          }
        }],
        removeRuleIds: [tempRuleId]
      }, () => {
        setTimeout(() => {
          chrome.declarativeNetRequest.updateSessionRules({
            removeRuleIds: [tempRuleId]
          });
        }, 5000);
        sendResponse({ success: true });
      });
      return true; // Keep channel open for async response
    }
  }

  // Warning screen requests to bypass design blocking temporarily for this tab
  if (message.type === 'bypassTab' && sender.tab) {
    const tabId = sender.tab.id;
    chrome.declarativeNetRequest.updateSessionRules({
      addRules: [{
        id: tabId,
        priority: 2, // Overrides static blocking rules (priority 1)
        action: { type: 'allow' },
        condition: {
          tabIds: [tabId],
          regexFilter: '^https?://([^/]+\\.)?canva\\.com/([^/]+/)*design/'
        }
      }],
      removeRuleIds: [tabId]
    }, () => {
      sendResponse();
    });
    return true; // Keep message channel open for async response
  }
});

// ─── Declarative Net Request Dynamic Rules ────────────────────────────────────

function registerRedirectRule() {
  const extensionWarningUrl = chrome.runtime.getURL('warning.html');

  chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [1],
    addRules: [
      {
        id: 1,
        priority: 1,
        action: {
          type: 'redirect',
          redirect: {
            regexSubstitution: `${extensionWarningUrl}?url=\\0`
          }
        },
        condition: {
          regexFilter: '^https?://([^/]+\\.)?canva\\.com/([^/]+/)*design/(.*)',
          resourceTypes: ['main_frame'],
          excludedInitiatorDomains: ['canva.com']
        }
      }
    ]
  });
}

// Call on startup load
registerRedirectRule();

// ─── Tab Clean-up ────────────────────────────────────────────────────────────

chrome.tabs.onRemoved.addListener((tabId) => {
  // Remove temporary session rule if any
  chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [tabId]
  });

  chrome.storage.local.get({ tabTeams: {} }, (data) => {
    const tabTeams = data.tabTeams;
    if (tabTeams[tabId]) {
      delete tabTeams[tabId];
      chrome.storage.local.set({ tabTeams });
    }
  });
});

// Reset all tab teams on startup/install to avoid stale IDs and register dynamic rules
chrome.runtime.onStartup.addListener(() => {
  chrome.storage.local.set({ tabTeams: {} });
  chrome.storage.local.set({ lastDetectedTeam: null });
  registerRedirectRule();
});
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ tabTeams: {} });
  chrome.storage.local.set({ lastDetectedTeam: null });
  registerRedirectRule();
});
