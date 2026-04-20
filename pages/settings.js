const defaultSettings = {
    languages: [
        { code: "en", name: "English", highlight: true },
        { code: "es", name: "Spanish", highlight: true },
        { code: "fr", name: "French", highlight: true },
        { code: "pl", name: "Polish", highlight: true }
    ],
    defaultLanguage: "fr",
    defaultSearch: "Wiktionary",
    searchProviders: [
        { name: "Wiktionary", url: "https://en.wiktionary.org/wiki/{word}" },
        { name: "Google Translate", url: "https://translate.google.com/?sl=auto&tl=en&text={word}&op=translate" },
        { name: "Google Search", url: "https://www.google.com/search?q={word}" }
    ]
};

const langContainer = document.getElementById('languages-list');
const defaultLangSelect = document.getElementById('default-lang-select');
const searchContainer = document.getElementById('search-providers-list');
const defaultSearchSelect = document.getElementById('default-search-select');
const exportLangSelect = document.getElementById('export-lang-select');

async function loadSettings() {
    let data = await chrome.storage.local.get("settings");
    let settings = data.settings || defaultSettings;
    
    if (!settings.defaultLanguage) settings.defaultLanguage = "fr";
    if (!settings.searchProviders) settings.searchProviders = defaultSettings.searchProviders;
    if (!settings.defaultSearch) settings.defaultSearch = "Wiktionary";

    renderDefaultSelect(settings.languages, settings.defaultLanguage);
    renderDefaultSearchSelect(settings.searchProviders, settings.defaultSearch); // <-- New function
    renderLangs(settings.languages);
    renderSearchProviders(settings.searchProviders);

    renderExportSelect(settings.languages);
}

// Master save function
async function saveSettings(newSettings) {
    await chrome.storage.local.set({ settings: newSettings });
    loadSettings(); // Reload the UI to reflect exact saved state
}

function renderDefaultSelect(langs, currentDefault) {
    defaultLangSelect.innerHTML = langs.map(l => 
        `<option value="${l.code}" ${l.code === currentDefault ? 'selected' : ''}>${l.name}</option>`
    ).join('');
}

function renderDefaultSearchSelect(providers, currentDefault) {
    defaultSearchSelect.innerHTML = providers.map(p => 
        `<option value="${p.name}" ${p.name === currentDefault ? 'selected' : ''}>${p.name}</option>`
    ).join('');
}

function renderExportSelect(langs) {
    exportLangSelect.innerHTML = `<option value="all">All Languages</option>` + 
        langs.map(l => `<option value="${l.code}">${l.name}</option>`).join('') +
        `<option value="unassigned">Unassigned</option>`;
}

function renderLangs(langs) {
    langContainer.innerHTML = "";
    langs.forEach((lang, index) => {
        let row = document.createElement('div');
        row.className = 'lang-row';
        row.innerHTML = `
            <div><strong>${lang.name}</strong> <span class="lang-badge">${lang.code}</span></div>
            <div style="display: flex; align-items: center; gap: 15px;">
                <label class="toggle-label">
                    <input type="checkbox" class="highlight-toggle" data-index="${index}" ${lang.highlight ? 'checked' : ''}> Highlight words
                </label>
                <button class="delete-lang-btn" data-index="${index}" data-code="${lang.code}" style="background: none; border: none; color: #ff6b6b; padding: 0; font-size: 16px;" title="Remove Language">🗑️</button>
            </div>
        `;
        langContainer.appendChild(row);
    });

    let unassignedRow = document.createElement('div');
    unassignedRow.className = 'lang-row';
    unassignedRow.style.opacity = "0.7";
    unassignedRow.innerHTML = `<div><strong>Unassigned</strong> <span class="lang-badge">unassigned</span></div>`;
    langContainer.appendChild(unassignedRow);
}

function renderSearchProviders(providers) {
    searchContainer.innerHTML = "";
    providers.forEach((provider, index) => {
        let row = document.createElement('div');
        row.className = 'lang-row';
        row.innerHTML = `
            <div style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-right: 10px;">
                <strong>${provider.name}</strong><br>
                <span style="font-size: 11px; color: #888;">${provider.url}</span>
            </div>
            <button class="delete-search-btn" data-index="${index}" style="background: none; border: none; color: #ff6b6b; padding: 0; font-size: 16px; cursor: pointer;" title="Remove Provider">🗑️</button>
        `;
        searchContainer.appendChild(row);
    });
}

// --- EVENT LISTENERS ---

defaultLangSelect.addEventListener('change', async (e) => {
    let data = await chrome.storage.local.get("settings");
    let settings = data.settings || defaultSettings;
    settings.defaultLanguage = e.target.value;
    saveSettings(settings);
});

// ADD Language
document.getElementById('btn-add-lang').addEventListener('click', async () => {
    let code = document.getElementById('new-lang-code').value.trim().toLowerCase();
    let name = document.getElementById('new-lang-name').value.trim();
    if (!code || !name) return alert("Please fill out both the code and the name.");

    let data = await chrome.storage.local.get("settings");
    let settings = data.settings || defaultSettings;
    if (settings.languages.some(l => l.code === code)) return alert("This language code already exists!");

    settings.languages.push({ code, name, highlight: true });
    document.getElementById('new-lang-code').value = ""; 
    document.getElementById('new-lang-name').value = "";
    saveSettings(settings);
});

