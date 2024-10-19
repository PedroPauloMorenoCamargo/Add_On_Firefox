let thirdPartyDomains = new Set();
let activeTabId = null;

// Function to get the domain from a URL
function getDomain(url) {
    const urlObject = new URL(url);
    return urlObject.hostname;
}

// Clear the domain list when necessary
function clearDomains() {
    thirdPartyDomains.clear();
}

// Listener to capture network requests
browser.webRequest.onBeforeRequest.addListener(
    (details) => {
        // Check if the request belongs to the active tab
        if (details.tabId === activeTabId && details.tabId !== -1) {
            browser.tabs.get(details.tabId, (tab) => {
                if (tab) {
                    const requestDomain = getDomain(details.url);
                    const tabDomain = getDomain(tab.url);

                    // Check if the request domain is different from the active tab's domain
                    if (requestDomain !== tabDomain) {
                        thirdPartyDomains.add(requestDomain); // Store third-party domain
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
    clearDomains(); // Clear old third-party requests when switching tabs
});

// Clear third-party requests and update when the page is reloaded
browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (tabId === activeTabId && changeInfo.status === "loading") {
        clearDomains(); // Clear third-party requests when reloading the tab
    }
});

// Listener for communication between popup and background script
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.command === "getThirdPartyDomains") {
        sendResponse({ domains: Array.from(thirdPartyDomains) });
    }
});
