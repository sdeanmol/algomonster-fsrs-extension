/**
 * @file Chrome Extension API Ambient Type Declarations
 * @module types/chrome
 * @context Ambient declaration file providing type definitions for Manifest V3 `chrome.*` APIs.
 * @description Defines the shapes of Chrome extension runtime APIs used across background service
 * workers, content scripts, and extension pages (tabs, runtime, storage, notifications, alarms, webNavigation, etc.).
 */

declare namespace chrome {
  /**
   * Chrome runtime messaging, lifecycle hooks, and extension URL resolution.
   */
  export namespace runtime {
    /**
     * Details passed to the `onInstalled` event listener upon extension installation or update.
     */
    export interface InstalledDetails {
      /** Reason the event was dispatched: fresh install, extension update, or browser update */
      reason: 'install' | 'update' | 'chrome_update' | 'shared_module_update' | string;
      /** Previous version string if reason is 'update' */
      previousVersion?: string;
      /** ID of the shared module that updated, if applicable */
      id?: string;
    }

    /**
     * Information about the caller that dispatched a runtime message.
     */
    export interface MessageSender {
      /** The `Tab` which opened the connection, present if sent from a tab/content script */
      tab?: tabs.Tab;
      /** The ID of the extension that sent the message */
      id?: string;
      /** The URL of the page or frame that opened the connection */
      url?: string;
      /** The frame that opened the connection; 0 indicates the top frame */
      frameId?: number;
    }

    /**
     * Sends a single message to event listeners within the extension.
     * @param message - The message payload to send.
     * @param responseCallback - Optional callback invoked with the receiver's response.
     * @returns A promise resolving to the response from the message recipient.
     */
    export function sendMessage(message: any, responseCallback?: (response: any) => void): Promise<any>;

    /**
     * Sends a message to a specific extension ID.
     * @param extensionId - Target extension identifier.
     * @param message - The payload to send.
     * @param responseCallback - Optional callback invoked with the response.
     * @returns A promise resolving to the response.
     */
    export function sendMessage(extensionId: string, message: any, responseCallback?: (response: any) => void): Promise<any>;

    /**
     * Event fired when a message is sent from either an extension process or a content script.
     */
    export const onMessage: {
      /**
       * Registers a callback for runtime messages.
       * @param callback - Function handling incoming message, sender context, and response dispatcher.
       */
      addListener(callback: (message: any, sender: MessageSender, sendResponse: (response?: any) => void) => boolean | void | Promise<any>): void;
      /** Removes a previously registered message listener */
      removeListener(callback: Function): void;
      /** Checks if the listener is currently registered */
      hasListener(callback: Function): boolean;
    };

    /**
     * Event fired when the extension is first installed, updated to a new version, or Chrome updates.
     */
    export const onInstalled: {
      /** Registers a callback for installation/update lifecycle events */
      addListener(callback: (details: InstalledDetails) => void): void;
      /** Removes an installation listener */
      removeListener(callback: Function): void;
      /** Checks if an installation listener is registered */
      hasListener(callback: Function): boolean;
    };

    /**
     * Converts a relative path within an extension install directory to a fully qualified URL.
     * @param path - Relative path (e.g. "icons/icon128.png").
     * @returns Absolute `chrome-extension://<id>/path` URL.
     */
    export function getURL(path: string): string;

    /** Error object populated if an asynchronous Chrome API call fails */
    export const lastError: { message?: string } | undefined;

    /** The unique ID of the extension */
    export const id: string;
  }

  /**
   * Extension storage API providing key-value persistence across browser sessions.
   */
  export namespace storage {
    /**
     * Change notification record containing previous and new values for a storage key.
     */
    export interface StorageChange {
      /** Key value before modification */
      oldValue?: any;
      /** Key value after modification */
      newValue?: any;
    }

    /**
     * Base storage area interface representing `local`, `sync`, or `session` stores.
     */
    export interface StorageArea {
      /**
       * Retrieves one or more items from storage.
       * @param keys - A single key, an array of keys, or a dictionary specifying default values.
       * @param callback - Optional callback returning the retrieved key-value dictionary.
       * @returns A promise resolving to an object containing key-value pairs.
       */
      get(keys?: string | string[] | object | null, callback?: (items: { [key: string]: any }) => void): Promise<{ [key: string]: any }>;

      /**
       * Stores one or more items in storage.
       * @param items - Object giving keys and values to store.
       * @param callback - Optional callback invoked after storage has completed.
       * @returns A promise resolving when storage operation completes.
       */
      set(items: object, callback?: () => void): Promise<void>;

