browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "saveWord") {
        saveWordToDatabase(request.data).then(() => sendResponse({ status: "success" }));
        return true; 
    }
    
    // NEW: Delete an entire word
    if (request.action === "deleteWord") {
        browser.storage.local.remove(request.data.word).then(() => sendResponse({ status: "success" }));
        return true;
    }
    
    // NEW: Delete a specific sentence from a word
    if (request.action === "deleteSentence") {
        browser.storage.local.get(request.data.word).then(result => {
            let wordData = result[request.data.word];
            if (wordData) {
                // Filter out the exact sentence they want to delete
                wordData.examples = wordData.examples.filter(ex => ex.sentence !== request.data.sentence);
                browser.storage.local.set({ [request.data.word]: wordData }).then(() => sendResponse({ status: "success" }));
            }
        });
        return true;
    }
});

async function saveWordToDatabase(data) {
    let { word, definition, language, sentence, weblink } = data; 
    
    try {
        let result = await browser.storage.local.get(word);
        let wordData = result[word] || { examples: [] };

        // Force update the definition and language to whatever the edit panel sends
        wordData.definition = definition;
        wordData.language = language; 
        
        if (sentence) {
            let sentenceAlreadyExists = wordData.examples.some(ex => ex.sentence === sentence);
            if (!sentenceAlreadyExists) {
                wordData.examples.push({ url: weblink, sentence: sentence });
            }
        }

        await browser.storage.local.set({ [word]: wordData });
    } catch (error) {
        console.error("Backend storage error:", error);
    }
}