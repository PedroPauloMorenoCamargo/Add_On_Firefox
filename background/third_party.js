let tabData = {}; // Store third-party domains per tab
let tabLoading = {}; // Track which tabs are currently loading
let activeTabId = null;
let injectedScripts = {}; // Store injected scripts data per tab

// Dictionary to store cookies for each tab
let tabCookies = {};

// Function to clear cookie arrays and reset them for a tab
function resetCookiesForTab(tabId) {
    tabCookies[tabId] = {
        firstPartySession: [],
        firstPartyPersistent: [],
        thirdPartySession: [],
        thirdPartyPersistent: []
    };
    tabData[tabId] = {
        thirdPartyDomains: new Set()  // Track third-party domains as a Set to prevent duplicates
    };
    injectedScripts[tabId] = []; // Initialize injected scripts for this tab
}

// Function to clear injected scripts explicitly
function clearInjectedScriptsForTab(tabId) {
    if (!injectedScripts[tabId]) {
        injectedScripts[tabId] = [];
    }
    // Clear the injected scripts array
    injectedScripts[tabId].length = 0;

    // Clear from local storage
    browser.storage.local.set({ [`injectedScripts_${tabId}`]: [] });

    // Notify the popup to refresh the UI with zero scripts
    browser.runtime.sendMessage({
        command: "refreshData"
    });
}

// Function to get the domain from a URL
function getDomain(url) {
    const urlObject = new URL(url);
    return urlObject.hostname;
}

// Function to classify cookies dynamically based on domain and session type
function classifyCookie(cookie, tabDomain, tabId) {
    const cookieDomain = cookie.domain.startsWith('.') ? cookie.domain.slice(1) : cookie.domain;
    const isFirstParty = tabDomain.endsWith(cookieDomain) || cookieDomain.endsWith(tabDomain);
    const isSession = !cookie.expirationDate;  // If no expirationDate, it's a session cookie

    const cookieList = isFirstParty ? 
        (isSession ? tabCookies[tabId].firstPartySession : tabCookies[tabId].firstPartyPersistent) :
        (isSession ? tabCookies[tabId].thirdPartySession : tabCookies[tabId].thirdPartyPersistent);

    if (!cookieList.some(existingCookie => existingCookie.key === cookie.name)) {
        cookieList.push({ key: cookie.name, value: cookie.value });
    }

    // Store cookies persistently using the tabId as key
    browser.storage.local.set({ [tabId]: tabCookies[tabId] });
}

// Listener for cookie changes (added or updated cookies)
browser.cookies.onChanged.addListener((changeInfo) => {
    if (changeInfo.removed) return; // Skip removed cookies

    browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
        const activeTab = tabs[0];
        const tabDomain = getDomain(activeTab.url);

        if (!tabCookies[activeTab.id]) {
            resetCookiesForTab(activeTab.id);
        }

        classifyCookie(changeInfo.cookie, tabDomain, activeTab.id);

        browser.runtime.sendMessage({
            command: "cookiesUpdated"
        });
    });
});

// Function to handle tab switching
function handleTabSwitch(newTabId) {
    activeTabId = newTabId;

    // Load saved scripts and cookies when switching to a new tab
    browser.storage.local.get([`injectedScripts_${newTabId}`, newTabId.toString()]).then((result) => {
        if (result[newTabId]) {
            tabCookies[newTabId] = result[newTabId];
        } else {
            resetCookiesForTab(newTabId);
        }

        // Clear previous scripts and refresh for the new tab
        injectedScripts[newTabId] = [];

        if (result[`injectedScripts_${newTabId}`]) {
            injectedScripts[newTabId] = result[`injectedScripts_${newTabId}`];
        }

        // Notify the popup to refresh with the new data
        browser.runtime.sendMessage({
            command: "refreshData"
        });
    });
}

// Listener for tab activation
browser.tabs.onActivated.addListener((activeInfo) => {
    handleTabSwitch(activeInfo.tabId);
});

// Listener for when a tab starts loading or is updated
browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === "loading") {
        tabLoading[tabId] = true;

        // Clear injected scripts when the tab starts loading (on refresh)
        clearInjectedScriptsForTab(tabId);

        // Restore cookies from storage for the updated tab
        browser.storage.local.get(tabId.toString()).then((result) => {
            if (result[tabId]) {
                tabCookies[tabId] = result[tabId];
            } else {
                resetCookiesForTab(tabId);
            }
        });
    } else if (changeInfo.status === "complete") {
        tabLoading[tabId] = false;

        // Set the current active tab when loading completes
        if (tabId === activeTabId) {
            handleTabSwitch(tabId);
        }

        // Start monitoring for script injections after page is fully loaded
        detectScriptInjection(tabId);
    }
});

