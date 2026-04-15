// A variable to keep track of our floating icon so we can easily remove it
let floatingIcon = null;

let readOnlyPanel = null;

// 1. Listen for the user to finish dragging/highlighting
document.addEventListener('mouseup', function(event) {
    if (event.target.id === 'my-dictionary-floating-icon' || event.target.closest('#my-dictionary-panel')) {
        return; 
    }

    // Get the text they highlighted and remove extra spaces
    let selectedTextJson = getSelectionDetails();
    

    // If they actually selected a word (not just clicked randomly)
    if (selectedTextJson && selectedTextJson.isValid) {
        let selectedText = selectedTextJson.word;
        let contextSentence = selectedTextJson.sentence;
        showIcon(event.pageX, event.pageY, selectedText, contextSentence);
    }
});

// 2. Hide the icon/panels if they click anywhere else on the page
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


// 3. Listen for clicks on our highlighted words
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
    // Remove any existing icon first just in case
    removeIcon();

    // Create a new image element
    floatingIcon = document.createElement('img');
    floatingIcon.id = 'my-dictionary-floating-icon';
    
    // NOTE: You must use browser.runtime.getURL to get the correct path 
    // for an image stored inside your extension folder!
    floatingIcon.src = browser.runtime.getURL('/icons/save.png'); 

    // Position it slightly below and to the right of the cursor
    floatingIcon.style.left = (x + 5) + 'px';
    floatingIcon.style.top = (y + 10) + 'px';

    // Add it to the webpage
    document.body.appendChild(floatingIcon);

    // Make the icon clickable!
    floatingIcon.addEventListener('click', function() {
        console.log("You clicked the icon! The word is:", text);
        showPanel(x + 5, y + 10, text, contextSentence); // Pass the selected text and context sentence to the panel
        
        // Remove the icon after clicking
        removeIcon(); 
    });
}

function removeIcon() {
    if (floatingIcon) {
        floatingIcon.remove();
        floatingIcon = null;
    }
}

// Add a variable to track the panel just like we did with the icon
let floatingPanel = null;

