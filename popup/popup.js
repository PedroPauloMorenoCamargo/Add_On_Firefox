document.addEventListener('DOMContentLoaded', function () {
    function fetchData() {
        // Fetch third-party domains (unchanged)
        browser.runtime.sendMessage({ command: "getThirdPartyDomains" }, (response) => {
            const domainList = document.getElementById("domain-list");
            const domainCount = document.getElementById("third-party-count");
            domainList.innerHTML = '';
            if (response && response.domains.length > 0) {
                response.domains.forEach((domain) => {
                    const listItem = document.createElement("li");
                    listItem.textContent = domain;
                    domainList.appendChild(listItem);
                });
                domainCount.textContent = response.domains.length;
            } else {
                const listItem = document.createElement("li");
                listItem.textContent = "No third-party domains detected.";
                domainList.appendChild(listItem);
                domainCount.textContent = 0;
            }
        });

        // Fetch injected scripts and display each as a card
        browser.runtime.sendMessage({ command: "getInjectedScripts" }, (response) => {
            const scriptList = document.getElementById("scripts-list");
            const scriptCount = document.getElementById("script-count");
            scriptList.innerHTML = '';

            if (response && response.scripts.length > 0) {
                response.scripts.forEach((script) => {
                    const scriptDetail = document.createElement("div");
                    scriptDetail.className = "script-details card"; // Adding card class for styling
                    scriptDetail.innerHTML = `<span>Script Content:</span><br><pre>${script.content}</pre>`;
                    scriptList.appendChild(scriptDetail); // Append script content as card
                });
                scriptCount.textContent = response.scripts.length;
            } else {
                const listItem = document.createElement("li");
                listItem.textContent = "No scripts injected.";
                scriptList.appendChild(listItem);
                scriptCount.textContent = 0;
            }
        });

        // Fetch cookies and categorize them (unchanged)
        browser.runtime.sendMessage({ command: "getCookies" }, (response) => {
            response = response || {};
            const firstPartySession = response.firstPartySession || [];
            const firstPartyPersistent = response.firstPartyPersistent || [];
            const thirdPartySession = response.thirdPartySession || [];
            const thirdPartyPersistent = response.thirdPartyPersistent || [];

            populateCookieList("first-party-session-list", firstPartySession, "first-party-session-count", firstPartySession.length);
            populateCookieList("first-party-persistent-list", firstPartyPersistent, "first-party-persistent-count", firstPartyPersistent.length);
            populateCookieList("third-party-session-list", thirdPartySession, "third-party-session-count", thirdPartySession.length);
            populateCookieList("third-party-persistent-list", thirdPartyPersistent, "third-party-persistent-count", thirdPartyPersistent.length);
        });

        // Fetch localStorage data and display it (unchanged)
        browser.runtime.sendMessage({ command: "getLocalStorage" }, (response) => {
            if (!response) return;

            const localStorageKeys = Object.keys(response);
            const localStorageValues = Object.values(response);

            populateStorageList("storage-local-list", localStorageKeys, localStorageValues, "storage-local-count", localStorageKeys.length);
        });

        // Fetch the privacy score and display it
    // Fetch the privacy score and display it
    browser.runtime.sendMessage({ command: "getPrivacyScore" }, (response) => {
        if (response) {
            const scoreElement = document.getElementById("privacy-score");
            if (response.score !== undefined) {
                scoreElement.textContent = `Score:${response.score}/100`;

                // Update the color based on score
                if (response.score < 50) {
                    scoreElement.style.color = "red";
                } else if (response.score >= 50 && response.score <= 70) {
                    scoreElement.style.color = "yellow";
                } else {
                    scoreElement.style.color = "green";
                }
            }
        } else {
            console.error("Error fetching privacy score.");
        }
        });
    }

    function populateCookieList(elementId, cookies, countElementId, count) {
        const listElement = document.getElementById(elementId);
        const countElement = document.getElementById(countElementId);

        countElement.textContent = `(${count})`;
        listElement.innerHTML = "";

        cookies.forEach((cookie) => {
            const cookieDetail = document.createElement("div");
            cookieDetail.className = "cookie-details card"; // Adding card class for styling
            cookieDetail.innerHTML = `<span>Key:</span> ${cookie.key}, <span>Value:</span> ${cookie.value}`;
            listElement.appendChild(cookieDetail);
        });
    }

    function populateStorageList(elementId, keys, values, countElementId, count) {
        const listElement = document.getElementById(elementId);
        const countElement = document.getElementById(countElementId);

        countElement.textContent = `(${count})`;
        listElement.innerHTML = "";

        keys.forEach((key, index) => {
            const storageDetail = document.createElement("div");
            storageDetail.className = "storage-details card"; // Adding card class for styling
            storageDetail.innerHTML = `<span>Key:</span> ${key}, <span>Value:</span> ${values[index]}`;
            listElement.appendChild(storageDetail);
        });
    }

    document.querySelectorAll('.dropdown-btn').forEach(button => {
        button.addEventListener('click', function () {
            const panel = this.nextElementSibling;
            this.classList.toggle('active');
            if (panel.style.display === "none" || panel.style.display === "") {
                panel.style.display = "block";
                panel.style.maxHeight = panel.scrollHeight + "px"; // Allow it to expand
            } else {
                panel.style.maxHeight = "0px"; // Collapse
                setTimeout(() => {
                    panel.style.display = "none"; // Hide it completely after the collapse
                }, 200); // Delay the hiding to allow for the collapse animation
            }
        });
    });

    fetchData(); // Initial fetch
    setInterval(fetchData, 250); // Fetch every 1 second
});
