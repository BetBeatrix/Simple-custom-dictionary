//variables to keep track of floating elements for easier removal later
let floatingIcon = null;
let floatingPanel = null;
let readOnlyPanel = null;

//listener for draging/highlighting text on the page
document.addEventListener('mouseup', function(event) {
    if (event.target.id === 'my-dictionary-floating-icon' || event.target.closest('#my-dictionary-panel')) {
        return; 
    }

    //getting the hightlighted text and the context sentence around it
    let selectedTextJson = getSelectionDetails();
    
    //if the text is valid show the icon
    if (selectedTextJson && selectedTextJson.isValid) {
        let selectedText = selectedTextJson.word;
        let contextSentence = selectedTextJson.sentence;
        showIcon(event.pageX, event.pageY, selectedText, contextSentence);
    }
});

//hide the icon/panel if click anywhere else on the page
document.addEventListener('mousedown', function(event) {
    // Ignore clicks on the icon OR inside either panel
    if (event.target.id === 'my-dictionary-floating-icon' || 
        event.target.closest('#my-dictionary-panel') ||
        event.target.closest('#my-dictionary-readonly-panel')) {
        return; 
    }
    
    removeIcon();
    removePanel();
    removeReadOnlyPanel(); // NEW
});


//listener for clicks on the highlighted text
document.addEventListener('click', async function(event) {
    if (event.target.classList.contains('my-dictionary-highlight')) {
        event.preventDefault(); 
        event.stopPropagation();

        let clickedWord = event.target.textContent.toLowerCase();
        
        // TRICK: Temporarily highlight the clicked span to reuse our sentence finder
        let range = document.createRange();
        range.selectNodeContents(event.target);
        let selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        
        // Grab the sentence, then instantly clear the highlight
        let details = getSelectionDetails();
        let currentSentence = details && details.isValid ? details.sentence : null;
        selection.removeAllRanges(); 

        let currentUrl = window.location.href;
        
        // Pass the new data to the read-only panel
        showReadOnlyPanel(event.pageX, event.pageY, clickedWord, currentSentence, currentUrl);
    }
});

// --- Helper Functions ---

function showIcon(x, y, text, contextSentence) {
    //remove any existing icon to avoid duplicates
    removeIcon();

    floatingIcon = document.createElement('img');
    floatingIcon.id = 'my-dictionary-floating-icon';
    
    //using chrome.* instead of browser.* for better compatibility across browsers
    floatingIcon.src = chrome.runtime.getURL('/icons/save.png'); 

    //position the icon near the cursor
    floatingIcon.style.left = (x + 5) + 'px';
    floatingIcon.style.top = (y + 10) + 'px';

    document.body.appendChild(floatingIcon);

    floatingIcon.addEventListener('click', function() {
        console.log("You clicked the icon! The word is:", text);
        showPanel(x + 5, y + 10, text, contextSentence); //pass the selected text + sentence to the panel
        
        //remove icon after opening the panel
        removeIcon(); 
    });
}

function removeIcon() {
    if (floatingIcon) {
        floatingIcon.remove();
        floatingIcon = null;
    }
}


