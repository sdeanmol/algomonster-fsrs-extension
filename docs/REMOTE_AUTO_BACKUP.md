# Remote Cloud Auto-Backup Architecture & Developer Guide

## Table of Contents
1. [Overview & Design Philosophy](#overview--design-philosophy)
2. [High-Level Component Topology](#high-level-component-topology)
3. [Core Class & Interface Architecture](#core-class--interface-architecture)
4. [Detailed Sequence & State Diagrams](#detailed-sequence--state-diagrams)
   - [Automated Background Sync & Deduplication Pipeline](#1-automated-background-sync--deduplication-pipeline)
   - [User Authentication & Connection Lifecycle](#2-user-authentication--connection-lifecycle)
   - [Backup Rotation & Retention Lifecycle](#3-backup-rotation--retention-lifecycle)
5. [Data Flow & Checksum Deduplication Engine](#data-flow--checksum-deduplication-engine)
6. [Current Implementation: Google Drive AppData Provider](#current-implementation-google-drive-appdata-provider)
7. [Step-by-Step Guide: Adding Future Backup Providers](#step-by-step-guide-adding-future-backup-providers)
   - [Option 1: Firebase Cloud Firestore Provider (`FirestoreBackupProvider`)](#option-1-firebase-cloud-firestore-provider-firestorebackupprovider)
   - [Option 3: Microsoft OneDrive / Graph API Provider (`OneDriveBackupProvider`)](#option-3-microsoft-onedrive--graph-api-provider-onedrivebackupprovider)
   - [Option 4: Custom Webhook / S3 Pre-Signed Endpoint Provider (`WebhookBackupProvider`)](#option-4-custom-webhook--s3-pre-signed-endpoint-provider-webhookbackupprovider)
   - [Option 5: Apple iCloud Drive / WebDAV Provider (`WebDavBackupProvider`)](#option-5-apple-icloud-drive--webdav-provider-webdavbackupprovider)
8. [Error Handling, Failure Recovery & Edge Cases](#error-handling-failure-recovery--edge-cases)
9. [Testing & Verification Suite](#testing--verification-suite)

---

## Overview & Design Philosophy

The **Remote Cloud Auto-Backup System** in AlgoRecall provides automatic background synchronization of flashcards, FSRS stability metrics, highlight notes, bookmarks, and user configurations to cloud storage providers.

### Key Design Principles

1. **Pluggable Architecture (Open-Closed Principle)**:
   The core service (`RemoteBackupService`) is open for extension via provider plugins but closed for modification. Adding a new cloud provider requires **zero changes** to existing background worker loops, alarms, or UI event listeners.
2. **Zero Overhead Checksum Deduplication**:
   Before initiating network calls, the system computes a 32-bit FNV-1a checksum hash over the compressed Gzip payload. If the local checksum matches the previous successful backup checksum, the network request is bypassed.
3. **Local-First & Data Isolation**:
   Backups are stored inside hidden, application-specific data folders (e.g. Google Drive `appDataFolder`) isolated from user personal files.
4. **Automated Retention Management**:
   Cloud providers automatically enforce rolling retention policies (e.g. retaining the 5 most recent snapshots and deleting expired ones).

---

## High-Level Component Topology

The diagram below maps the interaction between UI controls, background processes, serialization utilities, provider modules, and external cloud services:

```mermaid
graph TB
    subgraph "User Interface Layer (Popup & Options)"
        UI_Toggle[Remote Backup Toggle Switch]
        UI_Select[Storage Provider Dropdown]
        UI_SyncBtn[Sync Cloud Backup Now Button]
        UI_Status[Live Status Badge]
    end

    subgraph "Extension Core Layer"
        SW[Background Service Worker / Alarms]
        Service[RemoteBackupService Singleton]
        BM[BackupManager Engine]
        Hasher[Fnv1aHasher Checksum Engine]
    end

    subgraph "Pluggable Cloud Provider Layer"
        Interface[RemoteBackupProvider Interface]
        GDrive[GoogleDriveBackupProvider]
        Firestore[FirestoreBackupProvider - Future]
        OneDrive[OneDriveBackupProvider - Future]
        S3[WebhookBackupProvider - Future]
    end

    subgraph "External Cloud Infrastructure"
        GoogleAPI[Google Drive REST API appDataFolder]
        FirebaseAPI[Firebase Cloud Firestore API]
        MSGraphAPI[Microsoft Graph API approot]
        CustomS3[Custom REST Webhook / S3]
    end

    UI_Toggle -->|Messaging| SW
    UI_SyncBtn -->|Messaging| SW
    SW -->|Triggers Schedule / Manual| Service
    Service -->|1. Generate Data| BM
    Service -->|2. Compute Hash| Hasher
    Service -->|3. Upload via Contract| Interface
    Interface -->|Implements| GDrive
    Interface -.->|Implements| Firestore
    Interface -.->|Implements| OneDrive
    Interface -.->|Implements| S3
    GDrive -->|HTTPS OAuth2| GoogleAPI
    Firestore -.->|HTTPS Auth| FirebaseAPI
    OneDrive -.->|HTTPS OAuth2| MSGraphAPI
    S3 -.->|HTTPS Auth| CustomS3
    Service -->|Status Updates| UI_Status
```

---

## Core Class & Interface Architecture

```mermaid
classDiagram
    class RemoteBackupProvider {
        <<interface>>
        +string id
        +string name
        +authenticate(interactive: boolean) Promise~boolean~
        +uploadBackup(payload: BackupPayload) Promise~UploadResult~
        +isConnected() Promise~boolean~
        +disconnect() Promise~void~
        +rotateBackups(maxBackupsToKeep: number) Promise~void~
    }

    class BackupPayload {
        +Uint8Array data
        +string filename
        +string checksum
        +number timestamp
    }

    class UploadResult {
        +boolean success
        +string remoteId
        +string error
    }

    class GoogleDriveBackupProvider {
        +string id = 'gdrive'
        +string name = 'Google Drive (AppData)'
        +authenticate(interactive: boolean) Promise~boolean~
        +uploadBackup(payload: BackupPayload) Promise~UploadResult~
        +isConnected() Promise~boolean~
        +disconnect() Promise~void~
        +rotateBackups(maxBackupsToKeep: number) Promise~void~
        -getAuthToken() Promise~string~
    }

    class RemoteBackupService {
        -static instance: RemoteBackupService
        -Map~string, RemoteBackupProvider~ providers
        +getInstance() RemoteBackupService
        +registerProvider(provider: RemoteBackupProvider) void
        +getProvider(providerId?: string) RemoteBackupProvider
        +listProviders() Array~Object~
        +getSettings() Promise~RemoteBackupSettings~
        +saveSettings(newSettings) Promise~RemoteBackupSettings~
        +setupAlarmSchedule(settings) Promise~void~
        +performBackup(force: boolean) Promise~UploadResult~
    }

    class BackupManager {
        +exportDataGzip() Promise~Uint8Array~
        +importBackup(file, onStatus) Promise~void~
    }

    class Fnv1aHasher {
        +number hash
        +update(str: string) void
        +digest() string
    }

    RemoteBackupProvider <|.. GoogleDriveBackupProvider : implements
    RemoteBackupService "1" o-- "*" RemoteBackupProvider : manages
    RemoteBackupService ..> BackupPayload : passes to provider
    RemoteBackupService ..> UploadResult : receives from provider
    RemoteBackupService --> BackupManager : calls exportDataGzip()
    RemoteBackupService --> Fnv1aHasher : calculates payload digest
```

---

## Detailed Sequence & State Diagrams

### 1. Automated Background Sync & Deduplication Pipeline

This sequence details how background auto-backups determine whether an upload is necessary:

```mermaid
sequenceDiagram
    autonumber
    participant Alarm as Chrome Alarm (remoteAutoBackup)
    participant SW as Background Service Worker
    participant Service as RemoteBackupService
    participant BM as BackupManager
    participant Hasher as Fnv1aHasher
    participant Provider as GoogleDriveBackupProvider
    participant GDrive as Google Drive REST API

    Alarm->>SW: Fire alarm 'remoteAutoBackup'
    SW->>Service: performBackup(force = false)
    Service->>Service: getSettings()
    Service->>BM: exportDataGzip()
    BM-->>Service: Return Uint8Array (Compressed Gzip Bytes)
    Service->>Hasher: update(binaryString)
    Hasher-->>Service: digest() -> Checksum (e.g. "a3f8c1b9")
    
    alt Checksum == lastBackupChecksum AND lastBackupStatus == 'success' AND force == false
        Service->>Service: Log "Backup skipped: Data unchanged"
        Service-->>SW: Return UploadResult { success: true }
    else Checksum differs OR force == true
        Service->>Provider: uploadBackup(payload)
        Provider->>Provider: authenticate(interactive = false)
        Provider->>GDrive: POST /upload/drive/v3/files?uploadType=multipart
        GDrive-->>Provider: HTTP 200 OK { id: "gdrive_file_987" }
        Provider->>Provider: rotateBackups(maxBackupsToKeep = 5)
        Provider->>GDrive: GET /drive/v3/files?spaces=appDataFolder
        GDrive-->>Provider: List of existing backup files
        opt File count > 5
            Provider->>GDrive: DELETE oldest excess backup files
        end
        Provider-->>Service: Return UploadResult { success: true, remoteId }
        Service->>Service: Update storage (lastBackupTimestamp, lastBackupChecksum, status)
        Service-->>SW: Return UploadResult { success: true }
    end
```

---

### 2. User Authentication & Connection Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Disconnected: Default State
    
    Disconnected --> Authenticating: User toggles Remote Backup ON
    Authenticating --> Connected: chrome.identity.getAuthToken Success
    Authenticating --> Disconnected: OAuth Cancelled or Denied
    
    Connected --> Syncing: Alarm trigger OR "Sync Now" click
    Syncing --> Connected: Upload Success / Checksum Deduplicated
    Syncing --> ErrorState: Network Failure / Invalid Token
    
    ErrorState --> Authenticating: User re-authenticates
    ErrorState --> Connected: Auto-retry on next alarm
    
    Connected --> Disconnected: User toggles Remote Backup OFF
    Disconnected --> [*]
```

---

### 3. Backup Rotation & Retention Lifecycle

```mermaid
sequenceDiagram
    autonumber
    participant Provider as GoogleDriveBackupProvider
    participant Drive as Google Drive AppData Folder

    Provider->>Drive: Query files in appDataFolder (orderBy=createdTime desc)
    Drive-->>Provider: Array of 7 backup files
    Provider->>Provider: Slice array past index 5 (keep top 5)
    loop For each file in excess list (indices 5, 6)
        Provider->>Drive: DELETE /drive/v3/files/{file.id}
        Drive-->>Provider: HTTP 204 No Content
    end
```

---

## Data Flow & Checksum Deduplication Engine

To save battery, CPU, network bandwidth, and cloud storage quotas, AlgoRecall uses an incremental **FNV-1a 32-bit checksum pipeline**:

```
+--------------------------+
|  chrome.storage.local    |
| (cards, marks, settings) |
+------------+-------------+
             |
             v
+--------------------------+
|  BackupManager           |
|  .exportDataGzip()       |
+------------+-------------+
             | Output: Gzip Uint8Array
             v
+--------------------------+
|  Fnv1aHasher             |
|  .update() & digest()    |
+------------+-------------+
             | Output: 8-char Hex Checksum (e.g., "7f8b91a2")
             v
     [ Checksum Match? ]
      /               \
   (YES)             (NO)
    /                   \
Skip Network        Upload to Cloud &
Upload              Save New Checksum
```

---

## Current Implementation: Google Drive AppData Provider

The default provider is implemented in `features/common/data/remote/providers/googleDriveProvider.ts`:

- **Scope**: `https://www.googleapis.com/auth/drive.appdata`
- **Isolation**: Files are stored exclusively in Google Drive's hidden `appDataFolder`. The user's normal Google Drive document list remains untouched.
- **Upload Format**: Multipart HTTP POST request formatted with boundary delimiter:
  - **Part 1 (`application/json`)**: Metadata JSON (`name`, `parents: ['appDataFolder']`, `description`).
  - **Part 2 (`application/gzip`)**: Base64-encoded Gzip backup byte data.
- **Token Cleanup**: When disconnected, `chrome.identity.removeCachedAuthToken` invalidates the cached token in Chrome.

---

## Step-by-Step Guide: Adding Future Backup Providers

Adding new storage backends (Firestore, OneDrive, Webhooks/S3, iCloud) requires zero modifications to core extension code. Simply implement the `RemoteBackupProvider` interface and register your new provider.

---

### Option 1: Firebase Cloud Firestore Provider (`FirestoreBackupProvider`)

This provider uses Cloud Firestore to store backup documents under `users/{userId}/backups/{backupId}`.

```typescript
/**
 * @file features/common/data/remote/providers/firestoreProvider.ts
 * @description Cloud Firestore provider implementing RemoteBackupProvider.
 */
import { RemoteBackupProvider, BackupPayload, UploadResult } from '../remoteBackupProvider';
import { Logger } from '@common/logger';

export class FirestoreBackupProvider implements RemoteBackupProvider {
    readonly id = 'firestore';
    readonly name = 'Firebase Cloud Firestore';

    private userId: string | null = null;

    async authenticate(interactive: boolean = false): Promise<boolean> {
        try {
            // Retrieve Firebase Auth token or chrome.identity Google Auth
            return new Promise<boolean>((resolve) => {
                if (typeof chrome === 'undefined' || !chrome.identity) {
                    resolve(false);
                    return;
                }
                chrome.identity.getAuthToken({ interactive }, (token) => {
                    if (chrome.runtime?.lastError || !token) {
                        resolve(false);
                    } else {
                        // Decode token or authenticate with Firebase Auth SDK
                        this.userId = 'user_google_authenticated';
                        resolve(true);
                    }
                });
            });
        } catch (err) {
            return false;
        }
    }

    async uploadBackup(payload: BackupPayload): Promise<UploadResult> {
        try {
            const auth = await this.authenticate(false);
            if (!auth || !this.userId) {
                return { success: false, error: 'User unauthenticated in Firestore.' };
            }

            // Convert Uint8Array payload data to Base64
            let binary = '';
            const bytes = payload.data;
            for (let i = 0; i < bytes.byteLength; i++) {
                binary += String.fromCharCode(bytes[i]);
            }
            const base64Content = btoa(binary);

            // Post document to Firestore REST API: users/{userId}/fsrsData
            const firestoreUrl = `https://firestore.googleapis.com/v1/projects/algomonster-fsrs/databases/(default)/documents/users/${this.userId}/backups`;
            
            const response = await fetch(firestoreUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fields: {
                        filename: { stringValue: payload.filename },
                        checksum: { stringValue: payload.checksum },
                        timestamp: { integerValue: payload.timestamp },
                        data: { stringValue: base64Content }
                    }
                })
            });

            if (!response.ok) {
                return { success: false, error: `Firestore HTTP ${response.status}` };
            }

            const data = await response.json();
            return { success: true, remoteId: data.name };
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            return { success: false, error: errorMessage };
        }
    }

    async isConnected(): Promise<boolean> {
        return this.authenticate(false);
    }

    async disconnect(): Promise<void> {
        this.userId = null;
    }

    async rotateBackups(maxBackupsToKeep: number = 5): Promise<void> {
        // Query Firestore backup collection and delete documents older than maxBackupsToKeep
    }
}
```

---

### Option 3: Microsoft OneDrive / Graph API Provider (`OneDriveBackupProvider`)

This provider uses Microsoft Graph API (`https://graph.microsoft.com/v1.0/me/drive/special/approot`) to save backups inside OneDrive's dedicated app folder.

```typescript
/**
 * @file features/common/data/remote/providers/oneDriveProvider.ts
 * @description Microsoft OneDrive provider implementing RemoteBackupProvider.
 */
import { RemoteBackupProvider, BackupPayload, UploadResult } from '../remoteBackupProvider';

export class OneDriveBackupProvider implements RemoteBackupProvider {
    readonly id = 'onedrive';
    readonly name = 'Microsoft OneDrive';

    private accessToken: string | null = null;

    async authenticate(interactive: boolean = false): Promise<boolean> {
        // Use OAuth2 flow for Microsoft Graph API
        return this.accessToken !== null;
    }

    async uploadBackup(payload: BackupPayload): Promise<UploadResult> {
        try {
            if (!this.accessToken) return { success: false, error: 'Not authenticated with OneDrive' };

            // Upload directly to special/approot folder in OneDrive
            const uploadUrl = `https://graph.microsoft.com/v1.0/me/drive/special/approot:/${payload.filename}:/content`;
            
            const response = await fetch(uploadUrl, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Content-Type': 'application/gzip'
                },
                body: payload.data
            });

            if (!response.ok) {
                return { success: false, error: `OneDrive HTTP ${response.status}` };
            }

            const resData = await response.json();
            return { success: true, remoteId: resData.id };
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            return { success: false, error: errorMessage };
        }
    }

    async isConnected(): Promise<boolean> {
        return this.accessToken !== null;
    }

    async disconnect(): Promise<void> {
        this.accessToken = null;
    }
}
```

---

### Option 4: Custom Webhook / S3 Pre-Signed Endpoint Provider (`WebhookBackupProvider`)

For users who want to host their own backup server or push to AWS S3 / Cloudflare R2:

```typescript
/**
 * @file features/common/data/remote/providers/webhookProvider.ts
 * @description Custom REST Endpoint / Webhook provider implementing RemoteBackupProvider.
 */
import { RemoteBackupProvider, BackupPayload, UploadResult } from '../remoteBackupProvider';

export class WebhookBackupProvider implements RemoteBackupProvider {
    readonly id = 'webhook';
    readonly name = 'Custom REST Webhook / S3';

    private endpointUrl: string = '';
    private apiKey: string = '';

    constructor(endpointUrl: string = '', apiKey: string = '') {
        this.endpointUrl = endpointUrl;
        this.apiKey = apiKey;
    }

    async authenticate(interactive: boolean = false): Promise<boolean> {
        return this.endpointUrl.length > 0;
    }

    async uploadBackup(payload: BackupPayload): Promise<UploadResult> {
        try {
            if (!this.endpointUrl) {
                return { success: false, error: 'Custom Webhook URL is missing.' };
            }

            const response = await fetch(this.endpointUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/gzip',
                    'X-AlgoRecall-Checksum': payload.checksum,
                    'X-AlgoRecall-Filename': payload.filename
                },
                body: payload.data
            });

            if (!response.ok) {
                return { success: false, error: `Webhook Server HTTP ${response.status}` };
            }

            return { success: true };
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            return { success: false, error: errorMessage };
        }
    }

    async isConnected(): Promise<boolean> {
        return this.endpointUrl.length > 0;
    }

    async disconnect(): Promise<void> {
        this.endpointUrl = '';
        this.apiKey = '';
    }
}
```

---

### Option 5: Apple iCloud Drive / WebDAV Provider (`WebDavBackupProvider`)

For WebDAV-compliant cloud storage (e.g., Nextcloud, Owncloud, Apple WebDAV server):

```typescript
/**
 * @file features/common/data/remote/providers/webDavProvider.ts
 * @description WebDAV provider implementing RemoteBackupProvider.
 */
import { RemoteBackupProvider, BackupPayload, UploadResult } from '../remoteBackupProvider';

export class WebDavBackupProvider implements RemoteBackupProvider {
    readonly id = 'webdav';
    readonly name = 'Nextcloud / WebDAV';

    private serverUrl: string = '';

    async authenticate(interactive: boolean = false): Promise<boolean> {
        return this.serverUrl.length > 0;
    }

    async uploadBackup(payload: BackupPayload): Promise<UploadResult> {
        try {
            const targetUrl = `${this.serverUrl}/${payload.filename}`;
            const response = await fetch(targetUrl, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/gzip' },
                body: payload.data
            });

            if (!response.ok) return { success: false, error: `WebDAV HTTP ${response.status}` };
            return { success: true };
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            return { success: false, error: errorMessage };
        }
    }

    async isConnected(): Promise<boolean> {
        return this.serverUrl.length > 0;
    }

    async disconnect(): Promise<void> {
        this.serverUrl = '';
    }
}
```

---

## How to Register & Activate a Provider

To register any new provider, add a single call inside `RemoteBackupService` (`features/common/data/remote/remoteBackupService.ts`):

```typescript
import { FirestoreBackupProvider } from './providers/firestoreProvider';
import { OneDriveBackupProvider } from './providers/oneDriveProvider';

private constructor() {
    this.registerProvider(new GoogleDriveBackupProvider());
    this.registerProvider(new FirestoreBackupProvider());
    this.registerProvider(new OneDriveBackupProvider());
}
```

Then update the options dropdown in `features/dashboard/popup/popup.html`:

```html
<select id="remote-provider-select" class="modern-input">
    <option value="gdrive">Google Drive (AppData)</option>
    <option value="firestore">Firebase Cloud Firestore</option>
    <option value="onedrive">Microsoft OneDrive</option>
</select>
```

---

## Error Handling, Failure Recovery & Edge Cases

| Scenario | Symptom / Behavior | Recovery Strategy |
| :--- | :--- | :--- |
| **Offline / Network Interruption** | `fetch` throws NetworkError | Caught in `performBackup`. Logs error, updates `lastBackupStatus: 'failed'`, retains alarm schedule to retry on next cycle. |
| **Expired OAuth Token** | HTTP 401 Unauthorized from Provider | Provider's `uploadBackup` catches 401, calls `chrome.identity.removeCachedAuthToken`, prompts re-auth on next user interaction. |
| **Unchanged Local Data** | Review queue has not been updated | `Fnv1aHasher` digest matches `lastBackupChecksum`. Bypasses upload cleanly to save bandwidth. |
| **Google Drive Quota Exceeded** | HTTP 507 Insufficient Storage | `rotateBackups` purges oldest backups. If space is still full, user status updates with error message. |
| **Browser Closed / Service Worker Sleep** | Alarm triggers while browser is idle | Service Worker automatically boots, performs backup, updates `chrome.storage.local`, and terminates cleanly. |

---

## Testing & Verification Suite

Run all unit tests using Jest:

```bash
npm test
```

Unit test file: `tests/unit/remoteBackupService.test.js`

### Test Assertions
1. **Default Registration**: Verifies `GoogleDriveBackupProvider` is registered with correct ID (`'gdrive'`).
2. **Dynamic Provider Registration**: Verifies custom providers can be added to runtime provider map.
3. **Settings Persistence**: Validates reading and saving `remoteBackupSettings` to `chrome.storage.local`.
4. **Interface Adherence**: Ensures every provider implements `authenticate`, `uploadBackup`, `isConnected`, `disconnect`, and `rotateBackups`.
