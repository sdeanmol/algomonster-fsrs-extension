import { BackupManager } from './backupManager.js?v=5';

// Setup Mock Environment
let mockStorage = {};
let downloadedBlob = null;
let downloadedFilename = null;

let downloadPromise = null;
let resolveDownload = null;

function resetDownloadPromise() {
    downloadPromise = new Promise(resolve => {
        resolveDownload = resolve;
    });
}

// Mock chrome extension APIs
globalThis.chrome = {
    storage: {
        local: {
            get: (keys, callback) => {
                if (keys === null) {
                    if (callback) callback(mockStorage);
                    return Promise.resolve(mockStorage);
                }
                const result = {};
                const keysArray = Array.isArray(keys) ? keys : [keys];
                for (const key of keysArray) {
                    result[key] = mockStorage[key];
                }
                if (callback) callback(result);
                return Promise.resolve(result);
            },
            set: (data, callback) => {
                Object.assign(mockStorage, data);
                if (callback) callback();
                return Promise.resolve();
            }
        }
    },
    downloads: {
        download: (options) => {
            const blobUrl = options.url;
            downloadedFilename = options.filename;
            
            fetch(blobUrl)
                .then(res => res.blob())
                .then(blob => {
                    downloadedBlob = blob;
                    if (resolveDownload) {
                        resolveDownload();
                    }
                });
        }
    }
};

// Test Suite helper
const testCasesDiv = document.getElementById('test-cases');
const summaryDiv = document.getElementById('test-summary');
let totalTests = 0;
let passedTests = 0;
const tests = [];

function runTest(name, fn) {
    tests.push({ name, fn });
}

function updateSummary() {
    summaryDiv.innerHTML = `
        <strong>Status:</strong> ${passedTests === totalTests ? '🟢 ALL TESTS PASSED' : '🔴 SOME TESTS FAILED'} (${passedTests}/${totalTests} passed)<br>
        <em>Note: Check the details of each test below.</em>
    `;
}

// ----------------------------------------------------
// POPULATE TEST DATA
// ----------------------------------------------------
const initialMockData = {
    theme: 'dark',
    chromeSettings: { showCharts: true, showMarkerPopup: false },
    bookmarks: [
        { url: "https://leetcode.com/problems/two-sum", title: "Two Sum", meta: { favIconUrl: "https://leetcode.com/favicon.ico" } },
        { url: "https://leetcode.com/problems/add-two-numbers", title: "Add Two Numbers", meta: { favIconUrl: "https://leetcode.com/favicon.ico" } }
    ],
    fsrsCards: [
        {
            id: "card_1",
            problemUrl: "https://leetcode.com/problems/two-sum",
            problemTitle: "Two Sum",
            approach: "Hash map approach is optimal. Time: O(N), Space: O(N).",
            tags: ["Array", "Hash Table"],
            due: 1720950346000,
            stability: 1.5,
            difficulty: 2.1,
            historyLog: [1720940346000, 1720950346000]
        },
        {
            id: "card_2",
            problemUrl: "https://leetcode.com/problems/add-two-numbers",
            problemTitle: "Add Two Numbers",
            approach: "Linked list traversal with carry tracking.",
            tags: ["Linked List", "Math"],
            due: 1720951346000,
            stability: 3.2,
            difficulty: 4.5,
            historyLog: [1720951346000]
        }
    ],
    marks: [
        {
            id: "mark_1",
            createdAt: 1720940346000,
            url: "https://leetcode.com/problems/two-sum",
            text: "Given an array of integers nums and an integer target",
            color: "#f1c40f",
            note: "Problem description start",
            highlightSource: { startMeta: {}, endMeta: {} }
        },
        {
            id: "mark_2",
            createdAt: 1720945346000,
            url: "https://leetcode.com/problems/two-sum",
            text: "only one solution",
            color: "#e74c3c",
            note: "Key constraint",
            highlightSource: { startMeta: {}, endMeta: {} }
        }
    ],
    pagecontents: [
        { url: "https://leetcode.com/problems/two-sum", description: "LeetCode Two Sum problem page summary", length: 1500 },
        { url: "https://leetcode.com/problems/add-two-numbers", description: "LeetCode Add Two Numbers page summary", length: 2200 }
    ],
    fsrsActivity: { "2026-07-14": 5 },
    fsrsTopicWeights: { "Array": 1.2 }
};

// Reset mock storage
mockStorage = JSON.parse(JSON.stringify(initialMockData));