async function showPanel(x, y, selectedText, contextSentence, existingData = null) {
    //remove any other floating elements
    removeIcon(); 
    removePanel();
    removeReadOnlyPanel();

    let boldedSentence = "";
    if (contextSentence) {
        let escapedWord = selectedText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        let highlightRegex = new RegExp(`(?<!\\p{L})(${escapedWord})(?!\\p{L})`, 'gui');
        boldedSentence = contextSentence.replace(highlightRegex, '<strong>$1</strong>');
    }

    floatingPanel = document.createElement('div');
    floatingPanel.id = 'my-dictionary-panel';
    
    let storageData = await chrome.storage.local.get("settings");
    let settings = storageData.settings || {};
    let langs = settings.languages || [
        { code: "en", name: "English" }, { code: "es", name: "Spanish" }, { code: "fr", name: "French" }, { code: "pl", name: "Polish" }
    ];
    
    //Set users default language or fallback to french
    let defaultLangCode = settings.defaultLanguage || "fr";

    //Set users default search provider or fallback to wiktionary
    let searchProviders = settings.searchProviders && settings.searchProviders.length > 0 
        ? settings.searchProviders 
        : [{ name: "Wiktionary", url: "https://en.wiktionary.org/wiki/{word}" }];
    
    let defaultSearchName = settings.defaultSearch || "Wiktionary";
    let chosenProvider = searchProviders.find(p => p.name === defaultSearchName) || searchProviders[0];
    
    //build the search url by replacing thr {word} placeholder
    let defaultSearchUrl = chosenProvider.url.replace('{word}', encodeURIComponent(selectedText));

    //set up existing values if we're editing an existing word, otherwise use defaults
    let currentDef = existingData ? existingData.definition : "";
    let currentLang = existingData ? existingData.language : defaultLangCode;
    
    //build the dynamic language dropdown options
    let langOptionsHtml = langs.map(l => 
        `<option value="${l.code}" ${currentLang === l.code ? 'selected' : ''}>${l.name}</option>`
    ).join('');
    langOptionsHtml += `<option value="unassigned" ${currentLang === 'unassigned' ? 'selected' : ''}>Unassigned</option>`;

    //build the existing sentences sections if there are any
    let existingSentencesHtml = "";
    if (existingData && existingData.examples && existingData.examples.length > 0) {
        let sentences = existingData.examples.map((ex, index) => `
            <div style="display: flex; align-items: start; gap: 5px; margin-bottom: 5px; background: #2a2a2a; padding: 5px; border-radius: 4px;">
                <button class="dict-delete-sentence-btn" data-sentence="${ex.sentence.replace(/"/g, '&quot;')}" style="background:none; border:none; color:#ff6b6b; cursor:pointer; font-size:12px;" title="Delete sentence">🗑️</button>
                <i style="font-size: 12px; line-height: 1.2;">${ex.sentence}</i>
            </div>
        `).join('');
        existingSentencesHtml = `<div style="margin-top: 10px;"><strong>Saved Sentences:</strong>${sentences}</div>`;
    }

    floatingPanel.innerHTML = `
        <div class="dict-header">
            <strong>${existingData ? "Edit Dictionary" : "Add to Dictionary"}</strong>
            <button id="dict-close-btn">&times;</button>
        </div>
        
        <label for="dict-word">Word:</label>
        <input type="text" id="dict-word" value="${selectedText}" disabled style="opacity: 0.7; cursor: not-allowed;">
        
       <label for="dict-def">Definition:</label>
        <textarea id="dict-def" placeholder="Type definition here...">${currentDef}</textarea>
        <a href="${defaultSearchUrl}" target="_blank" style="color: #66b3ff; font-size: 12px; text-decoration: none; font-weight: bold;">🔍 Search online</a>
        
        <label for="dict-lang">Language:</label>
        <select id="dict-lang">
            ${langOptionsHtml}
        </select>

        ${existingSentencesHtml}

        <div style="display: flex; align-items: center; gap: 8px; margin-top: 5px;">
            <input type="checkbox" id="context-sentence-checkbox" name="context-sentence" value="yes">
            <label for="context-sentence-checkbox" style="margin-bottom: 0;">Add new context sentence?</label>
        </div>
        <div id="context-sentence" style="display: none;">${boldedSentence}</div>
        
        <div style="display: flex; gap: 8px; margin-top: 15px;">
            ${existingData ? `<button id="dict-delete-word-btn">Delete</button>` : ''}
            <button id="dict-save-btn">Save Updates</button>
        </div>
    `;

    document.body.appendChild(floatingPanel);

    //position math
    let panelRect = floatingPanel.getBoundingClientRect();
    let scrollX = window.scrollX;
    let scrollY = window.scrollY;
    let maxX = scrollX + window.innerWidth - panelRect.width - 15;
    let maxY = scrollY + window.innerHeight - panelRect.height - 15;
    floatingPanel.style.left = Math.max(Math.min(x, maxX), scrollX + 15) + 'px';
    floatingPanel.style.top = Math.max(Math.min(y, maxY), scrollY + 15) + 'px';

    //dragging Logic
    let header = floatingPanel.querySelector('.dict-header');
    header.addEventListener('mousedown', function(e) {
        if (e.target.id === 'dict-close-btn') return;
        let startX = e.clientX, startY = e.clientY;
        let startLeft = parseInt(floatingPanel.style.left, 10);
        let startTop = parseInt(floatingPanel.style.top, 10);

        function dragMove(e) {
            let newLeft = Math.max(startLeft + (e.clientX - startX), window.scrollX);
            let newTop = Math.max(startTop + (e.clientY - startY), window.scrollY);
            floatingPanel.style.left = Math.min(newLeft, window.scrollX + window.innerWidth - floatingPanel.offsetWidth) + 'px';
            floatingPanel.style.top = newTop + 'px';
        }

        function dragEnd() {
            document.removeEventListener('mousemove', dragMove);
            document.removeEventListener('mouseup', dragEnd);
        }
        document.addEventListener('mousemove', dragMove);
        document.addEventListener('mouseup', dragEnd);
    });

    // checkbox to add new context sentence
    document.getElementById('context-sentence-checkbox').addEventListener('change', function() {
        document.getElementById('context-sentence').style.display = this.checked ? 'block' : 'none';
    });

    //close button
    document.getElementById('dict-close-btn').addEventListener('click', removePanel);
    
    //DELETE SENTENCE listeners
    document.querySelectorAll('.dict-delete-sentence-btn').forEach(btn => {
        btn.addEventListener('click', async function() {
            let sentenceToDelete = this.getAttribute('data-sentence');
            this.parentElement.style.opacity = "0.5"; // Visual feedback
            
            await chrome.runtime.sendMessage({
                action: "deleteSentence",
                data: { word: selectedText, sentence: sentenceToDelete }
            });
            this.parentElement.remove(); // Remove it from the UI permanently
        });
    });

    //DELETE ENTIRE WORD listener
    let deleteWordBtn = document.getElementById('dict-delete-word-btn');
    if (deleteWordBtn) {
        deleteWordBtn.addEventListener('click', async function() {
            let isSure = window.confirm(`Are you sure you want to completely delete "${selectedText}"? This cannot be undone.`);
            if (!isSure) return; 
            
            this.textContent = "Deleting...";
            await chrome.runtime.sendMessage({ action: "deleteWord", data: { word: selectedText } });
            
            //update the highlighter regex in memory to imidietely remove highlights of the deleted word
            await refreshHighlighter();
            
            //safely remove the highlights of the deleted word
            document.querySelectorAll('.my-dictionary-highlight').forEach(span => {
                if (span.textContent.toLowerCase() === selectedText.toLowerCase()) {
                    span.outerHTML = span.innerHTML; 
                }
            });
            
            removePanel();
        });
    }

    //SAVE listener
    document.getElementById('dict-save-btn').addEventListener('click', async function() {
        let finalDef = document.getElementById('dict-def').value.trim();
        let finalLang = document.getElementById('dict-lang').value;
        let finalSentence = document.getElementById('context-sentence-checkbox').checked ? contextSentence : null;
        let currentUrl = window.location.href; 
        
        this.textContent = "Saving...";
        this.style.backgroundColor = "#28a745"; 
        
        try {
            await chrome.runtime.sendMessage({
                action: "saveWord",
                data: { word: selectedText, definition: finalDef, language: finalLang, sentence: finalSentence, weblink: currentUrl }
            });
            
            //imidietely update the highlighter regex in memory and highlight the word without refreshing the page
            await refreshHighlighter();
            highlightNode(document.body);
            
            setTimeout(() => removePanel(), 400); 
        } catch (error) {
            this.textContent = "Error!";
            this.style.backgroundColor = "#dc3545"; 
        }
    });
}

