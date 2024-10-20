let tabData = {}; // Store data per tab
let activeTabId = null;

// Function to get the domain from a URL
function getDomain(url) {
  const urlObject = new URL(url);
  return urlObject.hostname;
}

// Clear the data for a specific tab by deleting its entry
function clearTabData(tabId) {
  if (tabData[tabId]) {
    delete tabData[tabId];
    console.log(`Cleared data for tab ${tabId}`);
  }
}

// Function to reset cookies for the current tab (now handled during initialization)
function resetCookieCounts(tabId) {
  tabData[tabId].cookies = {
    firstPartySession: 0,
    firstPartyPersistent: 0,
    thirdPartySession: 0,
    thirdPartyPersistent: 0,
  };
  console.log(`Reset cookie counts for tab ${tabId}`);
}

// Function to categorize cookies into first-party/third-party and session/persistent
function categorizeCookies(cookies, tabId, isThirdParty) {
  console.log(`Categorizing ${cookies.length} cookies for tab ${tabId}`);
  cookies.forEach((cookie) => {
    // Create a unique identifier for the cookie
    const cookieId = `${cookie.name}|${cookie.domain}|${cookie.path}|${cookie.secure}|${cookie.sameSite}`;

    // Check if the cookie has already been counted
    if (!tabData[tabId].uniqueCookies.has(cookieId)) {
      tabData[tabId].uniqueCookies.add(cookieId);

      const cookieType = isThirdParty ? 'thirdParty' : 'firstParty';

      if (cookie.session || !cookie.expirationDate) {
        tabData[tabId].cookies[`${cookieType}Session`] += 1;
      } else {
        tabData[tabId].cookies[`${cookieType}Persistent`] += 1;
      }
    }
  });

  console.log(`Categorized Cookies for tab ${tabId}:`, tabData[tabId].cookies);
}

// Function to collect first-party cookies using the tab's URL and storeId
async function collectFirstPartyCookies(tabId) {
  try {
    const tab = await browser.tabs.get(tabId);
    const storeId = tab.cookieStoreId || '0'; // Default to '0' if undefined

    // Get cookies for the specific URL and storeId
    const cookies = await browser.cookies.getAll({ url: tab.url, storeId });

    console.log(`Collected ${cookies.length} first-party cookies for URL ${tab.url}`);

    // Categorize cookies as first-party
    categorizeCookies(cookies, tabId, false); // `false` indicates first-party cookies
  } catch (error) {
    console.error(`Error collecting first-party cookies for tab ${tabId}:`, error);
  }
}

// Function to collect third-party cookies for a domain only once, using storeId
async function collectThirdPartyCookiesForDomain(tabId, domain) {
  try {
    if (!tabData[tabId].collectedThirdPartyDomains.has(domain)) {
      tabData[tabId].collectedThirdPartyDomains.add(domain);

      const tab = await browser.tabs.get(tabId);
      const storeId = tab.cookieStoreId || '0'; // Default to '0' if undefined

      // Build a URL from the domain
      const url = `https://${domain}/`;

      // Get cookies for the specific URL and storeId
      const cookies = await browser.cookies.getAll({ url, storeId });

      console.log(`Collected ${cookies.length} third-party cookies for domain ${domain}`);

      // Categorize cookies as third-party
      categorizeCookies(cookies, tabId, true); // `true` indicates third-party cookies
    }
  } catch (error) {
    console.error(`Error collecting third-party cookies for domain ${domain}:`, error);
  }
}

// Listener to capture network requests and detect third-party domains
browser.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (details.tabId !== -1) {
      const tabId = details.tabId;
      if (!(tabId in tabData)) {
        tabData[tabId] = {
          thirdPartyDomains: new Set(),
          collectedThirdPartyDomains: new Set(),
          cookies: {
            firstPartySession: 0,
            firstPartyPersistent: 0,
            thirdPartySession: 0,
            thirdPartyPersistent: 0,
          },
          uniqueCookies: new Set(),
        };
      }

      browser.tabs.get(tabId).then((tab) => {
        if (tab) {
          const requestDomain = getDomain(details.url);
          const tabDomain = getDomain(tab.url);

          if (requestDomain !== tabDomain) {
            if (!tabData[tabId].thirdPartyDomains.has(requestDomain)) {
              tabData[tabId].thirdPartyDomains.add(requestDomain);
              console.log(`Third-party domain detected: ${requestDomain}`);

              // Collect third-party cookies for this domain
              collectThirdPartyCookiesForDomain(tabId, requestDomain);
            }
          }
        }
      }).catch(console.error);
    }
  },
  { urls: ["<all_urls>"] },
  []
);

// Listener for tab activation, updates activeTabId
browser.tabs.onActivated.addListener((activeInfo) => {
  activeTabId = activeInfo.tabId;

  // Initialize tab data if it doesn't exist
  if (!(activeTabId in tabData)) {
    tabData[activeTabId] = {
      thirdPartyDomains: new Set(),
      collectedThirdPartyDomains: new Set(),
      cookies: {
        firstPartySession: 0,
        firstPartyPersistent: 0,
        thirdPartySession: 0,
        thirdPartyPersistent: 0,
      },
      uniqueCookies: new Set(),
    };

    // Collect first-party cookies for the newly activated tab
    collectFirstPartyCookies(activeTabId);
  }
  // Do not reset or recollect cookies when switching back to a tab
});

// Listener for tab updates (e.g., reloaded), deletes previous data and collects new cookies
browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "loading") {
    clearTabData(tabId);

    // Initialize tab data after clearing
    tabData[tabId] = {
      thirdPartyDomains: new Set(),
      collectedThirdPartyDomains: new Set(),
      cookies: {
        firstPartySession: 0,
        firstPartyPersistent: 0,
        thirdPartySession: 0,
        thirdPartyPersistent: 0,
      },
      uniqueCookies: new Set(),
    };

    // Collect first-party cookies for the updated tab
    collectFirstPartyCookies(tabId);
  }
});

// Listener for when a tab is closed, to delete its associated data
browser.tabs.onRemoved.addListener((tabId) => {
  clearTabData(tabId);
});

// Listener for communication between the popup and background script
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.command === "getTabData" && activeTabId in tabData) {
    sendResponse({
      domains: Array.from(tabData[activeTabId].thirdPartyDomains),
      cookies: tabData[activeTabId].cookies,
    });
  }
});
