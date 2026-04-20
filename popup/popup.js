// Open the Full Word List
document.getElementById('btn-wordlist').addEventListener('click', () => {
    chrome.tabs.create({ 
        // getURL dynamically finds the exact absolute path to your file
        url: chrome.runtime.getURL("pages/wordlist.html") 
    });
    // Close the tiny popup box immediately after opening the tab
    window.close(); 
});

// Open the Settings Page
document.getElementById('btn-settings').addEventListener('click', () => {
    chrome.tabs.create({ 
        url: chrome.runtime.getURL("pages/settings.html") 
    });
    window.close();
});