// Function to fetch third-party domains
function fetchThirdPartyDomains() {
    browser.runtime.sendMessage({ command: "getThirdPartyDomains" }, (response) => {
        const domainList = document.getElementById("domain-list");

        // Clear the list before adding new domains
        domainList.innerHTML = ''; 
        if (response && response.domains.length > 0) {
            response.domains.forEach((domain) => {
                const listItem = document.createElement("li");
                listItem.textContent = domain;
                domainList.appendChild(listItem);
            });
        } else {
            const listItem = document.createElement("li");
            listItem.textContent = "No third-party domains detected.";
            domainList.appendChild(listItem);
        }
    });
}

// Initialize both the third-party domain fetching and local storage fetching
fetchThirdPartyDomains();
fetchLocalStorage();

