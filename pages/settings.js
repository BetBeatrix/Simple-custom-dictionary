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

async function loadSettings() {
    let data = await browser.storage.local.get("settings");
    let settings = data.settings || defaultSettings;
    
    if (!settings.defaultLanguage) settings.defaultLanguage = "fr";
    if (!settings.searchProviders) settings.searchProviders = defaultSettings.searchProviders;
    if (!settings.defaultSearch) settings.defaultSearch = "Wiktionary";

    renderDefaultSelect(settings.languages, settings.defaultLanguage);
    renderDefaultSearchSelect(settings.searchProviders, settings.defaultSearch); // <-- New function
    renderLangs(settings.languages);
    renderSearchProviders(settings.searchProviders);
}

// Master save function
async function saveSettings(newSettings) {
    await browser.storage.local.set({ settings: newSettings });
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
    let data = await browser.storage.local.get("settings");
    let settings = data.settings || defaultSettings;
    settings.defaultLanguage = e.target.value;
    saveSettings(settings);
});

// ADD Language
document.getElementById('btn-add-lang').addEventListener('click', async () => {
    let code = document.getElementById('new-lang-code').value.trim().toLowerCase();
    let name = document.getElementById('new-lang-name').value.trim();
    if (!code || !name) return alert("Please fill out both the code and the name.");

    let data = await browser.storage.local.get("settings");
    let settings = data.settings || defaultSettings;
    if (settings.languages.some(l => l.code === code)) return alert("This language code already exists!");

    settings.languages.push({ code, name, highlight: true });
    document.getElementById('new-lang-code').value = ""; 
    document.getElementById('new-lang-name').value = "";
    saveSettings(settings);
});

// CHANGE Default Search Provider
defaultSearchSelect.addEventListener('change', async (e) => {
    let data = await browser.storage.local.get("settings");
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

    let data = await browser.storage.local.get("settings");
    let settings = data.settings || defaultSettings;

    settings.searchProviders.push({ name, url });
    document.getElementById('new-search-name').value = ""; 
    document.getElementById('new-search-url').value = "";
    saveSettings(settings);
});

// DELETES and TOGGLES via Event Delegation
document.body.addEventListener('click', async (e) => {
    let data = await browser.storage.local.get("settings");
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

            let allData = await browser.storage.local.get(null);
            for (let key in allData) {
                if (key !== "settings" && allData[key].language === code) {
                    allData[key].language = "unassigned";
                    await browser.storage.local.set({ [key]: allData[key] });
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

loadSettings();