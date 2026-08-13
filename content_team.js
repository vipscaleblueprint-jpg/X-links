/**
 * X-links, content_team.js
 *
 * Reads the currently active Canva team/workspace from the sidebar
 * account-switcher button and reports its initials + color to the
 * background service worker, which updates the extension icon.
 *
 * HOW IT WORKS (based on inspected Canva HTML):
 * The sidebar button labeled "More account and team options" contains
 * two SVG avatars:
 *   - Large (3.2rem)  = the logged-in USER's avatar  (e.g. "JR")
 *   - Small (1.6rem)  = the active TEAM/workspace badge  (e.g. "JM")
 *
 * We extract the TEAM badge's initials and fill color, then send them to
 * background.js which generates a matching icon.
 */

let lastReportedKey = null;

// ─── Extract team info from the Canva sidebar ─────────────────────────────────

function detectTeamInfo() {
  // 1. Find the account-switcher button by its stable label text
  //    (the class names in Canva are obfuscated/generated, but this text is stable)
  let button = null;

  const allButtons = document.querySelectorAll('button[aria-haspopup="menu"]');
  for (const btn of allButtons) {
    if (btn.textContent.includes('More account and team options')) {
      button = btn;
      break;
    }
  }

  if (!button) return null;

  // 2. Find all SVG avatars inside the button
  const svgs = [...button.querySelectorAll('svg')];
  if (svgs.length === 0) return null;

  // 3. Identify the TEAM badge SVG:
  //    The team logo is the large SVG (3.2rem)
  //    The user avatar is the small overlay SVG (1.6rem)
  let teamSvg = null;

  for (const svg of svgs) {
    const style = svg.getAttribute('style') || '';
    if (style.includes('3.2rem')) {
      teamSvg = svg;
      break;
    }
  }

  // Fallback: the first SVG in the button is the team logo
  if (!teamSvg && svgs.length > 0) {
    teamSvg = svgs[0];
  }

  if (!teamSvg) return null;

  // 4. Extract initials from the <text> element
  const initials = teamSvg.querySelector('text')?.textContent?.trim();
  if (!initials) return null;

  // 5. Extract fill color from the <circle> element
  const color = teamSvg.querySelector('circle[fill]')?.getAttribute('fill') || '#6366f1';

  return { initials, color };
}

// ─── Report to background ─────────────────────────────────────────────────────

function reportTeam() {
  const info = detectTeamInfo();

  // Build a stable key to avoid redundant messages
  const key = info ? `${info.initials}|${info.color}` : null;
  if (key === lastReportedKey) return;

  lastReportedKey = key;
  try {
    chrome.runtime.sendMessage({
      type: 'teamDetected',
      initials: info?.initials || null,
      color: info?.color || null
    }).catch((err) => {
      // Suppress unhandled rejections (e.g. receiver not ready yet)
      console.debug('[X-links] Extension message suppressed:', err.message);
    });
  } catch (e) {
    // Suppress context invalidation errors (e.g. after extension reload)
    console.debug('[X-links] Extension context invalidated. Reload page to reconnect.');
  }
}

// ─── Run on page load + DOM changes (Canva is a SPA) ─────────────────────────

// Initial detection
reportTeam();

// Re-check when DOM changes (e.g. user switches team without page reload)
const observer = new MutationObserver(() => reportTeam());
observer.observe(document.body, { childList: true, subtree: true });
