import { ChordStorage } from './chord-storage';

export class ChordMapStorage implements ChordStorage {
  storage: Map<string, string>;

  constructor() {
    this.storage = new Map();
  }
  get(key: string): string | undefined {
    return this.storage.get(key);
  }
  set(key: string, value: string): void {
    this.storage.set(key, value);
  }
  has(key: string): boolean {
    return this.storage.has(key);
  }
  delete(key: string): void {
    this.storage.delete(key);
  }
}
