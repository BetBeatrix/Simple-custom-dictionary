// --- STATE MANAGEMENT ---
let allWords = []; 
let currentPage = 1;
const itemsPerPage = 10; 

// --- DOM ELEMENTS ---
const container = document.getElementById('word-list-container');
const filterLang = document.getElementById('filter-lang');
const sortOrder = document.getElementById('sort-order');
const btnPrev = document.getElementById('btn-prev');
const btnNext = document.getElementById('btn-next');
const pageInfo = document.getElementById('page-info');

// --- INITIALIZATION ---
// --- INITIALIZATION ---
async function loadData() {
    let data = await chrome.storage.local.get(null);
    
    // 1. BUILD THE DYNAMIC LANGUAGE DROPDOWN
    let langs = data.settings?.languages || [
        { code: "en", name: "English" }, { code: "es", name: "Spanish" }, { code: "fr", name: "French" }, { code: "pl", name: "Polish" }
    ];
    
    let filterLangDropdown = document.getElementById('filter-lang');
    // Keep the default "All", add the custom languages, and cap it off with "Unassigned"
    let optionsHtml = `<option value="all">All Languages</option>`;
    optionsHtml += langs.map(l => `<option value="${l.code}">${l.name}</option>`).join('');
    optionsHtml += `<option value="unassigned">Unassigned</option>`;
    
    // Only update the innerHTML if we haven't selected a specific filter yet 
    // (prevents the dropdown from resetting to "All" when you delete a word)
    let currentSelection = filterLangDropdown.value;
    filterLangDropdown.innerHTML = optionsHtml;
    filterLangDropdown.value = currentSelection || "all";

    // 2. LOAD THE WORDS (And ignore the 'settings' object!)
    allWords = Object.keys(data)
        .filter(key => key !== "settings") // CRITICAL: Don't load settings as a word
        .map(key => {
            return {
                word: key,
                definition: data[key].definition,
                language: data[key].language,
                examples: data[key].examples || [],
                timestamp: data[key].timestamp || 0 
            };
        });

    renderList();
}

// --- CORE RENDER FUNCTION ---
function renderList() {
    let filteredWords = allWords;
    if (filterLang.value !== 'all') {
        filteredWords = allWords.filter(w => w.language === filterLang.value);
    }

    filteredWords.sort((a, b) => {
        if (sortOrder.value === 'newest') {
            return b.timestamp - a.timestamp; // Highest number (newest) first
        } else if (sortOrder.value === 'a-z') {
            return a.word.localeCompare(b.word);
        } else {
            return b.word.localeCompare(a.word);
        }
    });

    let totalPages = Math.ceil(filteredWords.length / itemsPerPage) || 1;
    if (currentPage > totalPages) currentPage = totalPages;

    let startIndex = (currentPage - 1) * itemsPerPage;
    let endIndex = startIndex + itemsPerPage;
    let wordsToShow = filteredWords.slice(startIndex, endIndex);

    container.innerHTML = ""; 
    
    if (wordsToShow.length === 0) {
        container.innerHTML = "<p style='text-align:center; color:#888;'>No words found.</p>";
    } else {
        wordsToShow.forEach(wordObj => {
            let examplesHtml = "";
            if (wordObj.examples.length > 0) {
                let sentences = wordObj.examples.map(ex => {
                    let link = ex.url ? `<a href="${ex.url}" target="_blank" title="Go to source">🔗</a>` : "";
                    return `<div class="example-item" style="display:flex; justify-content:space-between; align-items:start;">
                        <div>${link}<i>${ex.sentence}</i></div>
                        <button class="delete-sentence-btn" data-word="${wordObj.word}" data-sentence="${ex.sentence.replace(/"/g, '&quot;')}" style="background:none; border:none; color:#ff6b6b; padding:0; margin-left:10px;" title="Delete sentence">🗑️</button>
                    </div>`;
                }).join('');
                examplesHtml = `<div><strong>Context:</strong><br>${sentences}</div>`;
            }

            let details = document.createElement('details');
            details.className = 'word-card';
            // Notice we create a "View Mode" and an invisible "Edit Mode"
            details.innerHTML = `
                <summary>
                    <span>${wordObj.word} <span class="lang-badge">${wordObj.language}</span></span>
                </summary>
                
                <div class="card-content" id="view-${wordObj.word}">
                    <p><strong>Definition:</strong><br> ${wordObj.definition || "<em>No definition provided.</em>"}</p>
                    ${examplesHtml}
                    <div style="margin-top: 15px; display: flex; gap: 8px;">
                        <button class="edit-word-btn" data-word="${wordObj.word}">✏️ Edit</button>
                        <button class="delete-word-btn" data-word="${wordObj.word}" style="background-color: #dc3545;">🗑️ Delete</button>
                    </div>
                </div>

                <div class="card-content" id="edit-${wordObj.word}" style="display: none; background-color: #252525;">
                    <label style="font-size: 12px; color: #888;">Edit Definition:</label>
                    <textarea id="edit-def-${wordObj.word}" style="width: 100%; box-sizing: border-box; min-height: 60px; margin-bottom: 10px; background: #1e1e1e; color: white; border: 1px solid #555; padding: 8px; border-radius: 4px; font-family: inherit;">${wordObj.definition}</textarea>
                    
                    <div style="display: flex; gap: 8px;">
                        <button class="save-word-btn" data-word="${wordObj.word}" style="background-color: #198754; flex: 1;">💾 Save</button>
                        <button class="cancel-edit-btn" data-word="${wordObj.word}" style="flex: 1;">❌ Cancel</button>
                    </div>
                </div>
            `;
            container.appendChild(details);
        });
    }

    pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
    btnPrev.disabled = currentPage === 1;
    btnNext.disabled = currentPage === totalPages;
}