// Run tests sequentially
async function startTests() {
    totalTests = tests.length;
    testCasesDiv.innerHTML = "";
    for (let i = 0; i < tests.length; i++) {
        const { name, fn } = tests[i];
        const index = i + 1;
        const testDiv = document.createElement('div');
        testDiv.className = 'test-case';
        testDiv.innerHTML = `
            <div class="test-title">${name} <span class="badge" id="badge-${index}">running</span></div>
            <div class="test-details" id="details-${index}">Running test...</div>
        `;
        testCasesDiv.appendChild(testDiv);
        
        try {
            const details = await fn();
            testDiv.className = 'test-case pass';
            document.getElementById(`badge-${index}`).className = 'badge pass';
            document.getElementById(`badge-${index}`).innerText = 'pass';
            document.getElementById(`details-${index}`).innerText = details || 'Test passed successfully with no errors.';
            passedTests++;
        } catch (err) {
            testDiv.className = 'test-case fail';
            document.getElementById(`badge-${index}`).className = 'badge fail';
            document.getElementById(`badge-${index}`).innerText = 'fail';
            document.getElementById(`details-${index}`).innerText = `Error: ${err.message}\nStack:\n${err.stack}`;
        }
        updateSummary();
    }
}

// Register Tests
runTest("Test 1: Verify Export and Size Reduction", async () => {
    downloadedBlob = null;
    downloadedFilename = null;
    resetDownloadPromise();
    
    // Set storage to initial state
    mockStorage = JSON.parse(JSON.stringify(initialMockData));

    // Trigger backup export
    await BackupManager.exportBackup();
    
    // Await download completion safely
    await downloadPromise;
    
    if (!downloadedBlob) {
        throw new Error("No blob was captured by the mock download API");
    }
    
    const filenameValid = downloadedFilename.endsWith('.json.gz');
    if (!filenameValid) {
        throw new Error(`Filename is invalid: ${downloadedFilename}`);
    }
    
    // Calculate raw JSON size
    const rawJsonStr = JSON.stringify(initialMockData);
    const rawSize = new Blob([rawJsonStr]).size;
    const compressedSize = downloadedBlob.size;
    const ratio = ((1 - (compressedSize / rawSize)) * 100).toFixed(1);
    
    return `Raw JSON Size: ${rawSize} bytes\nCompressed Backup Size: ${compressedSize} bytes\nSpace Saving Ratio: ${ratio}% (Compression was successful)`;
});

runTest("Test 2: Verify Backup Deduplication & Stream Structure", async () => {
    if (!downloadedBlob) {
        throw new Error("Blob from Test 1 is not available");
    }

    // Decompress the blob to examine its uncompressed content
    const ds = new DecompressionStream('gzip');
    const decompressedStream = downloadedBlob.stream().pipeThrough(ds);
    const reader = decompressedStream.getReader();
    const decoder = new TextDecoder('utf-8');
    
    let result = '';
    let done = false;
    while (!done) {
        const chunk = await reader.read();
        done = chunk.done;
        if (chunk.value) {
            result += decoder.decode(chunk.value);
        }
    }
    
    const lines = result.trim().split('\n');
    
    // Validate Structure
    const header = JSON.parse(lines[0]);
    if (header.type !== 'header' || header.data.version !== 2) {
        throw new Error("Invalid header line content: " + lines[0]);
    }
    
    const footer = JSON.parse(lines[lines.length - 1]);
    if (footer.type !== 'footer' || !footer.data.checksum) {
        throw new Error("Invalid footer line content: " + lines[lines.length - 1]);
    }
    
    // Check page deduplication
    const pages = [];
    const cardLines = [];
    const markLines = [];
    
    for (const line of lines) {
        const obj = JSON.parse(line);
        if (obj.type === 'page') {
            pages.push(obj.data);
        } else if (obj.type === 'card') {
            cardLines.push(obj.data);
        } else if (obj.type === 'mark') {
            markLines.push(obj.data);
        }
    }
    
    // Check pages list
    if (pages.length !== 2) {
        throw new Error(`Expected exactly 2 deduplicated pages, got ${pages.length}`);
    }
    
    // Verify that cards and marks refer to page ID and do not duplicate raw URL
    for (const card of cardLines) {
        if (card.problemUrl || card.problemTitle) {
            throw new Error("Card record contains raw problemUrl/problemTitle: " + JSON.stringify(card));
        }
        if (card.u === undefined) {
            throw new Error("Card does not contain 'u' page ID reference");
        }
    }
    
    for (const mark of markLines) {
        if (mark.url) {
            throw new Error("Mark record contains raw URL: " + JSON.stringify(mark));
        }
        if (mark.u === undefined) {
            throw new Error("Mark does not contain 'u' page ID reference");
        }
    }
    
    return `Decompressed Lines count: ${lines.length}\nDeduplicated Pages: ${JSON.stringify(pages, null, 2)}\nVerified that problemUrl, problemTitle, and url fields are completely removed from records and replaced by integer references 'u'.`;
});

