chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "saveWord") {
        saveWordToDatabase(request.data).then(() => sendResponse({ status: "success" }));
        return true; 
    }
    
    if (request.action === "deleteWord") {
        chrome.storage.local.remove(request.data.word).then(() => sendResponse({ status: "success" }));
        return true;
    }
    
    if (request.action === "deleteSentence") {
        chrome.storage.local.get(request.data.word).then(result => {
            let wordData = result[request.data.word];
            if (wordData) {
                //find the the exact sentence they want to delete and filter it out
                wordData.examples = wordData.examples.filter(ex => ex.sentence !== request.data.sentence);
                chrome.storage.local.set({ [request.data.word]: wordData }).then(() => sendResponse({ status: "success" }));
            }
        });
        return true;
    }
});

async function saveWordToDatabase(data) {
    let { word, definition, language, sentence, weblink } = data; 
    
    try {
        let result = await chrome.storage.local.get(word);
        let wordData = result[word] || { 
            examples: [], 
            timestamp: Date.now() //timestamp to be able to sort by recently added
        };

        //update the definition and language
        wordData.definition = definition;
        wordData.language = language; 
        
        if (sentence) {
            let sentenceAlreadyExists = wordData.examples.some(ex => ex.sentence === sentence);
            if (!sentenceAlreadyExists) {
                wordData.examples.push({ url: weblink, sentence: sentence });
            }
        }

        await chrome.storage.local.set({ [word]: wordData });
    } catch (error) {
        console.error("Backend storage error:", error);
    }
}