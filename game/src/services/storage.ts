export interface KeyValueStore {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

export class MemoryStore implements KeyValueStore {
  private data = new Map<string, string>();
  get(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  set(key: string, value: string): void {
    this.data.set(key, value);
  }
  remove(key: string): void {
    this.data.delete(key);
  }
}

// 시크릿 모드나 일부 포털 iframe에서는 localStorage 접근 자체가 예외를 던진다.
// 그럴 땐 메모리에만 저장하고 게임은 계속 돌아가게 한다.
export class BrowserStore implements KeyValueStore {
  private fallback = new MemoryStore();

  get(key: string): string | null {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return this.fallback.get(key);
    }
  }
  set(key: string, value: string): void {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      this.fallback.set(key, value);
    }
  }
  remove(key: string): void {
    try {
      window.localStorage.removeItem(key);
    } catch {
      this.fallback.remove(key);
    }
  }
}