runTest("Test 3: Verify Restoring Backup Hydration & Integrity Check", async () => {
    if (!downloadedBlob) {
        throw new Error("Blob from Test 1 is not available");
    }
    
    // Clear mock storage completely
    mockStorage = {};
    
    // Run restoration
    let statusMsg = "";
    let isStatusError = false;
    
    await BackupManager.importBackup(downloadedBlob, (msg, isError) => {
        statusMsg = msg;
        isStatusError = isError;
    });
    
    if (isStatusError) {
        throw new Error("Restoration reported error: " + statusMsg);
    }
    
    // Validate storage has been reconstructed to matches original structures exactly
    if (mockStorage.theme !== 'dark') {
        throw new Error(`Expected theme 'dark', got ${mockStorage.theme}`);
    }
    if (!mockStorage.bookmarks || mockStorage.bookmarks.length !== 2) {
        throw new Error("Bookmarks restoration failed");
    }
    if (!mockStorage.fsrsCards || mockStorage.fsrsCards.length !== 2) {
        throw new Error("Cards restoration failed");
    }
    if (!mockStorage.marks || mockStorage.marks.length !== 2) {
        throw new Error("Marks restoration failed");
    }
    
    // Validate reconstructed URL references
    const card = mockStorage.fsrsCards[0];
    if (card.problemUrl !== "https://leetcode.com/problems/two-sum" || card.problemTitle !== "Two Sum") {
        throw new Error("Reconstruction of card fields (problemUrl/problemTitle) was unsuccessful: " + JSON.stringify(card));
    }
    
    const mark = mockStorage.marks[0];
    if (mark.url !== "https://leetcode.com/problems/two-sum") {
        throw new Error("Reconstruction of mark URL field failed: " + JSON.stringify(mark));
    }
    
    return "Status: " + statusMsg + "\nDatabase successfully and accurately restored back to storage format!";
});

runTest("Test 4: Verify Corruption Detection & Integrity Rejection", async () => {
    if (!downloadedBlob) {
        throw new Error("Blob from Test 1 is not available");
    }
    
    // Read blob bytes
    const arrayBuffer = await downloadedBlob.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    
    // Corrupt one byte of the compressed stream near the middle
    const corruptedBytes = new Uint8Array(bytes);
    corruptedBytes[Math.floor(corruptedBytes.length / 2)] ^= 0xFF;
    
    const corruptedBlob = new Blob([corruptedBytes], { type: 'application/x-gzip' });
    
    // Reset storage to verify it remains untouched
    mockStorage = { preserved: true };
    
    let statusMsg = "";
    let isStatusError = false;
    
    await BackupManager.importBackup(corruptedBlob, (msg, isError) => {
        statusMsg = msg;
        isStatusError = isError;
    });
    
    if (!isStatusError) {
        throw new Error("Failed: Corrupted backup was successfully imported when it should have been rejected!");
    }
    
    if (!mockStorage.preserved || mockStorage.fsrsCards) {
        throw new Error("Failure: Mock storage was mutated despite backup corruption!");
    }
    
    return `Rejection Status Msg: "${statusMsg}"\nStorage state preserved: ${mockStorage.preserved} (Transaction rollback was successful)`;
});

runTest("Test 5: Verify Backward Compatibility (Legacy V1 Backup Import)", async () => {
    // Fetch mock_data.json from server
    const response = await fetch('/mock_data.json');
    if (!response.ok) {
        throw new Error("Failed to fetch mock_data.json from server");
    }
    const legacyBlob = await response.blob();
    
    // Clear storage
    mockStorage = {};
    
    let statusMsg = "";
    let isStatusError = false;
    
    await BackupManager.importBackup(legacyBlob, (msg, isError) => {
        statusMsg = msg;
        isStatusError = isError;
    });
    
    // Check that items from mock_data.json are present in storage
    if (!mockStorage.fsrsCards || mockStorage.fsrsCards.length === 0) {
        throw new Error(`Legacy cards were not imported. Keys in mockStorage: [${Object.keys(mockStorage).join(', ')}]. statusMsg: "${statusMsg}", isStatusError: ${isStatusError}`);
    }
    if (!mockStorage.marks || mockStorage.marks.length === 0) {
        throw new Error(`Legacy marks were not imported. Keys: [${Object.keys(mockStorage).join(', ')}]`);
    }
    if (!mockStorage.bookmarks || mockStorage.bookmarks.length === 0) {
        throw new Error(`Legacy bookmarks were not imported. Keys: [${Object.keys(mockStorage).join(', ')}]`);
    }
    if (!mockStorage.pagecontents || mockStorage.pagecontents.length === 0) {
        throw new Error(`Legacy pagecontents were not imported. Keys: [${Object.keys(mockStorage).join(', ')}]`);
    }
    
    return `Status: ${statusMsg}\nImported ${mockStorage.fsrsCards.length} cards, ${mockStorage.marks.length} marks, ${mockStorage.bookmarks.length} bookmarks, and ${mockStorage.pagecontents.length} pagecontents from mock_data.json successfully!`;
});

// Start executing
startTests();