      /**
       * Removes one or more items from storage.
       * @param keys - Key or list of keys to remove.
       * @param callback - Optional completion callback.
       * @returns A promise resolving when deletion completes.
       */
      remove(keys: string | string[], callback?: () => void): Promise<void>;

      /**
       * Removes all items from this storage area.
       * @param callback - Optional completion callback.
       * @returns A promise resolving when storage is cleared.
       */
      clear(callback?: () => void): Promise<void>;
    }

    /** Persistent local storage area specific to the local machine */
    export const local: StorageArea;
    /** Synchronized storage area synced across logged-in browser profiles */
    export const sync: StorageArea;

    /**
     * Event fired when one or more storage items change across any area.
     */
    export const onChanged: {
      /** Registers a listener receiving changes and storage area name */
      addListener(callback: (changes: { [key: string]: StorageChange }, areaName: string) => void): void;
      /** Removes a storage change listener */
      removeListener(callback: Function): void;
      /** Checks if a storage change listener is registered */
      hasListener(callback: Function): boolean;
    };
  }

  /**
   * Browser tab management and cross-tab communication.
   */
  export namespace tabs {
    /**
     * Represents a browser tab.
     */
    export interface Tab {
      /** The tab's unique identifier */
      id?: number;
      /** Zero-based index of the tab within its window */
      index: number;
      /** ID of the window containing this tab */
      windowId: number;
      /** Whether the tab is highlighted */
      highlighted: boolean;
      /** Whether the tab is the active tab in its window */
      active: boolean;
      /** Whether the tab is pinned */
      pinned: boolean;
      /** Canonical URL the tab is displaying */
      url?: string;
      /** Title of the tab */
      title?: string;
      /** URL of the tab's favicon */
      favIconUrl?: string;
      /** Tab status: "loading" or "complete" */
      status?: string;
      /** Whether the tab is in an incognito window */
      incognito: boolean;
    }

    /**
     * Retrieves all tabs that satisfy the specified properties.
     * @param queryInfo - Query filter criteria (e.g., active, currentWindow).
     * @param callback - Optional callback receiving matching tabs.
     * @returns A promise resolving to an array of tabs.
     */
    export function query(queryInfo: object, callback?: (result: Tab[]) => void): Promise<Tab[]>;

    /**
     * Sends a message to the content script in the specified tab.
     * @param tabId - Identifier of the destination tab.
     * @param message - The message payload to dispatch.
     * @param responseCallback - Optional callback for response.
     * @returns A promise resolving to the response.
     */
    export function sendMessage(tabId: number, message: any, responseCallback?: (response: any) => void): Promise<any>;

    /**
     * Sends a message to a specific tab with framing options.
     * @param tabId - Identifier of the destination tab.
     * @param message - The message payload.
     * @param options - Options detailing target frame.
     * @param responseCallback - Optional response callback.
     * @returns A promise resolving to the response.
     */
    export function sendMessage(tabId: number, message: any, options: object, responseCallback?: (response: any) => void): Promise<any>;

    /**
     * Creates a new browser tab.
     * @param createProperties - Properties for the new tab (e.g. url, active).
     * @param callback - Optional callback receiving the created tab.
     * @returns A promise resolving to the created tab.
     */
    export function create(createProperties: object, callback?: (tab: Tab) => void): Promise<Tab>;
  }

  /**
   * Controls extension action button styling in the browser toolbar (Manifest V3).
   */
  export namespace action {
    /**
     * Sets the badge text displayed over the toolbar icon.
     * @param details - Contains the text string and optional target tabId.
     * @param callback - Optional completion callback.
     * @returns A promise resolving when badge text is updated.
     */
    export function setBadgeText(details: { text: string; tabId?: number }, callback?: () => void): Promise<void>;

    /**
     * Sets the background color of the badge.
     * @param details - Contains the color string/RGBA tuple and optional target tabId.
     * @param callback - Optional completion callback.
     * @returns A promise resolving when badge color is updated.
     */
    export function setBadgeBackgroundColor(details: { color: string | number[]; tabId?: number }, callback?: () => void): Promise<void>;

    /**
     * Sets the tooltip title shown when hovering over the extension icon.
     * @param details - Title text and optional target tabId.
     * @param callback - Optional completion callback.
     * @returns A promise resolving when title is updated.
     */
    export function setTitle(details: { title: string; tabId?: number }, callback?: () => void): Promise<void>;
  }

