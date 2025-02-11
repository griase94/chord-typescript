import { ChordNetwork, Connectable } from './network';
import { M, RING_SIZE, STABILIZE_INTERVAL } from './settings';
import { hashStringSHA1, isInOpenInterval, isInSemiOpenInterval } from './util';

import {
  ChordRequest,
  ChordRequestType,
  ChordResponse,
  ChordResponseType,
} from './messages';
import { ChordMapStorage, ChordStorage } from './storage';
import { ChordProtocol } from './protocol';

export abstract class ChordNodeBase implements Connectable {
  abstract nodeId: number;
  abstract ip: string;
  abstract port: number;
}

export class ChordNode implements ChordNodeBase, ChordProtocol {
  // Node's own ID in the ring
  public nodeId: number;

  // IP address of the node is localhost by default
  public ip = '127.0.0.1';
  public port;

  private network: ChordNetwork;

  // The known 'successor' and 'predecessor' in the ring
  private predecessor: ChordNodeBase | undefined;

  // Finger table
  private fingerTable = new Array<ChordNodeBase>(M);

  // Key-Value store (the DHT part), plus a file for persistence
  private dataStore: ChordStorage;

  // nodeIdBase is an optional seed to use as a base for creating the node ID
  constructor(port: number, knownPeer?: Connectable, nodeIdSeed?: string) {
    // TODO Pass the storage object as a parameter to increase testability & abstraction
    this.dataStore = new ChordMapStorage();

    // Generate a node ID
    // If a nodeIdSeed is provided, use it to generate a stable ID
    if (nodeIdSeed) {
      // use the cryptographic hash for a stable ID
      this.nodeId = hashStringSHA1(nodeIdSeed);
    } else {
      // generate random ID
      this.nodeId = Math.floor(Math.random() * RING_SIZE);
    }
    this.port = port;

    // Fill finger table with own ID until we find a successor node
    this.fingerTable.fill(this.toChordNodeBase());

    // Create a network object for this node
    this.network = new ChordNetwork(port);

    // Set predecessor to self until we find a predecessor node
    this.predecessor = this.toChordNodeBase();

    // If a node to connect to is provided, join the ring
    if (knownPeer) {
      this.joinRing(knownPeer);
    }
    this.start();
  }

  // Start the node by opening the network connection
  public start(): void {
    this.network.open(this.handleRequest.bind(this));
    console.log(
      `Chord node with id ${this.nodeId} started on port ${this.port}`,
    );
    // Start the stabilization process every Interval defined in settings
    setInterval(async () => {
      await this.stabilize();
      await this.fixFingers();
    }, STABILIZE_INTERVAL);
  }

  public async stop(): Promise<void> {
    // TODO gracefully leave the ring
    // TODO Handover data to successor
    // TODO Notify predecessor
    // TODO Notify successor
    // TODO Stop the stabilization process
    // Close the network connection
    this.network.close();
  }

  // Connectable instead of ChordNodeBase because we cannot know the id of the peer yet
  public async joinRing(peer: Connectable): Promise<void> {
    // Find successor request
    const request = {
      type: ChordRequestType.FIND_SUCCESSOR,
      sender: this.toChordNodeBase(),
      data: { id: this.nodeId },
    };
    // Find the successor of this node
    const response = await this.network.sendRequest(peer, request);

    if (response.type !== ChordResponseType.FIND_SUCCESSOR_RESPONSE) {
      throw new Error('Unexpected response type');
    }
    // TODO handle parsing Error
    const successor: ChordNodeBase = response.data.successor;

    // Set the successor of this node
    this.setSuccessor(successor);

    // Notify the successor that this node is its predecessor
    await this.notify(successor);
  }

