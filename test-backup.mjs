import { BackupManager } from './features/common/data/backupManager.js';

// Mock global objects
global.Logger = { time: () => {}, timeEnd: () => {}, info: () => {}, error: () => {} };
global.chrome = {
    storage: {
        local: {
            get: async () => ({}),
            set: async (data) => {
                global.chrome.storage.local._data = data;
            },
            remove: async () => {},
            _data: {}
        }
    }
};

async function testLegacyImport() {
    console.log('Testing Legacy Import...');
    const mockLegacyData = JSON.stringify({
        marks: [{ id: '1', url: 'https://example.com', text: 'test' }]
    });

    const mockFile = {
        slice: () => ({ arrayBuffer: () => Promise.resolve(new Uint8Array([0x7b, 0x22])) })
    };
    // Mock FileReader
    global.FileReader = class {
        readAsText() {
            setTimeout(() => {
                this.onload({ target: { result: mockLegacyData } });
            }, 10);
        }
    };

    await new Promise((resolve) => {
        BackupManager.importLegacy(mockFile, (status, isError) => {
            console.log(status);
            if (!isError && status.includes('successfully')) {
                resolve();
            }
        });
    });

    const marks = global.chrome.storage.local._data.marks;
    if (marks && marks.length > 0 && marks[0].type === 'highlight') {
        console.log('✅ Legacy import successfully assigns default type: highlight');
    } else {
        console.error('❌ Legacy import failed to assign default type', marks);
    }
}

async function run() {
    await testLegacyImport();
}
run();
