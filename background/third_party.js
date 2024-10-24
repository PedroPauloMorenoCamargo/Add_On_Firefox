let tabData = {}; // Store third-party domains per tab
let tabLoading = {}; // Track which tabs are currently loading
let activeTabId = null;
let injectedScripts = {}; // Store injected scripts data per tab
let tabScores = {}; // Store privacy scores for each tab
let intervalId;
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
    });
});


function calculatePrivacyScore(tabId) {
    let score = 100;

    // Criterion 1: Third-party domains (max 25 points)
    const thirdPartyDomains = tabData[tabId]?.thirdPartyDomains || new Set();
    score -= Math.min(10, thirdPartyDomains.size) * 3; // Each third-party domain reduces 3 points

    // Criterion 2: Cookies (max 30 points)
    const cookies = tabCookies[tabId];
    let cookieImpact = 0;
    if (cookies) {
        const thirdPartySessionCount = cookies.thirdPartySession.length;
        const thirdPartyPersistentCount = cookies.thirdPartyPersistent.length;
        const firstPartyPersistentCount = cookies.firstPartyPersistent.length;

        // Each third-party session cookie reduces 3 points
        cookieImpact += Math.min(10, thirdPartySessionCount) * 3;
        // Each third-party persistent cookie reduces 5 points
        cookieImpact += Math.min(10, thirdPartyPersistentCount) * 5;
        // Each first-party persistent cookie reduces 2 points
        cookieImpact += Math.min(10, firstPartyPersistentCount) * 2;
    }
    score -= cookieImpact;

    // Criterion 3: Injected scripts (max 20 points)
    const scripts = injectedScripts[tabId] || [];
    score -= Math.min(10, scripts.length) * 2; // Each injected script reduces 2 points

    // Criterion 4: Local Storage (max 20 points)
    return new Promise((resolve, reject) => {
        browser.runtime.sendMessage({ command: "getLocalStorage" }, (localStorageData) => {
            let storageImpact = 0;
            if (localStorageData && Object.keys(localStorageData).length > 0) {
                storageImpact += Math.floor(Object.keys(localStorageData).length / 3) * 5; // Every 3 local storage items reduce 5 points
            }
            score -= storageImpact;

            score = Math.max(0, score); // Ensure score is not negative
            resolve(score);
        });
    });
}




// Function to handle tab switching
function handleTabSwitch(newTabId) {
    activeTabId = newTabId;

    // Load saved scripts and cookies when switching to a new tab
    browser.storage.local.get([`injectedScripts_${newTabId}`, newTabId.toString(), `privacyScore_${newTabId}`]).then((result) => {
        if (result[newTabId]) {
            tabCookies[newTabId] = result[newTabId];
        } else {
            resetCookiesForTab(newTabId);
        }

        injectedScripts[newTabId] = result[`injectedScripts_${newTabId}`] || [];
        tabScores[newTabId] = result[`privacyScore_${newTabId}`] || calculatePrivacyScore(newTabId);
    });
}

// Listener for tab activation
browser.tabs.onActivated.addListener((activeInfo) => {
    handleTabSwitch(activeInfo.tabId);
});

// Listener for when a tab starts loading or is updated
browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status === "loading") {
        tabLoading[tabId] = true;

        // Clear injected scripts when the tab starts loading
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
        if (tabId === activeTabId) {
            handleTabSwitch(tabId);
        }
        detectScriptInjection(tabId);
    }
});



function detectScriptInjection(tabId) {
    clearInjectedScriptsForTab(tabId); // Clear previously injected scripts for this tab
    console.log(`Detecting script injection for tab ${tabId}`);
    
    browser.tabs.executeScript(tabId, {
        code: `
            (function() {
                console.log('Script injection monitoring started.');
                
                function monitorScriptInjection() {
                    const observedScripts = new Set();
                    const observer = new MutationObserver((mutations) => {
                        console.log('Mutations detected:', mutations); // Log all mutations
                        
                        mutations.forEach(mutation => {
                            if (mutation.type === 'childList') {
                                mutation.addedNodes.forEach(node => {
                                    if (node.tagName && node.tagName.toLowerCase() === 'script') {
                                        let scriptSrc = node.src || 'inline script';
                                        console.log('Script detected:', scriptSrc); // Log the detected script

                                        if (!observedScripts.has(scriptSrc)) {
                                            observedScripts.add(scriptSrc);
                                            chrome.runtime.sendMessage({
                                                command: 'scriptInjected',
                                                scriptSource: scriptSrc,
                                                scriptContent: node.src ? 'External Script: ' + scriptSrc : node.textContent
                                            });
                                        }
                                    }
                                });
                            }
                        });
                    });
                    observer.observe(document, { childList: true, subtree: true });
                }
                monitorScriptInjection();
            })();
        `
    }).then(() => {
        console.log(`Started script injection detection on tab ${tabId}`);
    }).catch((error) => {
        console.error('Error injecting script detection code:', error);
    });
}


browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.command === 'scriptInjected') {
        const tabId = sender.tab.id;

        if (!injectedScripts[tabId]) {
            injectedScripts[tabId] = [];
        }

        injectedScripts[tabId].push({
            domain: getDomain(sender.tab.url),
            content: message.scriptContent || "External script - No inline content"
        });

        console.log(`Storing script in tab ${tabId}:`, injectedScripts[tabId]);

        // Save the detected scripts in browser storage
        browser.storage.local.set({ [`injectedScripts_${tabId}`]: injectedScripts[tabId] })
            .then(() => {
                console.log(`Injected scripts for tab ${tabId} saved to storage`);
            })
            .catch(error => {
                console.error(`Failed to save injected scripts for tab ${tabId}:`, error);
            });
    }

    if (message.command === "getInjectedScripts") {
        console.log(`Returning scripts for tab ${activeTabId}:`, injectedScripts[activeTabId]);
        sendResponse({ scripts: injectedScripts[activeTabId] || [] });
    }

    if (message.command === "deleteInjectedScripts") {
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
    if (message.command === 'getPrivacyScore') {
        let tabId = null;
        
        // First, check if sender.tab exists
        if (sender.tab) {
            tabId = sender.tab.id;
        } else {
            // Fallback to query for the active tab
            browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
                if (tabs.length > 0) {
                    tabId = tabs[0].id;

                    // Now that we have the tabId, calculate the privacy score
                    calculatePrivacyScore(tabId).then(score => {
                        sendResponse({ score: score });
                    }).catch(error => {
                        console.error("Error calculating privacy score:", error);
                        sendResponse({ score: 0 });
                    });
                } else {
                    console.error("No active tab found");
                    sendResponse({ score: 0 });
                }
            }).catch(error => {
                console.error("Error querying active tab:", error);
                sendResponse({ score: 0 });
            });

            // Indicate that the response is asynchronous
            return true;
        }

        // If we already have the tabId from sender.tab
        if (tabId) {
            calculatePrivacyScore(tabId).then(score => {
                console.log("Calculated score:", score);
                sendResponse({ score: score });
            }).catch(error => {
                console.error("Error calculating privacy score:", error);
                sendResponse({ score: 0 });
            });

            // Indicate that the response is asynchronous
            return true;
        }
    }
    if (message.command === "getLocalStorage") {
        browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
            const activeTabId = tabs[0].id;
            browser.tabs.executeScript(activeTabId, {
                code: 'Object.entries(localStorage).reduce((obj, [key, value]) => { obj[key] = value; return obj; }, {});'
            }).then((results) => {
                sendResponse(results[0]);
            });
        });
        return true;
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
