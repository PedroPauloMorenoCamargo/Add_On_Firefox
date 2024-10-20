// Function to fetch tab data (third-party domains and cookies)
function fetchTabData() {
    browser.runtime.sendMessage({ command: "getTabData" }).then((response) => {
      const domainList = document.getElementById("domain-list");
      const cookieList = document.getElementById("cookie-list");
  
      // Clear existing list items
      domainList.innerHTML = '';
      cookieList.innerHTML = '';
  
      // Display third-party domains
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
  
      // Display cookies data
      if (response && response.cookies) {
        const {
          firstPartySession,
          firstPartyPersistent,
          thirdPartySession,
          thirdPartyPersistent,
        } = response.cookies;
  
        cookieList.innerHTML = `
          <li>First-Party Session Cookies: ${firstPartySession}</li>
          <li>First-Party Persistent Cookies: ${firstPartyPersistent}</li>
          <li>Third-Party Session Cookies: ${thirdPartySession}</li>
          <li>Third-Party Persistent Cookies: ${thirdPartyPersistent}</li>
        `;
      } else {
        const listItem = document.createElement("li");
        listItem.textContent = "No cookies detected.";
        cookieList.appendChild(listItem);
      }
    }).catch((error) => {
      console.error('Error fetching tab data:', error);
    });
  }
  
// Function to detect and fetch localStorage
function fetchLocalStorage() {
  browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
    browser.tabs.executeScript(
      tabs[0].id,
      { code: '(' + getLocalStorageData + ')();' } // Inject code to active tab to get localStorage
    ).then((results) => {
      const storageList = document.getElementById("storage-list");
      storageList.innerHTML = ''; // Clear list before adding new items

      if (results && results[0]) {
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
      } else {
        const listItem = document.createElement("li");
        listItem.textContent = "Unable to retrieve local storage data.";
        storageList.appendChild(listItem);
      }
    }).catch((error) => {
      console.error('Error executing script in tab:', error);
    });
  }).catch((error) => {
    console.error('Error querying active tab:', error);
  });
}

// Function to get localStorage data from the current tab
function getLocalStorageData() {
  let data = {};
  for (let i = 0; i < localStorage.length; i++) {
    let key = localStorage.key(i);
    data[key] = localStorage.getItem(key);
  }
  return data;
}

// Initialize both the third-party domain and local storage fetching
fetchTabData();
fetchLocalStorage();