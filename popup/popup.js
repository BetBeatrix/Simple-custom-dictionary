// Open the Full Word List
document.getElementById('btn-wordlist').addEventListener('click', () => {
    browser.tabs.create({ 
        // getURL dynamically finds the exact absolute path to your file
        url: browser.runtime.getURL("pages/wordlist.html") 
    });
    // Close the tiny popup box immediately after opening the tab
    window.close(); 
});

// Open the Settings Page
document.getElementById('btn-settings').addEventListener('click', () => {
    browser.tabs.create({ 
        url: browser.runtime.getURL("pages/settings.html") 
    });
    window.close();
});