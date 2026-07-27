declare namespace chrome {
  export namespace runtime {
    export interface InstalledDetails {
      reason: 'install' | 'update' | 'chrome_update' | 'shared_module_update' | string;
      previousVersion?: string;
      id?: string;
    }
    export interface MessageSender {
      tab?: tabs.Tab;
      id?: string;
      url?: string;
      frameId?: number;
    }
    export function sendMessage(message: any, responseCallback?: (response: any) => void): Promise<any>;
    export function sendMessage(extensionId: string, message: any, responseCallback?: (response: any) => void): Promise<any>;
    export const onMessage: {
      addListener(callback: (message: any, sender: MessageSender, sendResponse: (response?: any) => void) => boolean | void | Promise<any>): void;
      removeListener(callback: Function): void;
      hasListener(callback: Function): boolean;
    };
    export const onInstalled: {
      addListener(callback: (details: InstalledDetails) => void): void;
      removeListener(callback: Function): void;
      hasListener(callback: Function): boolean;
    };
    export function getURL(path: string): string;
    export const lastError: { message?: string } | undefined;
    export const id: string;
  }

  export namespace storage {
    export interface StorageChange {
      oldValue?: any;
      newValue?: any;
    }
    export interface StorageArea {
      get(keys?: string | string[] | object | null, callback?: (items: { [key: string]: any }) => void): Promise<{ [key: string]: any }>;
      set(items: object, callback?: () => void): Promise<void>;
      remove(keys: string | string[], callback?: () => void): Promise<void>;
      clear(callback?: () => void): Promise<void>;
    }
    export const local: StorageArea;
    export const sync: StorageArea;
    export const onChanged: {
      addListener(callback: (changes: { [key: string]: StorageChange }, areaName: string) => void): void;
      removeListener(callback: Function): void;
      hasListener(callback: Function): boolean;
    };
  }

  export namespace tabs {
    export interface Tab {
      id?: number;
      index: number;
      windowId: number;
      highlighted: boolean;
      active: boolean;
      pinned: boolean;
      url?: string;
      title?: string;
      favIconUrl?: string;
      status?: string;
      incognito: boolean;
    }
    export function query(queryInfo: object, callback?: (result: Tab[]) => void): Promise<Tab[]>;
    export function sendMessage(tabId: number, message: any, responseCallback?: (response: any) => void): Promise<any>;
    export function sendMessage(tabId: number, message: any, options: object, responseCallback?: (response: any) => void): Promise<any>;
    export function create(createProperties: object, callback?: (tab: Tab) => void): Promise<Tab>;
  }

  export namespace action {
    export function setBadgeText(details: { text: string; tabId?: number }, callback?: () => void): Promise<void>;
    export function setBadgeBackgroundColor(details: { color: string | number[]; tabId?: number }, callback?: () => void): Promise<void>;
    export function setTitle(details: { title: string; tabId?: number }, callback?: () => void): Promise<void>;
  }

  export namespace alarms {
    export interface Alarm {
      name: string;
      scheduledTime: number;
      periodInMinutes?: number;
    }
    export function create(name: string, alarmInfo: { when?: number; delayInMinutes?: number; periodInMinutes?: number }): void;
    export function clear(name: string, callback?: (wasCleared: boolean) => void): Promise<boolean>;
    export const onAlarm: {
      addListener(callback: (alarm: Alarm) => void): void;
      removeListener(callback: Function): void;
      hasListener(callback: Function): boolean;
    };
  }

  export namespace webNavigation {
    export interface WebNavigationEventFilter {
      url: Array<{ hostContains?: string; hostEquals?: string; urlMatches?: string }>;
    }
    export interface WebNavigationParentedCallbackDetails {
      tabId: number;
      url: string;
      processId: number;
      frameId: number;
      timeStamp: number;
    }
    export type WebNavigationSourceCallbackDetails = WebNavigationParentedCallbackDetails;
    export const onHistoryStateUpdated: {
      addListener(callback: (details: WebNavigationParentedCallbackDetails) => void, filter?: WebNavigationEventFilter): void;
      removeListener(callback: Function): void;
      hasListener(callback: Function): boolean;
    };
  }

  export namespace notifications {
    export interface NotificationOptions {
      type?: 'basic' | 'image' | 'list' | 'progress';
      iconUrl?: string;
      title?: string;
      message?: string;
      contextMessage?: string;
      priority?: number;
      eventTime?: number;
      buttons?: Array<{ title: string; iconUrl?: string }>;
      items?: Array<{ title: string; message: string }>;
      progress?: number;
      isClickable?: boolean;
      appIconMaskUrl?: string;
      imageUrl?: string;
      silent?: boolean;
      requireInteraction?: boolean;
    }
    export function create(options: NotificationOptions, callback?: (notificationId: string) => void): void;
    export function create(notificationId: string, options: NotificationOptions, callback?: (notificationId: string) => void): void;
    export function clear(notificationId: string, callback?: (wasCleared: boolean) => void): Promise<boolean>;
    export function getAll(callback?: (notifications: { [key: string]: boolean }) => void): Promise<{ [key: string]: boolean }>;
    export const onClicked: {
      addListener(callback: (notificationId: string) => void): void;
      removeListener(callback: Function): void;
      hasListener(callback: Function): boolean;
    };
    export const onClosed: {
      addListener(callback: (notificationId: string, byUser: boolean) => void): void;
      removeListener(callback: Function): void;
      hasListener(callback: Function): boolean;
    };
  }
}
