let tabData = {}; // Store third-party domains per tab
let activeTabId = null;

// Function to get the domain from a URL
function getDomain(url) {
    const urlObject = new URL(url);
    return urlObject.hostname;
}

// Clear the domain list for a specific tab
function clearDomains(tabId) {
    if (tabData[tabId]) {
        tabData[tabId].thirdPartyDomains.clear();
    }
}

// Listener to capture network requests
browser.webRequest.onBeforeRequest.addListener(
    (details) => {
        // Check if the request belongs to the active tab
        if (details.tabId in tabData && details.tabId !== -1) {
            browser.tabs.get(details.tabId, (tab) => {
                if (tab) {
                    const requestDomain = getDomain(details.url);
                    const tabDomain = getDomain(tab.url);

                    // Check if the request domain is different from the active tab's domain
                    if (requestDomain !== tabDomain) {
                        tabData[details.tabId].thirdPartyDomains.add(requestDomain); // Store third-party domain
                    }
                }
            });
        }
    },
    { urls: ["<all_urls>"] }
);

// Update the active tab ID when the active tab changes
browser.tabs.onActivated.addListener((activeInfo) => {
    activeTabId = activeInfo.tabId;

    // If the tab doesn't already have a domain set, initialize it
    if (!(activeTabId in tabData)) {
        tabData[activeTabId] = { thirdPartyDomains: new Set() };
    }
});

// Clear third-party requests and update when the page is reloaded or navigates
browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === "loading") {
        clearDomains(tabId); // Clear third-party requests when reloading or navigating the tab
    }
});

// Delete the data for a tab when it is closed
browser.tabs.onRemoved.addListener((tabId) => {
    delete tabData[tabId]; // Remove the stored domains for the closed tab
});

// Listener for communication between popup and background script
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.command === "getThirdPartyDomains" && activeTabId in tabData) {
        sendResponse({ domains: Array.from(tabData[activeTabId].thirdPartyDomains) });
    }
});