  /**
   * Periodic alarm scheduling service for background background operations.
   */
  export namespace alarms {
    /**
     * Represents a scheduled browser alarm.
     */
    export interface Alarm {
      /** Unique name of the alarm */
      name: string;
      /** Time at which the alarm is scheduled to fire, in milliseconds past the epoch */
      scheduledTime: number;
      /** Recurrence period in minutes, if periodic */
      periodInMinutes?: number;
    }

    /**
     * Creates an alarm with a specified name and timing triggers.
     * @param name - Alarm identifier.
     * @param alarmInfo - Schedule parameters (delayInMinutes, periodInMinutes, when).
     */
    export function create(name: string, alarmInfo: { when?: number; delayInMinutes?: number; periodInMinutes?: number }): void;

    /**
     * Clears an active alarm by name.
     * @param name - Identifier of the alarm to cancel.
     * @param callback - Optional callback indicating if an alarm was found and removed.
     * @returns A promise resolving to true if cleared.
     */
    export function clear(name: string, callback?: (wasCleared: boolean) => void): Promise<boolean>;

    /**
     * Event fired when a scheduled alarm reaches its trigger time.
     */
    export const onAlarm: {
      /** Registers an alarm event handler */
      addListener(callback: (alarm: Alarm) => void): void;
      /** Removes an alarm handler */
      removeListener(callback: Function): void;
      /** Checks if an alarm listener is registered */
      hasListener(callback: Function): boolean;
    };
  }

  /**
   * Tracks navigation events and lifecycle state changes across tabs.
   */
  export namespace webNavigation {
    /**
     * Filter constraints for web navigation event listeners.
     */
    export interface WebNavigationEventFilter {
      /** Array of URL matching criteria */
      url: Array<{ hostContains?: string; hostEquals?: string; urlMatches?: string }>;
    }

    /**
     * Event details provided to web navigation callbacks.
     */
    export interface WebNavigationParentedCallbackDetails {
      /** Tab ID where navigation occurred */
      tabId: number;
      /** Destination URL */
      url: string;
      /** Operating system process ID */
      processId: number;
      /** Frame index where navigation occurred (0 for top-level) */
      frameId: number;
      /** Navigation timestamp */
      timeStamp: number;
    }

    /** Type alias for navigation details */
    export type WebNavigationSourceCallbackDetails = WebNavigationParentedCallbackDetails;

    /**
     * Event fired when the page history state updates without full page reloads (SPA route navigation).
     */
    export const onHistoryStateUpdated: {
      /** Registers a history state update listener */
      addListener(callback: (details: WebNavigationParentedCallbackDetails) => void, filter?: WebNavigationEventFilter): void;
      /** Removes a history listener */
      removeListener(callback: Function): void;
      /** Checks if a history listener is registered */
      hasListener(callback: Function): boolean;
    };
  }

  /**
   * Desktop notifications API for displaying rich desktop alerts to users.
   */
  export namespace notifications {
    /**
     * Configuration options for creating desktop notifications.
     */
    export interface NotificationOptions {
      /** Notification layout format */
      type?: 'basic' | 'image' | 'list' | 'progress';
      /** URL to an icon displayed in the notification */
      iconUrl?: string;
      /** Title of the notification */
      title?: string;
      /** Main message body */
      message?: string;
      /** Additional context line */
      contextMessage?: string;
      /** Priority ranking (e.g. -2 to 2) */
      priority?: number;
      /** Event time in epoch milliseconds */
      eventTime?: number;
      /** Action button configurations */
      buttons?: Array<{ title: string; iconUrl?: string }>;
      /** List items for list-style notifications */
      items?: Array<{ title: string; message: string }>;
      /** Progress bar value (0 to 100) */
      progress?: number;
      /** Whether clicking the notification body triggers an action */
      isClickable?: boolean;
      /** Mask image URL */
      appIconMaskUrl?: string;
      /** Image banner URL */
      imageUrl?: string;
      /** Whether to suppress sounds or alerts */
      silent?: boolean;
      /** Whether notification stays on screen until dismissed */
      requireInteraction?: boolean;
    }

    /**
     * Creates and displays a desktop notification with an auto-generated ID.
     * @param options - Notification display options.
     * @param callback - Optional callback returning the generated ID.
     */
    export function create(options: NotificationOptions, callback?: (notificationId: string) => void): void;

    /**
     * Creates and displays a desktop notification with a custom ID.
     * @param notificationId - Unique notification identifier.
     * @param options - Notification display options.
     * @param callback - Optional callback returning the confirmed ID.
     */
    export function create(notificationId: string, options: NotificationOptions, callback?: (notificationId: string) => void): void;