function removePanel() {
    if (floatingPanel) {
        floatingPanel.remove();
        floatingPanel = null;
    }
}

async function showReadOnlyPanel(x, y, wordToLookup, currentSentence, currentUrl) {
    removeIcon();
    removePanel();
    removeReadOnlyPanel();

    try {
        let result = await chrome.storage.local.get(wordToLookup);
        let wordData = result[wordToLookup];
        if (!wordData) return;

        //like in the edit/save panel
        let settingsData = await chrome.storage.local.get("settings");
        let searchProviders = settingsData.settings?.searchProviders && settingsData.settings.searchProviders.length > 0 
            ? settingsData.settings.searchProviders 
            : [{ name: "Wiktionary", url: "https://en.wiktionary.org/wiki/{word}" }];
            
        let defaultSearchName = settingsData.settings?.defaultSearch || "Wiktionary";
        let chosenProvider = searchProviders.find(p => p.name === defaultSearchName) || searchProviders[0];
        let defaultSearchUrl = chosenProvider.url.replace('{word}', encodeURIComponent(wordToLookup));

        let examplesHtml = "";
        let isSentenceSaved = false;

        if (wordData.examples && wordData.examples.length > 0) {
            let sentences = wordData.examples.map(ex => {
                if (ex.sentence === currentSentence) isSentenceSaved = true;
                let link = ex.url ? `<a href="${ex.url}" target="_blank" title="Go to source">🔗</a>` : "";
                return `<div>${link}<i>${ex.sentence}</i></div>`;
            }).join('');
            examplesHtml = `<div class="dict-examples">${sentences}</div>`;
        }

        readOnlyPanel = document.createElement('div');
        readOnlyPanel.id = 'my-dictionary-readonly-panel';

        readOnlyPanel.innerHTML = `
            <div class="dict-header">
                <strong>${wordToLookup}</strong>
                <div>
                    <button id="dict-readonly-edit-btn" style="background:none; border:none; color:#66b3ff; cursor:pointer; font-size:16px; margin-right: 8px;" title="Edit Entry">✏️</button>
                    <button id="dict-readonly-close-btn" style="background:none; border:none; color:#aaa; cursor:pointer; font-size:18px;">&times;</button>
                </div>
            </div>
            
            <div style="font-size: 11px; color: #888; text-transform: uppercase; margin-bottom: 5px;">
                Language: ${wordData.language}
            </div>
            
            <div style="margin-top: 5px; margin-bottom: 10px;">
                <a href="${defaultSearchUrl}" target="_blank" style="color: #66b3ff; font-size: 12px; text-decoration: none;">🔍 Search online</a>
            </div>
            
            <p><strong>Definition:</strong><br>${wordData.definition || "<em>No definition saved.</em>"}</p>
            
            ${examplesHtml}
            
            ${!isSentenceSaved && currentSentence ? `
                <button id="dict-add-context-btn" style="margin-top: 10px; background-color: #198754; color: white; border: none; border-radius: 4px; padding: 8px; cursor: pointer; width: 100%; font-weight: bold;">+ Add current sentence</button>
            ` : ''}
        `;

        document.body.appendChild(readOnlyPanel);

        //position math (same as before)
        let panelRect = readOnlyPanel.getBoundingClientRect();
        let scrollX = window.scrollX;
        let scrollY = window.scrollY;
        let maxX = scrollX + window.innerWidth - panelRect.width - 15;
        let maxY = scrollY + window.innerHeight - panelRect.height - 15;
        readOnlyPanel.style.left = Math.max(Math.min(x, maxX), scrollX + 15) + 'px';
        readOnlyPanel.style.top = Math.max(Math.min(y, maxY), scrollY + 15) + 'px';

        //close button
        document.getElementById('dict-readonly-close-btn').addEventListener('click', removeReadOnlyPanel);
        
        //edit button (open edit panel)
        document.getElementById('dict-readonly-edit-btn').addEventListener('click', () => {
            showPanel(x, y, wordToLookup, currentSentence, wordData);
        });

        //add current sentence
        let addContextBtn = document.getElementById('dict-add-context-btn');
        if (addContextBtn) {
            addContextBtn.addEventListener('click', async function() {
                this.textContent = "Saving...";
                await chrome.runtime.sendMessage({
                    action: "saveWord",
                    data: { word: wordToLookup, definition: wordData.definition, language: wordData.language, sentence: currentSentence, weblink: currentUrl }
                });
                //reload with new sentence added
                showReadOnlyPanel(x, y, wordToLookup, currentSentence, currentUrl);
            });
        }

    } catch (error) {
        console.error("Error loading read-only panel:", error);
    }
}