// Detect third-party requests and store third-party domains
browser.webRequest.onBeforeRequest.addListener(
    (details) => {
        const tabId = details.tabId;
        const requestUrlDomain = getDomain(details.url);

        if (tabId >= 0) {
            browser.tabs.get(tabId).then((tab) => {
                const tabDomain = getDomain(tab.url);

                if (requestUrlDomain !== tabDomain && tabData[tabId]) {
                    tabData[tabId].thirdPartyDomains.add(requestUrlDomain);  // Add third-party domain
                }
            });
        }
    },
    { urls: ["<all_urls>"], types: ["main_frame", "sub_frame"] }
);

// Delete the data for a tab when it is closed
browser.tabs.onRemoved.addListener((tabId) => {
    delete tabData[tabId];
    delete tabCookies[tabId];
    delete tabLoading[tabId];
    delete injectedScripts[tabId];

    // Also remove from storage
    browser.storage.local.remove(tabId.toString());
    browser.storage.local.remove(`injectedScripts_${tabId}`);
});

// Detect and log script injection on the current tab
function detectScriptInjection(tabId) {
    // Clear previous scripts when detecting new ones
    clearInjectedScriptsForTab(tabId);

    browser.tabs.executeScript(tabId, {
        code: `
            (function() {
                // Function to monitor and detect new scripts being injected into the page
                function monitorScriptInjection() {
                    const observedScripts = new Set();

                    // Use MutationObserver to detect new script elements
                    const observer = new MutationObserver((mutations) => {
                        mutations.forEach(mutation => {
                            if (mutation.type === 'childList') {
                                mutation.addedNodes.forEach(node => {
                                    if (node.tagName && node.tagName.toLowerCase() === 'script') {
                                        let scriptSrc = node.src || 'inline script';

                                        // Log the script source or content
                                        if (node.src) {
                                            console.warn('External Script injected:', node.src);
                                        } else {
                                            console.warn('Inline Script injected:', node.textContent);
                                        }

                                        // Ensure we only handle the script once
                                        if (!observedScripts.has(scriptSrc)) {
                                            observedScripts.add(scriptSrc);

                                            // Send a message back to the background script about the injected script
                                            browser.runtime.sendMessage({
                                                command: 'scriptInjected',
                                                scriptSource: scriptSrc,
                                                scriptContent: node.src ? 'External Script: ' + scriptSrc : node.textContent  // Send content for inline scripts
                                            });
                                        }
                                    }
                                });
                            }
                        });
                    });

                    // Start observing the document for added script tags
                    observer.observe(document, {
                        childList: true,
                        subtree: true
                    });
                }

                // Start monitoring the page for script injections
                monitorScriptInjection();
            })();
        `
    }).then(() => {
        console.log(`Started script injection detection on tab ${tabId}`);
    }).catch((error) => {
        console.error('Error injecting script detection code:', error);
    });
}

// Listener for injected script detection
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.command === 'scriptInjected') {
        const tabId = sender.tab.id;

        if (!injectedScripts[tabId]) {
            injectedScripts[tabId] = [];
        }

        // Collect injected script details
        injectedScripts[tabId].push({
            domain: getDomain(sender.tab.url),
            content: message.scriptContent || "External script - No inline content"
        });

        // Save scripts to local storage
        browser.storage.local.set({ [`injectedScripts_${tabId}`]: injectedScripts[tabId] });
    }

    if (message.command === "getInjectedScripts") {
        sendResponse({ scripts: injectedScripts[activeTabId] || [] });
    }

    if (message.command === "deleteInjectedScripts") {
        // Clear injected scripts for the current tab
        clearInjectedScriptsForTab(activeTabId);
        sendResponse({ status: "success" });
    }

    if (message.command === "getThirdPartyDomains") {
        sendResponse({ domains: Array.from(tabData[activeTabId]?.thirdPartyDomains || []) });
    }

    if (message.command === "getCookies") {
        sendResponse(tabCookies[activeTabId] || {
            firstPartySession: [],
            firstPartyPersistent: [],
            thirdPartySession: [],
            thirdPartyPersistent: []
        });
    }

    if (message.command === "getLocalStorage") {
        browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
            const activeTabId = tabs[0].id;
            browser.tabs.executeScript(activeTabId, {
                code: 'Object.entries(localStorage).reduce((obj, [key, value]) => { obj[key] = value; return obj; }, {});'
            }).then((results) => {
                sendResponse(results[0]); // The result will be an object containing key-value pairs from localStorage
            });
        });
        return true; // Indicate that the response will be sent asynchronously
    }
});
