export interface ChordStorage {
  get(key: string): string | undefined;
  set(key: string, value: string): void;
  has(key: string): boolean;
  delete(key: string): void;
}

export class ChordMapStorage implements ChordStorage {
  storage: Map<string, string>;

  constructor() {
    this.storage = new Map();
  }
  get(key: string): string | undefined {
    return this.storage.get(key);
  }
  set(key: string, value: string) {
    this.storage.set(key, value);
  }
  has(key: string): boolean {
    return this.storage.has(key);
  }
  delete(key: string) {
    this.storage.delete(key);
  }
}