function removeReadOnlyPanel() {
    if (readOnlyPanel) {
        readOnlyPanel.remove();
        readOnlyPanel = null;
    }
}

function getSelectionDetails() {
    let selection = window.getSelection();
    let rawSelection = selection.toString();
    let selectedText = rawSelection.trim();

    if (!selectedText) return null;

    //grab the conteiner of the selected text
    let container = selection.anchorNode.parentElement;
    let closestBlock = container.closest('p, div, article, section, li, td') || container;

    //using Range API to get the exact position of selection in order to grab the correct sentence
    let range = selection.getRangeAt(0);
    let preCaretRange = range.cloneRange();
    preCaretRange.selectNodeContents(closestBlock);
    preCaretRange.setEnd(range.startContainer, range.startOffset);
    
    //pinpoint the exact start of selected text (by getting the lenght of the text before it)
    let startOffset = preCaretRange.toString().length; 
    
    //trim any extra spaces around the selected text
    let trimStart = rawSelection.indexOf(selectedText); 
    
    let exactStart = startOffset + trimStart;
    let exactEnd = exactStart + selectedText.length;

    //we use textContent because it perfectly matches the Range string length
    let fullText = closestBlock.textContent; 

    //validate that the selection is only full words
    let isLetter = /[\p{L}]/u;
    let charBefore = fullText.charAt(exactStart - 1);
    let charAfter = fullText.charAt(exactEnd);
    
    if (charBefore && isLetter.test(charBefore)) return { isValid: false };
    if (charAfter && isLetter.test(charAfter)) return { isValid: false };

    //look backwards to find the start of the sentence
    let leftPart = fullText.substring(0, exactStart);
    let sentenceStart = Math.max(
        leftPart.lastIndexOf('.'),
        leftPart.lastIndexOf('!'),
        leftPart.lastIndexOf('?'),
        leftPart.lastIndexOf('\n')
    );
    sentenceStart = sentenceStart === -1 ? 0 : sentenceStart + 1;

    //look forwards to find the end of the sentence
    let rightPart = fullText.substring(exactEnd);
    let boundaries = [
        rightPart.indexOf('.'),
        rightPart.indexOf('!'),
        rightPart.indexOf('?'),
        rightPart.indexOf('\n')
    ].filter(i => i !== -1);
    
    let rightOffset = boundaries.length > 0 ? Math.min(...boundaries) + 1 : rightPart.length;
    let sentenceEnd = exactEnd + rightOffset;

    //slice the full sentence out of the text
    let sentence = fullText.substring(sentenceStart, sentenceEnd).trim();

    //clean up any extra whitespace in the sentence to avoid saving weird formatting
    sentence = sentence.replace(/\s+/g, ' ');

    return {
        isValid: true,
        word: selectedText,
        sentence: sentence
    };
}