    /**
     * Clears an active notification.
     * @param notificationId - Identifier of notification to close.
     * @param callback - Optional callback indicating clearance status.
     * @returns A promise resolving to true if cleared.
     */
    export function clear(notificationId: string, callback?: (wasCleared: boolean) => void): Promise<boolean>;

    /**
     * Retrieves all active notifications for the extension.
     * @param callback - Optional callback receiving notification ID dictionary.
     * @returns A promise resolving to an object of active notification IDs.
     */
    export function getAll(callback?: (notifications: { [key: string]: boolean }) => void): Promise<{ [key: string]: boolean }>;

    /**
     * Event fired when the user clicks on the notification body.
     */
    export const onClicked: {
      /** Registers a notification click handler */
      addListener(callback: (notificationId: string) => void): void;
      /** Removes a notification click handler */
      removeListener(callback: Function): void;
      /** Checks if click listener is registered */
      hasListener(callback: Function): boolean;
    };

    /**
     * Event fired when a notification is closed by the user or system.
     */
    export const onClosed: {
      /** Registers a notification close handler */
      addListener(callback: (notificationId: string, byUser: boolean) => void): void;
      /** Removes a close handler */
      removeListener(callback: Function): void;
      /** Checks if close listener is registered */
      hasListener(callback: Function): boolean;
    };
  }

  /**
   * Browser file downloads management.
   */
  export namespace downloads {
    /**
     * Options specifying file download source and disk destination.
     */
    export interface DownloadOptions {
      /** URL of the file to download or data URI */
      url: string;
      /** Relative file path / name for the downloaded file */
      filename?: string;
      /** Whether to prompt user with Save As dialog */
      saveAs?: boolean;
      /** Action when file conflicts exist: 'uniquify', 'overwrite', 'prompt' */
      conflictAction?: string;
    }

    /**
     * Initiates a download from a URL or data URI.
     * @param options - Parameters describing the download.
     * @param callback - Optional callback returning the download ID.
     * @returns A promise resolving to the download ID.
     */
    export function download(options: DownloadOptions, callback?: (downloadId: number) => void): Promise<number>;
  }

  /**
   * Dynamic extension permission querying and requesting.
   */
  export namespace permissions {
    /**
     * Set of optional permissions or origin patterns.
     */
    export interface Permissions {
      /** Named API permissions (e.g. "alarms", "notifications") */
      permissions?: string[];
      /** Host origin patterns (e.g. "https://leetcode.com/*") */
      origins?: string[];
    }

    /**
     * Requests optional permissions dynamically from the user.
     * @param permissions - Requested permissions.
     * @param callback - Callback returning grant status.
     * @returns A promise resolving to true if granted.
     */
    export function request(permissions: Permissions, callback?: (granted: boolean) => void): Promise<boolean>;

    /**
     * Relinquishes previously granted permissions.
     * @param permissions - Permissions to remove.
     * @param callback - Callback returning removal status.
     * @returns A promise resolving to true if removed.
     */
    export function remove(permissions: Permissions, callback?: (removed: boolean) => void): Promise<boolean>;

    /**
     * Checks if the extension currently possesses specified permissions.
     * @param permissions - Permissions to query.
     * @param callback - Callback returning check result.
     * @returns A promise resolving to true if possessed.
     */
    export function contains(permissions: Permissions, callback?: (result: boolean) => void): Promise<boolean>;
  }

  /**
   * Dynamic content script injection and programmatic registration (Manifest V3).
   */
  export namespace scripting {
    /**
     * Content script registration configuration.
     */
    export interface RegisteredContentScript {
      /** Unique identifier for the registered script */
      id: string;
      /** Array of match URL patterns where script executes */
      matches?: string[];
      /** JavaScript files to inject */
      js?: string[];
      /** Stylesheet files to inject */
      css?: string[];
      /** Injection timing: "document_idle", "document_start", "document_end" */
      runAt?: string;
      /** Whether script runs in all subframes */
      allFrames?: boolean;
    }

    /**
     * Registers one or more dynamic content scripts.
     * @param scripts - Array of scripts to register.
     * @param callback - Optional completion callback.
     * @returns A promise resolving upon successful registration.
     */
    export function registerContentScripts(scripts: RegisteredContentScript[], callback?: () => void): Promise<void>;

    /**
     * Unregisters dynamically registered content scripts.
     * @param filter - Script IDs to unregister.
     * @param callback - Optional completion callback.
     * @returns A promise resolving upon unregistration.
     */
    export function unregisterContentScripts(filter?: { ids?: string[] }, callback?: () => void): Promise<void>;
  }
}
