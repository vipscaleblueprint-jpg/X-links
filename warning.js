/**
 * X-links, warning.js
 *
 * Runs inside warning.html (redirect page).
 * Resolves the original blocked URL, queries the last active team,
 * and requests the background service worker to temporarily whitelist
 * the tab if the user confirms they want to proceed.
 */

let originalUrl = null;
let activeTeam = null;

const el = {
  avatar:      document.getElementById('team-avatar'),
  statusText:  document.getElementById('team-status-text'),
  btnCopy:     document.getElementById('btn-copy'),
  btnSwitch:   document.getElementById('btn-switch')
};

// ─── Init ────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  resolveBlockedState();
  
  el.btnCopy.addEventListener('click', handleCopy);
  el.btnSwitch.addEventListener('click', handleSwitch);
});

// ─── Resolve State ───────────────────────────────────────────────────────────
function resolveBlockedState() {
  // Get original URL directly from the query parameter
  const search = window.location.search;
  if (search.startsWith('?url=')) {
    originalUrl = decodeURIComponent(search.substring(5));
  }

  // Query background/storage for the most recently active Canva team
  chrome.storage.local.get({ lastDetectedTeam: null }, (data) => {
    activeTeam = data.lastDetectedTeam;
    
    if (activeTeam?.initials) {
      el.avatar.textContent = activeTeam.initials;
      el.avatar.classList.remove('unknown');
      el.avatar.style.backgroundColor = activeTeam.color;
      el.statusText.innerHTML = `You are logged in as team <strong>${escapeHtml(activeTeam.initials)}</strong>.`;
    } else {
      el.avatar.textContent = '?';
      el.avatar.classList.add('unknown');
      el.avatar.style.backgroundColor = '';
      el.statusText.textContent = 'No active Canva team workspace detected.';
    }
  });
}

// ─── Handlers ────────────────────────────────────────────────────────────────
function handleCopy() {
  if (originalUrl) {
    copyToClipboard(originalUrl);
  } else {
    alert('Error: Could not resolve original link destination.');
  }
}

function copyToClipboard(url) {
  // Request the background worker to whitelist this URL for 5 seconds
  chrome.runtime.sendMessage({ type: 'whitelistUrlTemporarily', url: url }, () => {
    navigator.clipboard.writeText(url).then(() => {
      const btnText = el.btnCopy.querySelector('span');
      const originalText = btnText.textContent;
      btnText.textContent = 'Copied!';
      el.btnCopy.classList.add('copied');
      setTimeout(() => {
        btnText.textContent = originalText;
        el.btnCopy.classList.remove('copied');
      }, 2000);
    }).catch(err => {
      console.error('Failed to copy link: ', err);
    });
  });
}

function handleSwitch() {
  // Direct tab to Canva homepage
  window.location.href = 'https://www.canva.com/';
}

// Helper to escape HTML values
function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
