# X-links

A Chrome Extension that intercepts and blocks Canva design links before they load on the wrong Canva team account. This prevents Canva's servers from registering views when using incorrect active accounts, saving teams from misattributing or exposing designs.

---

## 🚀 The Problem

In an agency managing multiple clients, team members frequently switch between different Canva teams. When a Canva design link is clicked from external sources (e.g., Slack, email, documents):
1. It automatically opens in whichever Canva team is currently active in the browser.
2. If it's the wrong team, the view is immediately logged on Canva's servers, potentially exposing design history or generating unwanted logs.
3. Once logged, simply navigating away does not undo the action.

## 🛡️ The Solution

**X-links** uses Chrome's `declarativeNetRequest` API to intercept HTTP requests to Canva design URLs *before* they are sent to Canva's servers. 
- The design page never loads.
- Canva never logs the view.
- A warning/interstitial page is displayed, allowing the user to verify and switch to the correct client team before proceeding.
- The extension icon dynamically displays the active Canva team name to provide constant visual context.

---

## ✨ Features

- **Pre-emptive Interception:** Blocks design links at the network level, ensuring no request touches Canva's servers until approved.
- **Dynamic Active Team Badge:** The extension icon badge dynamically updates to show the name of the currently active Canva team.
- **Interstitial Warning Page:** Prompts users to confirm they are on the correct team before loading the design link.
- **Safe Whitelisting:** Internal navigation within Canva (e.g., browsing within `canva.com` while already logged in) is automatically whitelisted and not blocked.

---

## 📁 Project Structure

- `manifest.json`: Extension configuration and permission declarations (v3).
- `background.js`: Service worker managing badge updates, active team detection, and warning page redirection.
- `rules.json`: Declarative Net Request rules defining matching patterns for interception.
- `content_team.js`: Injected content script that extracts the active Canva team name and communicates it to the service worker.
- `popup.html` / `popup.js` / `popup.css`: User interface to view extension status, active team, and stats.
- `warning.html` / `warning.js`: Interstitial page that appears when a design link is intercepted.

---

## 🛠️ Installation

1. **Clone the Repository:**
   ```bash
   git clone https://github.com/vipscaleblueprint-jpg/X-links.git
   cd X-links
   ```

2. **Load in Chrome:**
   - Open Google Chrome and navigate to `chrome://extensions/`.
   - Enable **Developer mode** (toggle in the top-right corner).
   - Click **Load unpacked** in the top-left corner.
   - Select the directory containing this repository.

---

## ⚙️ Configuration & Customization

The blocking rules are defined in `rules.json`. If you need to modify the interception patterns, you can customize the declarative Net Request rules therein.

---

## 📄 License

This project is licensed under the MIT License.
