//open full word list page
document.getElementById('btn-wordlist').addEventListener('click', () => {
    chrome.tabs.create({ 
        url: chrome.runtime.getURL("pages/wordlist.html") 
    });
    window.close(); 
});

//open settings page
document.getElementById('btn-settings').addEventListener('click', () => {
    chrome.tabs.create({ 
        url: chrome.runtime.getURL("pages/settings.html") 
    });
    window.close();
});