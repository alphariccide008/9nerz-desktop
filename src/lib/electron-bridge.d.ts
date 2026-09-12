export {};

declare global {
  interface Window {
    nerz?: {
      storage: {
        getItem(key: string): Promise<string | null>;
        setItem(key: string, value: string): Promise<void>;
        removeItem(key: string): Promise<void>;
      };
      notify(title: string, body: string): Promise<void>;
      openExternal(url: string): Promise<void>;
      appVersion(): Promise<string>;
      setBadge(dataUrl: string | null, description?: string): Promise<void>;
    };
  }
}