  public async handleRequest(request: ChordRequest): Promise<ChordResponse> {
    switch (request.type) {
      case ChordRequestType.FIND_SUCCESSOR:
        const successor = await this.findSuccessor(request.data.id);
        return Promise.resolve({
          type: ChordResponseType.FIND_SUCCESSOR_RESPONSE,
          sender: this.toChordNodeBase(),
          data: { successor },
        });
      case ChordRequestType.NOTIFY:
        const oldPredecessor = this.predecessor;
        const predecessor = request.data.predecessor;
        if (
          !oldPredecessor ||
          isInOpenInterval(
            predecessor.nodeId,
            oldPredecessor.nodeId,
            this.nodeId,
          )
        ) {
          console.log(`We have a new predecessor: ${predecessor.nodeId}`);
          this.predecessor = predecessor;
          return Promise.resolve({
            type: ChordResponseType.NOTIFY_RESPONSE,
            sender: this.toChordNodeBase(),
            data: { message: 'OK' },
          });
        }
        // If the new predecessor is not in the expected interval, reject it
        // TODO better error handling
        else {
          console.log(`Rejecting predecessor: ${predecessor.nodeId}`);
          return Promise.resolve({
            type: ChordResponseType.NOTIFY_RESPONSE,
            sender: this.toChordNodeBase(),
            data: { message: 'YOU LIED!' },
          });
        }
      default:
        return Promise.reject(new Error('Unknown request type'));
    }
  }

  // Protocol methods
  async findSuccessor(id: number): Promise<ChordNodeBase> {
    // If the ID is between this node and its successor, return the successor
    if (isInSemiOpenInterval(id, this.nodeId, this.getSuccessor().nodeId)) {
      console.log(
        `ID ${id} is between ${this.nodeId} and ${this.getSuccessor().nodeId}`,
      );
      return this.getSuccessor();
    }

    // Otherwise, find the node in the finger table that is closest to the ID
    const closestNode = this.closestPrecedingNode(id);

    // Send a findSuccessor request to the closest node
    const request = {
      type: ChordRequestType.FIND_SUCCESSOR,
      sender: this.toChordNodeBase(),
      data: { id },
    };
    const response = await this.network.sendRequest(closestNode, request);

    if (response.type !== ChordResponseType.FIND_SUCCESSOR_RESPONSE) {
      throw new Error('Unexpected response type');
    }

    return response.data.successor;
  }

  private closestPrecedingNode(id: number): ChordNodeBase {
    for (let i = M - 1; i >= 0; i--) {
      const finger = this.fingerTable[i];
      if (finger === undefined) {
        continue;
      }
      if (isInOpenInterval(finger.nodeId, this.nodeId, id)) {
        return finger;
      }
    }
    return this.toChordNodeBase();
  }

  fixFingers(): Promise<void> {
    console.log('Fixing fingers');
    return Promise.resolve(undefined);
  }

  async get(key: string): Promise<string | undefined> {
    console.log(`Getting key ${key}`);
    return Promise.resolve(undefined);
  }

  async notify(node: ChordNodeBase): Promise<void> {
    console.log(`Notifying node ${node.nodeId}`);
    const successor = this.getSuccessor();
    const response = await this.network.sendRequest(successor, {
      type: ChordRequestType.NOTIFY,
      sender: this.toChordNodeBase(),
      data: { predecessor: this.toChordNodeBase() },
    });
    console.log('Notify response:', response);
  }

  async remove(key: string): Promise<void> {
    console.log(`Removing key ${key}`);
    return Promise.resolve(undefined);
  }

  async stabilize(): Promise<void> {
    // Get the successor's predecessor
    const successor = this.getSuccessor();
    const response = await this.network.sendRequest(successor, {
      type: ChordRequestType.GET_PREDECESSOR,
      sender: this.toChordNodeBase(),
      data: {},
    });
    console.log('Predecessor response:', response);
    const predecessor = response.data.predecessor;

    // If the predecessor is between this node and its successor
    if (
      isInOpenInterval(
        predecessor.nodeId,
        this.nodeId,
        this.getSuccessor().nodeId,
      )
    ) {
      this.setSuccessor(predecessor);
    }

    // Notify the successor that this node is its predecessor
    await this.notify(this.getSuccessor());

    return Promise.resolve(undefined);
  }

  async store(key: string, value: string): Promise<void> {
    console.log(`Storing key ${key} with value ${value}`);
    return Promise.resolve(undefined);
  }

  // Helper method for getting successor which is first entry in finger table
  private getSuccessor(): ChordNodeBase {
    if (this.fingerTable[0] === undefined) {
      throw new Error('Finger table is empty');
    }
    return this.fingerTable[0];
  }

  // Helper method for setting successor which is first entry in finger table
  private setSuccessor(successor: ChordNodeBase): void {
    this.fingerTable[0] = successor;
  }

  // Helper method for converting this node to a ChordNodeBase
  public toChordNodeBase(): ChordNodeBase {
    return {
      nodeId: this.nodeId,
      ip: this.ip,
      port: this.port,
    };
  }
}