// CHANGE Default Search Provider
defaultSearchSelect.addEventListener('change', async (e) => {
    let data = await chrome.storage.local.get("settings");
    let settings = data.settings || defaultSettings;
    settings.defaultSearch = e.target.value;
    saveSettings(settings);
});

// ADD Search Provider
document.getElementById('btn-add-search').addEventListener('click', async () => {
    let name = document.getElementById('new-search-name').value.trim();
    let url = document.getElementById('new-search-url').value.trim();
    if (!name || !url) return alert("Please fill out both the name and the URL.");
    if (!url.includes("{word}")) return alert("The URL must contain the {word} placeholder!");

    let data = await chrome.storage.local.get("settings");
    let settings = data.settings || defaultSettings;

    settings.searchProviders.push({ name, url });
    document.getElementById('new-search-name').value = ""; 
    document.getElementById('new-search-url').value = "";
    saveSettings(settings);
});

// DELETES and TOGGLES via Event Delegation
document.body.addEventListener('click', async (e) => {
    let data = await chrome.storage.local.get("settings");
    let settings = data.settings || defaultSettings;

    if (e.target.classList.contains('highlight-toggle')) {
        settings.languages[e.target.getAttribute('data-index')].highlight = e.target.checked;
        saveSettings(settings);
    }

    let deleteLangBtn = e.target.closest('.delete-lang-btn');
    if (deleteLangBtn) {
        let index = deleteLangBtn.getAttribute('data-index');
        let code = deleteLangBtn.getAttribute('data-code');
        if (confirm(`Remove this language? Any saved words will be moved to "Unassigned".`)) {
            settings.languages.splice(index, 1);
            
            // Re-assign fallback if they deleted the default
            if (!settings.languages.some(l => l.code === settings.defaultLanguage)) {
                settings.defaultLanguage = settings.languages.length > 0 ? settings.languages[0].code : "unassigned";
            }
            saveSettings(settings);

            let allData = await chrome.storage.local.get(null);
            for (let key in allData) {
                if (key !== "settings" && allData[key].language === code) {
                    allData[key].language = "unassigned";
                    await chrome.storage.local.set({ [key]: allData[key] });
                }
            }
        }
    }

    let deleteSearchBtn = e.target.closest('.delete-search-btn');
    if (deleteSearchBtn) {
        if (confirm("Remove this search provider?")) {
            settings.searchProviders.splice(deleteSearchBtn.getAttribute('data-index'), 1);
            // Re-assign fallback if they deleted the default
            if (!settings.searchProviders.some(p => p.name === settings.defaultSearch)) {
                settings.defaultSearch = settings.searchProviders.length > 0 ? settings.searchProviders[0].name : "";
            }
            saveSettings(settings);
        }
    }
});

// --- EXPORT LOGIC ---
document.getElementById('btn-export').addEventListener('click', async () => {
    let lang = exportLangSelect.value;
    let data = await chrome.storage.local.get(null);
    let exportObj = {};
    
    for (let key in data) {
        if (key !== "settings") {
            if (lang === 'all' || data[key].language === lang) {
                exportObj[key] = data[key];
            }
        }
    }
    
    if (Object.keys(exportObj).length === 0) return alert("No words found to export for this language.");

    // Create and download the JSON file
    let blob = new Blob([JSON.stringify(exportObj, null, 2)], {type: "application/json"});
    let url = URL.createObjectURL(blob);
    let a = document.createElement('a');
    a.href = url;
    a.download = `my-dictionary-backup-${lang}-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
});

// --- IMPORT LOGIC ---
document.getElementById('btn-import').addEventListener('click', () => {
    let fileInput = document.getElementById('import-file');
    if (!fileInput.files.length) return alert("Please select a JSON file to import.");
    
    let file = fileInput.files[0];
    let reader = new FileReader();
    
    reader.onload = async (e) => {
        try {
            let importedData = JSON.parse(e.target.result);
            let currentData = await chrome.storage.local.get(null);
            
            let addedCount = 0;
            let updatedCount = 0;

            for (let word in importedData) {
                if (word === "settings") continue; // Never overwrite settings via word import

                let incomingWord = importedData[word];
                
                if (currentData[word]) {
                    // Word exists: Keep local definition & language, merge context sentences
                    let existingExamples = currentData[word].examples || [];
                    let incomingExamples = incomingWord.examples || [];
                    let addedNewSentence = false;
                    
                    incomingExamples.forEach(incEx => {
                        if (!existingExamples.some(ex => ex.sentence === incEx.sentence)) {
                            existingExamples.push(incEx);
                            addedNewSentence = true;
                        }
                    });
                    
                    if (addedNewSentence) {
                        currentData[word].examples = existingExamples;
                        updatedCount++;
                    }
                } else {
                    // Brand new word: import it completely
                    currentData[word] = incomingWord;
                    addedCount++;
                }
            }

            await chrome.storage.local.set(currentData);
            alert(`Import complete!\n\nAdded ${addedCount} new words.\nMerged new sentences into ${updatedCount} existing words.`);
            fileInput.value = ""; 
        } catch (err) {
            alert("Error importing file! Make sure it is a valid JSON dictionary backup.");
        }
    };
    
    reader.readAsText(file);
});

loadSettings();