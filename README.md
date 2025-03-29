# Add_On_Firefox

# Beast Guard

Beast Guard is a Firefox extension designed to help users monitor and enhance their privacy while browsing. It provides insights into potentially privacy-invasive elements such as third-party domains, cookies, local storage usage, and injected scripts. Beast Guard also computes a real-time privacy score for each tab based on these factors.

## Table of Contents

1. [Features](#features)  
2. [Installation](#installation)  
3. [How It Works](#how-it-works)  
4. [Usage](#usage)  
5. [Privacy Score Calculation](#privacy-score-calculation)  

---

## Features

- **Third-Party Domain Detection:** Identifies and lists domains that do not match the main page domain (potentially used for tracking).  
- **Cookie Classification:** Categorizes cookies into first-party vs. third-party and session vs. persistent.  
- **Script Injection Detection:** Monitors inline and external scripts added to the page in real time.  
- **Local Storage Tracking:** Retrieves and displays key-value pairs stored in the browser’s `localStorage`.  
- **Real-Time Privacy Score:** Calculates a privacy score from 0 to 100 based on factors like third-party domains, cookies, scripts, and storage usage.

---

## Installation

1. **Clone or Download the Repository:**
   - Download the repository as a ZIP or clone it to your local machine.
   
2. **Load as a Temporary Add-on in Firefox:**
   - Open Firefox and type `about:debugging#/runtime/this-firefox` in the address bar.
   - Click **Load Temporary Add-on**.
   - Select the `manifest.json` file from the Beast Guard folder.

3. **Installation Confirmation:**
   - After loading, the Beast Guard icon should appear in the Firefox toolbar (or be visible in the Extensions list).
   - The extension runs automatically once installed.

> **Note:** This method installs the extension temporarily and it will be removed when you restart Firefox. For permanent usage, you may need to package and sign the extension following Firefox developer guidelines.

---

## How It Works

Beast Guard consists of background logic and a popup interface.

1. **Background Script:**  
   - Monitors when tabs are opened, activated, or updated.
   - Tracks and classifies cookies as first- or third-party, session or persistent, and stores them per tab.
   - Detects third-party requests (e.g., sub-frames or iframes) to identify unique external domains visited during a session.
   - Injects a script to observe new `<script>` elements added to the DOM, detecting inline or external scripts.

2. **Popup Interface (HTML/JS in the extension's popup):**  
   - Displays real-time data including:
     - Third-party domains accessed
     - Cookies grouped by category
     - Local storage items
     - Injected scripts (inline or external)
   - Shows an overall privacy score for each tab.

3. **Storage:**
   - Uses `browser.storage.local` to maintain injected script data, cookie data, and the computed privacy score for each tab.

---

## Usage

1. **Open the Beast Guard Popup:**
   - Click on the Beast Guard icon in your Firefox toolbar to open the popup interface.

2. **View Privacy Insights:**
   - **Privacy Score**: See your current tab's privacy score at the top. The score changes based on detected third-party domains, cookies, scripts, and local storage usage.
   - **Third-Party Domains**: Expand this section to see a list of domains that differ from the main site’s domain.
   - **Cookies**: Expand each cookie category (first-party session, first-party persistent, third-party session, third-party persistent) to inspect the stored data.
   - **Injected Scripts**: See newly injected inline or external scripts detected in real time.
   - **Local Storage**: Expand to view key-value pairs stored by the current website.

3. **Monitoring Changes in Real Time:**
   - Beast Guard automatically updates the popup information every few seconds, allowing you to keep track of changes as they happen.

4. **Maintaining Accurate Data:**
   - Since Beast Guard persists certain data across browsing sessions, you may want to clear your cookies before revisiting a site if you’d like to start fresh. One way to do this is by using another extension or Firefox’s native cookie-clearing features.
   - For the most accurate privacy assessment on a single tab, avoid simultaneously browsing multiple sites in different tabs. Cookies and other data from previously visited tabs might be carried over and potentially skew the results for your current site.


---

## Privacy Score Calculation

The privacy score starts at **100** and deducts points for various privacy-impacting factors:

1. **Third-Party Domains**  
   - Each detected third-party domain reduces the score by 3 points (up to 10 domains, max: -30 points).

2. **Cookies**  
   - Third-party session cookies: -3 points each (up to 10 cookies).
   - Third-party persistent cookies: -5 points each (up to 10 cookies).
   - First-party persistent cookies: -2 points each (up to 10 cookies).

3. **Injected Scripts**  
   - Each discovered script lowers the score by 2 points (up to 10 scripts, max: -20 points).

4. **Local Storage**  
   - For every 3 local storage items, -5 points (no upper limit, but effectively it won’t drop below 0).

The final result is clamped between **0** and **100**.

---

**Stay safe and enjoy enhanced privacy with Beast Guard!**