// Notice the new 'existingData' parameter
function showPanel(x, y, selectedText, contextSentence, existingData = null) {
    removeIcon(); 
    removePanel();
    removeReadOnlyPanel(); // Ensure the read-only one closes!

    let boldedSentence = "";
    if (contextSentence) {
        let escapedWord = selectedText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        let highlightRegex = new RegExp(`(?<!\\p{L})(${escapedWord})(?!\\p{L})`, 'gui');
        boldedSentence = contextSentence.replace(highlightRegex, '<strong>$1</strong>');
    }

    floatingPanel = document.createElement('div');
    floatingPanel.id = 'my-dictionary-panel';
    
    // Set up existing values if we are in Edit Mode
    let currentDef = existingData ? existingData.definition : "";
    let currentLang = existingData ? existingData.language : "en";
    
    // Build the editable sentences list with trash cans
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
        <a href="https://en.wiktionary.org/wiki/${selectedText}" target="_blank">Search online</a>
        
        <label for="dict-lang">Language:</label>
        <select id="dict-lang">
            <option value="fr" ${currentLang === 'fr' ? 'selected' : ''}>French</option>
            <option value="en" ${currentLang === 'en' ? 'selected' : ''}>English</option>
            <option value="es" ${currentLang === 'es' ? 'selected' : ''}>Spanish</option>
            <option value="pl" ${currentLang === 'pl' ? 'selected' : ''}>Polish</option>
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

    // Position math
    let panelRect = floatingPanel.getBoundingClientRect();
    let scrollX = window.scrollX;
    let scrollY = window.scrollY;
    let maxX = scrollX + window.innerWidth - panelRect.width - 15;
    let maxY = scrollY + window.innerHeight - panelRect.height - 15;
    floatingPanel.style.left = Math.max(Math.min(x, maxX), scrollX + 15) + 'px';
    floatingPanel.style.top = Math.max(Math.min(y, maxY), scrollY + 15) + 'px';

    // Dragging Logic
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

    // Checkbox toggle
    document.getElementById('context-sentence-checkbox').addEventListener('change', function() {
        document.getElementById('context-sentence').style.display = this.checked ? 'block' : 'none';
    });

    // Close button
    document.getElementById('dict-close-btn').addEventListener('click', removePanel);
    
    // DELETE SENTENCE listeners
    document.querySelectorAll('.dict-delete-sentence-btn').forEach(btn => {
        btn.addEventListener('click', async function() {
            let sentenceToDelete = this.getAttribute('data-sentence');
            this.parentElement.style.opacity = "0.5"; // Visual feedback
            
            await browser.runtime.sendMessage({
                action: "deleteSentence",
                data: { word: selectedText, sentence: sentenceToDelete }
            });
            this.parentElement.remove(); // Remove it from the UI permanently
        });
    });

    // DELETE ENTIRE WORD listener
    let deleteWordBtn = document.getElementById('dict-delete-word-btn');
    if (deleteWordBtn) {
        deleteWordBtn.addEventListener('click', async function() {
            let isSure = window.confirm(`Are you sure you want to completely delete "${selectedText}"? This cannot be undone.`);
            if (!isSure) return; 
            
            this.textContent = "Deleting...";
            await browser.runtime.sendMessage({ action: "deleteWord", data: { word: selectedText } });
            
            // THE FIX: Update memory before changing the page
            await refreshHighlighter();
            
            // Now safely remove the highlights
            document.querySelectorAll('.my-dictionary-highlight').forEach(span => {
                if (span.textContent.toLowerCase() === selectedText.toLowerCase()) {
                    span.outerHTML = span.innerHTML; 
                }
            });
            
            removePanel();
        });
    }

    // SAVE listener
    document.getElementById('dict-save-btn').addEventListener('click', async function() {
        let finalDef = document.getElementById('dict-def').value.trim();
        let finalLang = document.getElementById('dict-lang').value;
        let finalSentence = document.getElementById('context-sentence-checkbox').checked ? contextSentence : null;
        let currentUrl = window.location.href; 
        
        this.textContent = "Saving...";
        this.style.backgroundColor = "#28a745"; 
        
        try {
            await browser.runtime.sendMessage({
                action: "saveWord",
                data: { word: selectedText, definition: finalDef, language: finalLang, sentence: finalSentence, weblink: currentUrl }
            });
            
            // UX BONUS: Update memory and immediately highlight the new word on the current page!
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
        let result = await browser.storage.local.get(wordToLookup);
        let wordData = result[wordToLookup];
        if (!wordData) return;

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
            
            <p><strong>Definition:</strong><br>${wordData.definition || "<em>No definition saved.</em>"}</p>
            
            ${examplesHtml}
            
            ${!isSentenceSaved && currentSentence ? `
                <button id="dict-add-context-btn" style="margin-top: 10px; background-color: #198754; color: white; border: none; border-radius: 4px; padding: 8px; cursor: pointer; width: 100%; font-weight: bold;">+ Add current sentence</button>
            ` : ''}
        `;

        document.body.appendChild(readOnlyPanel);

        // Position math (same as before)
        let panelRect = readOnlyPanel.getBoundingClientRect();
        let scrollX = window.scrollX;
        let scrollY = window.scrollY;
        let maxX = scrollX + window.innerWidth - panelRect.width - 15;
        let maxY = scrollY + window.innerHeight - panelRect.height - 15;
        readOnlyPanel.style.left = Math.max(Math.min(x, maxX), scrollX + 15) + 'px';
        readOnlyPanel.style.top = Math.max(Math.min(y, maxY), scrollY + 15) + 'px';

        // Listeners
        document.getElementById('dict-readonly-close-btn').addEventListener('click', removeReadOnlyPanel);
        
        // OPEN EDIT PANEL
        document.getElementById('dict-readonly-edit-btn').addEventListener('click', () => {
            showPanel(x, y, wordToLookup, currentSentence, wordData);
        });

        // ADD CURRENT SENTENCE
        let addContextBtn = document.getElementById('dict-add-context-btn');
        if (addContextBtn) {
            addContextBtn.addEventListener('click', async function() {
                this.textContent = "Saving...";
                await browser.runtime.sendMessage({
                    action: "saveWord",
                    data: { word: wordToLookup, definition: wordData.definition, language: wordData.language, sentence: currentSentence, weblink: currentUrl }
                });
                // Reload the read-only panel to show the new sentence
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


async function fetchLanguages() {
    //try {};
}

function getSelectionDetails() {
    let selection = window.getSelection();
    let rawSelection = selection.toString();
    let selectedText = rawSelection.trim();

    if (!selectedText) return null;

    // 1. Get the container holding our text (safest to grab a block element like a paragraph)
    let container = selection.anchorNode.parentElement;
    let closestBlock = container.closest('p, div, article, section, li, td') || container;

    // 2. Figure out the EXACT character position of the highlight using the Range API
    let range = selection.getRangeAt(0);
    let preCaretRange = range.cloneRange();
    preCaretRange.selectNodeContents(closestBlock);
    preCaretRange.setEnd(range.startContainer, range.startOffset);
    
    // This tells us exactly how many characters are before the highlight
    let startOffset = preCaretRange.toString().length; 
    
    // Account for any spaces the user accidentally highlighted before the word
    let trimStart = rawSelection.indexOf(selectedText); 
    
    let exactStart = startOffset + trimStart;
    let exactEnd = exactStart + selectedText.length;

    // We use textContent because it perfectly matches the Range string length
    let fullText = closestBlock.textContent; 

    // 3. Validate word boundaries (make sure they didn't highlight half a word)
    let isLetter = /[\p{L}]/u;
    let charBefore = fullText.charAt(exactStart - 1);
    let charAfter = fullText.charAt(exactEnd);
    
    if (charBefore && isLetter.test(charBefore)) return { isValid: false };
    if (charAfter && isLetter.test(charAfter)) return { isValid: false };

    // 4. Look backwards from our exact word to find the start of the sentence
    let leftPart = fullText.substring(0, exactStart);
    let sentenceStart = Math.max(
        leftPart.lastIndexOf('.'),
        leftPart.lastIndexOf('!'),
        leftPart.lastIndexOf('?'),
        leftPart.lastIndexOf('\n')
    );
    // Move one character past the punctuation mark (or stay at 0 if no punctuation)
    sentenceStart = sentenceStart === -1 ? 0 : sentenceStart + 1;

    // 5. Look forwards from our exact word to find the end of the sentence
    let rightPart = fullText.substring(exactEnd);
    let boundaries = [
        rightPart.indexOf('.'),
        rightPart.indexOf('!'),
        rightPart.indexOf('?'),
        rightPart.indexOf('\n')
    ].filter(i => i !== -1);
    
    // Find the closest punctuation mark, +1 to include the punctuation in the sentence
    let rightOffset = boundaries.length > 0 ? Math.min(...boundaries) + 1 : rightPart.length;
    let sentenceEnd = exactEnd + rightOffset;

    // 6. Slice out the perfect sentence based on those coordinates!
    let sentence = fullText.substring(sentenceStart, sentenceEnd).trim();

    // Clean up weird invisible formatting (like multiple spaces/newlines inside the HTML)
    sentence = sentence.replace(/\s+/g, ' ');

    return {
        isValid: true,
        word: selectedText,
        sentence: sentence
    };
}

// --- DYNAMIC HIGHLIGHTER (MutationObserver) ---

// 1. A global variable to store our regex in memory
let cachedHighlightRegex = null;

// 2. The initialization function that runs ONCE when the page loads
async function initializeHighlighter() {
    try {
        let data = await browser.storage.local.get(null);
        let savedWords = Object.keys(data);
        
        if (savedWords.length === 0) return;

        let escapedWords = savedWords.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
        cachedHighlightRegex = new RegExp(`(?<!\\p{L})(${escapedWords.join('|')})(?!\\p{L})`, 'gui');

        // Highlight the initial page content
        highlightNode(document.body);

        // Start watching for new content
        startMutationObserver();
    } catch (error) {
        console.error("Dictionary Init Error:", error);
    }
}

// --- NEW: Refreshes the regex dictionary in memory ---
async function refreshHighlighter() {
    let data = await browser.storage.local.get(null);
    let savedWords = Object.keys(data);
    
    if (savedWords.length === 0) {
        cachedHighlightRegex = null;
        return;
    }

    let escapedWords = savedWords.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    cachedHighlightRegex = new RegExp(`(?<!\\p{L})(${escapedWords.join('|')})(?!\\p{L})`, 'gui');
}

// 3. The reusable TreeWalker function (now accepts a specific root node)
function highlightNode(targetNode) {
    if (!cachedHighlightRegex) return; // Bail if we have no words to find

    let walker = document.createTreeWalker(
        targetNode,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode: function(node) {
            let parent = node.parentNode;
            if (!parent) return NodeFilter.FILTER_REJECT;
            
            let tag = parent.tagName;
            // Ignore scripts, inputs, and ALL of our injected UI panels
            if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT' || 
                tag === 'TEXTAREA' || tag === 'INPUT' || 
                parent.classList.contains('my-dictionary-highlight') ||
                parent.closest('#my-dictionary-panel') ||
                parent.closest('#my-dictionary-readonly-panel')) { // <-- ADDED THIS LINE
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
            
            // Optional UX Touch: Show the word in a tooltip when they hover over it
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

// 4. The Observer that watches for infinite scrolling
function startMutationObserver() {
    let observer = new MutationObserver((mutations) => {
        for (let mutation of mutations) {
            // We only care about new nodes being added to the screen
            if (mutation.addedNodes.length > 0) {
                mutation.addedNodes.forEach(node => {
                    // Only process actual HTML elements
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        // Prevent an infinite loop by ignoring all our own injected UI
                        if (node.id === 'my-dictionary-panel' || 
                            node.id === 'my-dictionary-floating-icon' ||
                            node.id === 'my-dictionary-readonly-panel') { // <-- ADDED THIS LINE
                            return; 
                        }
                        
                        highlightNode(node);
                    }
                    // Sometimes websites inject raw text nodes
                    else if (node.nodeType === Node.TEXT_NODE && node.parentNode) {
                        highlightNode(node.parentNode);
                    }
                });
            }
        }
    });

    // Tell the observer to watch the whole body and all its children
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
}

// Kick off the whole process!
initializeHighlighter();