// --- DYNAMIC HIGHLIGHTER (MutationObserver) ---

//variable to store the highlight regex to avoid rebuilding it on every single text node
let cachedHighlightRegex = null;

//initialization function to build the regex dictionary in memory and start the observer once at page load
async function initializeHighlighter() {
    try {
        let data = await chrome.storage.local.get(null);
        let settings = data.settings || { languages: [] };
        
        //filter out languages with highlighting turned OFF in settings
        let disabledLangs = settings.languages.filter(l => !l.highlight).map(l => l.code);
        
        //get all saved words ignoring the "settings" key and any words in disabled languages
        let savedWords = Object.keys(data).filter(key => {
            if (key === "settings") return false; // THE FIX: Ignore the word 'settings'
            if (disabledLangs.includes(data[key].language)) return false; 
            return true;
        });
        
        if (savedWords.length === 0) return;

        let escapedWords = savedWords.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
        cachedHighlightRegex = new RegExp(`(?<!\\p{L})(${escapedWords.join('|')})(?!\\p{L})`, 'gui');

        //highlight all existing words on the page immediately
        highlightNode(document.body);

        //start watching for any new nodes being added to the page (infinite scroll, dynamic content, etc)
        startMutationObserver();
    } catch (error) {
        console.error("Dictionary Init Error:", error);
    }
}