// --- EVENT LISTENERS ---

filterLang.addEventListener('change', () => { currentPage = 1; renderList(); });
sortOrder.addEventListener('change', () => { currentPage = 1; renderList(); });

btnPrev.addEventListener('click', () => {
    if (currentPage > 1) { currentPage--; renderList(); window.scrollTo(0, 0); }
});
btnNext.addEventListener('click', () => {
    currentPage++; renderList(); window.scrollTo(0, 0);
});

// --- INTERACTIVE BUTTONS (Event Delegation) ---
// We listen to the whole container so we don't have to attach 100 separate event listeners
container.addEventListener('click', async (e) => {
    let btn = e.target.closest('button');
    if (!btn) return;

    let word = btn.getAttribute('data-word');

    // 1. Delete Entire Word
    if (btn.classList.contains('delete-word-btn')) {
        if (confirm(`Are you sure you want to completely delete "${word}"?`)) {
            await chrome.runtime.sendMessage({ action: "deleteWord", data: { word } });
            loadData(); // Re-fetch from database and render
        }
    }
    
    // 2. Delete Single Sentence
    if (btn.classList.contains('delete-sentence-btn')) {
        let sentence = btn.getAttribute('data-sentence');
        if (confirm(`Delete this context sentence?`)) {
            await chrome.runtime.sendMessage({ action: "deleteSentence", data: { word, sentence } });
            loadData();
        }
    }

    // 3. Enter Edit Mode
    if (btn.classList.contains('edit-word-btn')) {
        document.getElementById(`view-${word}`).style.display = 'none';
        document.getElementById(`edit-${word}`).style.display = 'block';
    }

    // 4. Cancel Edit Mode
    if (btn.classList.contains('cancel-edit-btn')) {
        document.getElementById(`view-${word}`).style.display = 'block';
        document.getElementById(`edit-${word}`).style.display = 'none';
    }

    // 5. Save Edited Definition
    if (btn.classList.contains('save-word-btn')) {
        let newDef = document.getElementById(`edit-def-${word}`).value.trim();
        let wordObj = allWords.find(w => w.word === word);
        
        btn.textContent = "Saving...";
        await chrome.runtime.sendMessage({ 
            action: "saveWord", 
            data: { word: word, definition: newDef, language: wordObj.language } 
        });
        loadData(); 
    }
});

// Start the engine
loadData();