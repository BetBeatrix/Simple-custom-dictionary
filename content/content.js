// A variable to keep track of our floating icon so we can easily remove it
let floatingIcon = null;

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

// 2. Hide the icon/panel if they click anywhere else on the page
document.addEventListener('mousedown', function(event) {
    // THE FIX: If they are clicking down ON the icon, don't remove it!
    if (event.target.id === 'my-dictionary-floating-icon' || event.target.closest('#my-dictionary-panel')) {
        return; 
    }
    
    // Otherwise, they clicked somewhere random, so clear the icon/panel
    removeIcon();
    removePanel();
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

function showPanel(x, y, selectedText, contextSentence) {
    removeIcon(); 
    removePanel();

    
    let boldedSentence = "";
    if (contextSentence) {
        let escapedWord = selectedText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        let highlightRegex = new RegExp(`(?<!\\p{L})(${escapedWord})(?!\\p{L})`, 'gui');
        boldedSentence = contextSentence.replace(highlightRegex, '<strong>$1</strong>');
    }

    floatingPanel = document.createElement('div');
    floatingPanel.id = 'my-dictionary-panel';

    floatingPanel.innerHTML = `
        <div class="dict-header">
            <strong>Add to Dictionary</strong>
            <button id="dict-close-btn">&times;</button>
        </div>
        
        <label for="dict-word">Word:</label>
        <input type="text" id="dict-word" value="${selectedText}">
        
        <label for="dict-def">Definition:</label>
        <textarea id="dict-def" placeholder="Type definition here..."></textarea>
        <a href="https://en.wiktionary.org/wiki/${selectedText}" target="_blank">Search online</a>
        
        <label for="dict-lang">Language:</label>
        <select id="dict-lang">
            <option value="en">English</option>
            <option value="es">Spanish</option>
            <option value="fr">French</option>
            <option value="pl">Polish</option>
        </select>

        <div style="display: flex; align-items: center; gap: 8px; margin-top: 5px;">
            <input type="checkbox" id="context-sentence-checkbox" name="context-sentence" value="yes">
            <label for="context-sentence-checkbox" style="margin-bottom: 0;">Add a context sentence?</label>
        </div>
        
        <div id="context-sentence" style="display: none;">${boldedSentence}</div>
        
        <button id="dict-save-btn">Save Word</button>
    `;

    document.body.appendChild(floatingPanel);

    // --- NEW: Dragging Logic ---
    let header = floatingPanel.querySelector('.dict-header');
    
    header.addEventListener('mousedown', function(e) {
        // Guard clause: Don't start dragging if they clicked the 'X' close button!
        if (e.target.id === 'dict-close-btn') return;

        // Get the starting mouse coordinates
        let startX = e.clientX;
        let startY = e.clientY;
        
        // Get the starting panel coordinates
        let startLeft = parseInt(floatingPanel.style.left, 10);
        let startTop = parseInt(floatingPanel.style.top, 10);

        // The function that actually moves the panel
        function dragMove(e) {
            let dx = e.clientX - startX;
            let dy = e.clientY - startY;
            floatingPanel.style.left = (startLeft + dx) + 'px';
            floatingPanel.style.top = (startTop + dy) + 'px';
        }

        // The function that stops the drag
        function dragEnd() {
            document.removeEventListener('mousemove', dragMove);
            document.removeEventListener('mouseup', dragEnd);
        }

        // Attach the move and end listeners to the whole document
        document.addEventListener('mousemove', dragMove);
        document.addEventListener('mouseup', dragEnd);
    });
    // --- END Dragging Logic ---

    // 2. Measure the panel and the browser window
    let panelRect = floatingPanel.getBoundingClientRect();
    let viewportWidth = window.innerWidth;
    let viewportHeight = window.innerHeight;
    
    // Account for how far down/right the user has scrolled
    let scrollX = window.scrollX;
    let scrollY = window.scrollY;

    // 3. Calculate maximum allowed coordinates (leaving a 15px safety margin from the edges)
    let maxX = scrollX + viewportWidth - panelRect.width - 15;
    let maxY = scrollY + viewportHeight - panelRect.height - 15;

    // 4. Adjust X and Y if they go past the maximums
    let finalX = Math.min(x, maxX);
    let finalY = Math.min(y, maxY);

    // 5. Ensure it also doesn't bleed off the top or left edges
    finalX = Math.max(finalX, scrollX + 15);
    finalY = Math.max(finalY, scrollY + 15);

    // 6. Finally, apply the safe coordinates to the panel
    floatingPanel.style.left = finalX + 'px';
    floatingPanel.style.top = finalY + 'px';

    // Toggle the display style instead of creating/destroying elements
    document.getElementById('context-sentence-checkbox').addEventListener('change', function() {
        let contextDiv = document.getElementById('context-sentence');
        if (this.checked) {
            contextDiv.style.display = 'block';
        } else {
            contextDiv.style.display = 'none';
        }
    });

    document.getElementById('dict-close-btn').addEventListener('click', removePanel);
    
    document.getElementById('dict-save-btn').addEventListener('click', function() {
        let finalWord = document.getElementById('dict-word').value;
        let finalDef = document.getElementById('dict-def').value;
        let finalLang = document.getElementById('dict-lang').value;
        
        console.log(`Ready to save! Word: ${finalWord}, Def: ${finalDef}, Lang: ${finalLang}`);
        
        removePanel();
    });
}

function removePanel() {
    if (floatingPanel) {
        floatingPanel.remove();
        floatingPanel = null;
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