//refresh the highlighter regex after any changes in the dictionary
async function refreshHighlighter() {
    let data = await chrome.storage.local.get(null);
    let settings = data.settings || { languages: [] };
    
    //skip disabled languages
    let disabledLangs = settings.languages.filter(l => !l.highlight).map(l => l.code);
    
    //fetch all enabled saved words (ignoring settings key)
    let savedWords = Object.keys(data).filter(key => {
        if (key === "settings") return false; // Don't try to highlight the word "settings"
        if (disabledLangs.includes(data[key].language)) return false; 
        return true;
    });
    
    if (savedWords.length === 0) {
        cachedHighlightRegex = null;
        return;
    }

    let escapedWords = savedWords.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    cachedHighlightRegex = new RegExp(`(?<!\\p{L})(${escapedWords.join('|')})(?!\\p{L})`, 'gui');
}

//highlight function to highlight all occurrences of saved words in a given DOM node
function highlightNode(targetNode) {
    if (!cachedHighlightRegex) return; //return if no words to highlight

    let walker = document.createTreeWalker(
        targetNode,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode: function(node) {
            let parent = node.parentNode;
            if (!parent) return NodeFilter.FILTER_REJECT;
            
            let tag = parent.tagName;
            //ignore scripts, inputs, and ALL of our injected UI panels
            if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT' || 
                tag === 'TEXTAREA' || tag === 'INPUT' || 
                parent.classList.contains('my-dictionary-highlight') ||
                parent.closest('#my-dictionary-panel') ||
                parent.closest('#my-dictionary-readonly-panel')) {
                return NodeFilter.FILTER_REJECT;
            }
            return NodeFilter.FILTER_ACCEPT;
        }
        }
    );

    let nodesToReplace = [];
    let node;
    while ((node = walker.nextNode())) {
        cachedHighlightRegex.lastIndex = 0; 
        if (cachedHighlightRegex.test(node.nodeValue)) {
            nodesToReplace.push(node);
        }
    }

    nodesToReplace.forEach(node => {
        let parent = node.parentNode;
        if (!parent) return; 
        
        let fragment = document.createDocumentFragment();
        let lastIndex = 0;
        
        cachedHighlightRegex.lastIndex = 0;
        let match;
        
        while ((match = cachedHighlightRegex.exec(node.nodeValue)) !== null) {
            let beforeText = node.nodeValue.substring(lastIndex, match.index);
            if (beforeText) {
                fragment.appendChild(document.createTextNode(beforeText));
            }
            
            let highlightSpan = document.createElement('span');
            highlightSpan.className = 'my-dictionary-highlight';
            highlightSpan.textContent = match[0];
            
            //show a tooltip on hover to indicate that this word is saved in the dictionary
            highlightSpan.title = "Saved in your dictionary!"; 
            
            fragment.appendChild(highlightSpan);
            
            lastIndex = cachedHighlightRegex.lastIndex;
        }
        
        let afterText = node.nodeValue.substring(lastIndex);
        if (afterText) {
            fragment.appendChild(document.createTextNode(afterText));
        }
        
        parent.replaceChild(fragment, node);
    });
}

//observer that watches for any new nodes being added to the page and highlights them if they contain saved words
function startMutationObserver() {
    let observer = new MutationObserver((mutations) => {
        for (let mutation of mutations) {
            //only look at added nodes
            if (mutation.addedNodes.length > 0) {
                mutation.addedNodes.forEach(node => {
                    //only process actual HTML elements
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        //prevent an infinite loop by ignoring all our own injected UI
                        if (node.id === 'my-dictionary-panel' || 
                            node.id === 'my-dictionary-floating-icon' ||
                            node.id === 'my-dictionary-readonly-panel') {
                            return; 
                        }
                        
                        highlightNode(node);
                    }
                    //sometimes websites inject raw text nodes
                    else if (node.nodeType === Node.TEXT_NODE && node.parentNode) {
                        highlightNode(node.parentNode);
                    }
                });
            }
        }
    });

    //tell the observer to watch the whole body and all its children
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
}

initializeHighlighter();