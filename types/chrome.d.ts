declare namespace chrome {
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
    };
    export const onClosed: {
      addListener(callback: (notificationId: string, byUser: boolean) => void): void;
    };
  }
}
