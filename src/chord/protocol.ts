import { ChordNodeBase } from './node';

export interface ChordProtocol {
  findSuccessor(id: number): Promise<ChordNodeBase>;
  notify(node: ChordNodeBase): Promise<void>;
  stabilize(): Promise<void>;
  checkPredecessor(): Promise<void>;
  fixFingers(): Promise<void>;
  get(key: string): Promise<string | undefined>;
  store(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}
