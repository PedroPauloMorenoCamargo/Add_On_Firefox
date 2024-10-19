// Function to fetch third-party domains
function fetchThirdPartyDomains() {
    browser.runtime.sendMessage({ command: "getThirdPartyDomains" }, (response) => {
        const domainList = document.getElementById("domain-list");

        // Clear the list before adding new domains
        domainList.innerHTML = ''; 
        if (response && response.domains) {
            response.domains.forEach((domain) => {
                const listItem = document.createElement("li");
                listItem.textContent = domain;
                domainList.appendChild(listItem);
            });
        }
    });
}

// Function to detect localStorage
function fetchLocalStorage() {
    browser.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        browser.tabs.executeScript(
            tabs[0].id,
            { code: '(' + getLocalStorageData + ')();' }, // Injects code into the active tab
            (results) => {
                const storageList = document.getElementById("storage-list");
                storageList.innerHTML = ''; // Clear before adding new items
                const localStorageData = results[0];

                if (localStorageData && Object.keys(localStorageData).length > 0) {
                    for (let key in localStorageData) {
                        const listItem = document.createElement("li");
                        listItem.textContent = `${key}: ${localStorageData[key]}`;
                        storageList.appendChild(listItem);
                    }
                } else {
                    const listItem = document.createElement("li");
                    listItem.textContent = "No data in local storage.";
                    storageList.appendChild(listItem);
                }
            }
        );
    });
}

// Function to run in the tab's context to capture localStorage data
function getLocalStorageData() {
    let data = {};
    for (let i = 0; i < localStorage.length; i++) {
        let key = localStorage.key(i);
        data[key] = localStorage.getItem(key);
    }
    return data;
}

// Start fetching data
fetchThirdPartyDomains();
fetchLocalStorage();
