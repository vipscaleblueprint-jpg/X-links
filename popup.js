/**
 * X-links, popup.js
 * Displays the redirected links log. No toggle, blocker is always ON.
 */

const el = {
  blockedCount: document.getElementById('blocked-count'),
  btnClear:     document.getElementById('btn-clear'),
  logList:      document.getElementById('log-list'),
  emptyState:   document.getElementById('empty-state'),
  teamName:     document.getElementById('team-name')
};

document.addEventListener('DOMContentLoaded', () => {
  loadLog();
  loadCurrentTeam();
  el.btnClear.addEventListener('click', clearLog);
});

function loadCurrentTeam() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const activeTab = tabs[0];
    if (!activeTab) return;

    chrome.storage.local.get({ tabTeams: {} }, (data) => {
      const team = data.tabTeams[activeTab.id];
      if (team?.initials) {
        el.teamName.textContent = team.initials;
        el.teamName.classList.remove('unknown');
        el.teamName.style.backgroundColor = team.color;
        el.teamName.style.color = '#ffffff';
      } else {
        el.teamName.textContent = 'Open canva.com to detect';
        el.teamName.classList.add('unknown');
        el.teamName.style.backgroundColor = '';
        el.teamName.style.color = '';
      }
    });
  });
}

function loadLog() {
  chrome.storage.local.get({ blockedLinks: [] }, (data) => {
    renderLog(data.blockedLinks);
  });
}

function renderLog(links) {
  el.blockedCount.textContent = links.length;
  el.blockedCount.classList.toggle('has-items', links.length > 0);
  el.logList.innerHTML = '';

  if (links.length === 0) {
    el.emptyState.classList.remove('hidden');
    el.logList.classList.add('hidden');
    return;
  }

  el.emptyState.classList.add('hidden');
  el.logList.classList.remove('hidden');

  links.forEach((entry) => {
    let domain = entry.url;
    let path = '';
    try {
      const u = new URL(entry.url);
      domain = u.hostname.replace('www.', '');
      const match = u.pathname.match(/\/design\/([^/]+)/);
      path = match ? `Design: ${match[1].slice(0, 22)}…` : u.pathname;
    } catch (e) {}

    const row = document.createElement('div');
    row.className = 'log-entry';
    row.title = 'Click to copy URL';
    row.innerHTML = `
      <svg class="blocked-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M13.8 12H3"
              stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <div class="log-info">
        <div class="log-domain">${escapeHtml(domain)}</div>
        <div class="log-path">${escapeHtml(path)}</div>
        <div class="log-time">${formatTime(entry.timestamp)}</div>
      </div>
      <div class="log-copy-hint">Copy</div>
    `;

    row.addEventListener('click', () => {
      navigator.clipboard.writeText(entry.url).then(() => {
        const hint = row.querySelector('.log-copy-hint');
        hint.textContent = 'Copied!';
        hint.classList.add('copied');
        setTimeout(() => { hint.textContent = 'Copy'; hint.classList.remove('copied'); }, 1500);
      });
    });

    el.logList.appendChild(row);
  });
}

function clearLog() {
  chrome.storage.local.set({ blockedLinks: [] }, () => {
    renderLog([]);
  });
}

function formatTime(ts) {
  const diff  = Date.now() - ts;
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 1)   return 'Just now';
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return 'Yesterday';
  return new Date(ts).toLocaleDateString();
}

function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
