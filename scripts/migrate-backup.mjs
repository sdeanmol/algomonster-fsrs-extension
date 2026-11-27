import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';

const FNV_OFFSET_BASIS_32 = 0x811c9dc5;
const FNV_PRIME_32 = 0x01000193;

class Fnv1aHasher {
    constructor() {
        this.hash = FNV_OFFSET_BASIS_32;
    }

    update(str) {
        for (let i = 0; i < str.length; i++) {
            this.hash ^= str.charCodeAt(i);
            this.hash = (this.hash * FNV_PRIME_32) >>> 0;
        }
    }

    digest() {
        return this.hash.toString(16).padStart(8, '0');
    }
}

function main() {
    const [, , inputPath, explicitOutputPath] = process.argv;
    if (!inputPath) {
        console.error('Usage: node scripts/migrate-backup.mjs <input.json[.gz]> [output.json.gz]');
        process.exit(1);
    }

    const rawBytes = fs.readFileSync(inputPath);
    const isGzip = rawBytes[0] === 0x1f && rawBytes[1] === 0x8b;
    const text = (isGzip ? zlib.gunzipSync(rawBytes) : rawBytes).toString('utf8');

    const records = text
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0)
        .map((l) => JSON.parse(l));

    const hasRegistry = records.some((r) => r.type === 'tagregistry');
    const nameToId = new Map();
    const tagRegistry = [];

    if (!hasRegistry) {
        for (const rec of records) {
            if (rec.type !== 'card' || !Array.isArray(rec.data?.tags)) continue;
            const nextIds = [];
            for (const rawTag of rec.data.tags) {
                const trimmed = String(rawTag).trim();
                if (!trimmed) continue;
                const key = trimmed.toLowerCase();
                let id = nameToId.get(key);
                if (!id) {
                    id = crypto.randomUUID();
                    nameToId.set(key, id);
                    tagRegistry.push({ id, name: trimmed });
                }
                if (!nextIds.includes(id)) {
                    nextIds.push(id);
                }
            }
            rec.data.tags = nextIds;
        }
    }

    const bodyRecords = records.filter((r) => r.type !== 'footer');
    const header = bodyRecords.find((r) => r.type === 'header');
    if (header && header.data && header.data.counts && tagRegistry.length > 0) {
        header.data.counts.tagregistry = 1;
    }

    if (!hasRegistry && tagRegistry.length > 0) {
        bodyRecords.push({ type: 'tagregistry', data: tagRegistry });
    }

    const hasher = new Fnv1aHasher();
    const outLines = [];
    for (const rec of bodyRecords) {
        const line = JSON.stringify(rec);
        hasher.update(line + '\n');
        outLines.push(line);
    }

    const footer = {
        type: 'footer',
        data: {
            checksum: hasher.digest(),
            count: outLines.length
        }
    };
    outLines.push(JSON.stringify(footer));

    const outputText = outLines.join('\n') + '\n';
    const outputPath = explicitOutputPath || (() => {
        const dir = path.dirname(inputPath);
        const base = path.basename(inputPath).replace(/\.json(\.gz)?$/i, '');
        return path.join(dir, `${base}_v3.json.gz`);
    })();

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, zlib.gzipSync(Buffer.from(outputText, 'utf8')));

    console.log(`Migrated ${records.filter((r) => r.type === 'card').length} cards and ${tagRegistry.length} unique tags.`);
    console.log(`Written to: ${outputPath}`);
    console.log(`Checksum: ${footer.data.checksum}, Count: ${footer.data.count}`);
}

main();
