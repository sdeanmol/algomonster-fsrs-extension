const fs = require('fs');

class Fnv1aHasher {
    constructor() {
        this.hash = 0x811c9dc5;
    }

    update(str) {
        for (let i = 0; i < str.length; i++) {
            this.hash ^= str.charCodeAt(i);
            this.hash = (this.hash * 0x01000193) >>> 0;
        }
    }

    digest() {
        return this.hash.toString(16).padStart(8, '0');
    }
}

const filepath = '/Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/backup/algo_pro_backup_2026-07-20.json';
const content = fs.readFileSync(filepath, 'utf-8');
const lines = content.split('\n');

const hasher = new Fnv1aHasher();
let newLines = [];
let count = 0;

for (const line of lines) {
    if (!line.trim()) continue;
    
    let parsed;
    try {
        parsed = JSON.parse(line);
    } catch(e) {
        continue;
    }

    if (parsed.type === "footer") {
        const checksum = hasher.digest();
        const footerLine = JSON.stringify({ type: "footer", data: { checksum, count: count } });
        newLines.push(footerLine);
        break; // Footer is the last thing
    } else {
        hasher.update(line + "\n");
        newLines.push(line);
        count++;
    }
}

fs.writeFileSync(filepath, newLines.join("\n") + "\n", 'utf-8');
console.log("Fixed checksum!");
