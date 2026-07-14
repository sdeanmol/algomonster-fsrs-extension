import gzip
import json
import os

def convert_backup(filepath):
    if not os.path.exists(filepath):
        print(f"🔴 Error: File {filepath} not found.")
        return

    pages = {}
    cards = []
    marks = []
    bookmarks = []
    pagecontents = []

    print(f"📖 Reading and decompressing {filepath}...")
    with gzip.open(filepath, 'rt', encoding='utf-8') as f:
        for line in f:
            if not line.strip():
                continue
            record = json.loads(line)
            record_type = record.get('type')
            record_data = record.get('data')

            if record_type == 'page':
                pages[record_data['id']] = record_data
            elif record_type == 'card':
                cards.append(record_data)
            elif record_type == 'mark':
                marks.append(record_data)
            elif record_type == 'bookmark':
                bookmarks.append(record_data)
            elif record_type == 'pagecontent':
                pagecontents.append(record_data)

    # Helper function to hydrate reference fields
    def hydrate_records(records):
        hydrated = []
        for r in records:
            copy_r = r.copy()
            page_id = copy_r.pop('u', None)
            if page_id is not None and page_id in pages:
                copy_r['url'] = pages[page_id].get('url', '')
                copy_r['title'] = pages[page_id].get('title', '')
            hydrated.append(copy_r)
        return hydrated

    # Hydrate records
    hydrated_cards = hydrate_records(cards)
    hydrated_marks = hydrate_records(marks)
    
    hydrated_bookmarks = []
    for b in bookmarks:
        copy_b = {}
        # Flatten meta fields for easier tabular wrangler analysis
        meta = b.get('meta') or {}
        copy_b['icon_url'] = meta.get('favIconUrl', '')
        
        page_id = b.get('u')
        if page_id is not None and page_id in pages:
            copy_b['url'] = pages[page_id].get('url', '')
            copy_b['title'] = pages[page_id].get('title', '')
        hydrated_bookmarks.append(copy_b)

    # Save to homogeneous JSONL files
    def save_jsonl(records, name):
        filename = f"{name}.jsonl"
        with open(filename, 'w', encoding='utf-8') as f:
            for r in records:
                f.write(json.dumps(r) + '\n')
        print(f"🟢 Created flat tabular file: {filename} ({len(records)} records)")

    save_jsonl(hydrated_cards, 'cards')
    save_jsonl(hydrated_marks, 'marks')
    save_jsonl(hydrated_bookmarks, 'bookmarks')
    print("✨ Conversion finished! You can now load these files directly into Microsoft Data Wrangler.")

if __name__ == '__main__':
    # Default to the mock data backup file in workspace root
    convert_backup('mock_data_backup.json.gz')
