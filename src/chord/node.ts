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
  // Helper variable to keep track of the finger that needs to be updated in the current fixFingers call
  private fingerToUpdate = 0;

  // Key-Value store (the DHT part), plus a file for persistence
  private dataStore: ChordStorage;

  // nodeIdBase is an optional seed to use as a base for creating the node ID
  constructor(
    port: number,
    knownPeer?: Connectable,
    nodeIdSeed?: string,
    storage?: ChordStorage,
  ) {
    // If a storage object is provided, use it otherwise create a new map storage object
    this.dataStore = storage || new ChordMapStorage();

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
    // Start the stabilization process running in the STABILIZE_INTERVAL defined in settings
    setInterval(async () => {
      await this.stabilize();
      await this.fixFingers();
      await this.checkPredecessor();
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
          // TODO Evaluate if we should use open or semi-open interval here the pseudo code uses open interval
          // TODO but open interval means we cannot be our own predecessor which should technically be allowed
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
        } else if (oldPredecessor.nodeId === predecessor.nodeId) {
          console.log(
            `We still have the same predecessor: ${predecessor.nodeId}`,
          );
          this.predecessor = predecessor;
          return Promise.resolve({
            type: ChordResponseType.NOTIFY_RESPONSE,
            sender: this.toChordNodeBase(),
            data: { message: 'WELCOME BACK!' },
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
      case ChordRequestType.GET_PREDECESSOR:
        return Promise.resolve({
          type: ChordResponseType.GET_PREDECESSOR_RESPONSE,
          sender: this.toChordNodeBase(),
          data: { predecessor: this.predecessor },
        });
      case ChordRequestType.PING:
        return Promise.resolve({
          type: ChordResponseType.PONG,
          sender: this.toChordNodeBase(),
          data: { message: 'PONG' },
        });
      case ChordRequestType.GET:
        const value = await this.get(request.data.key);
        return Promise.resolve({
          type: ChordResponseType.GET_RESPONSE,
          sender: this.toChordNodeBase(),
          data: { value: value },
        });
      case ChordRequestType.PUT:
        // TODO Implement a way of reporting if the key was present or not potentially by returning false if the key was not present
        await this.store(request.data.key, request.data.value);
        return Promise.resolve({
          type: ChordResponseType.PUT_RESPONSE,
          sender: this.toChordNodeBase(),
          data: { message: 'OK' },
        });
      case ChordRequestType.REMOVE:
        // TODO Implement a way of reporting if the key was present or not potentially by returning false if the key was not present
        await this.remove(request.data.key);
        return Promise.resolve({
          type: ChordResponseType.REMOVE_RESPONSE,
          sender: this.toChordNodeBase(),
          data: { message: 'OK' },
        });
      default:
        return Promise.reject(new Error('Unknown request type'));
    }
  }

  // PROTOCOL METHODS
  // ----------------

  // Find the successor of a given ID
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

    return response.data.successor;
  }

  // Find the closest preceding node to a given ID in the finger table
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

  // Fixes one finger of the node in each call and increments the finger to update for the next call
  async fixFingers(): Promise<void> {
    // Select next finger to fix
    const i = this.fingerToUpdate;

    // Calculate the ID to find the successor for
    const id = (this.nodeId + Math.pow(2, i)) % RING_SIZE;

    // Find the successor for the ID and then update the finger table
    this.fingerTable[i] = await this.findSuccessor(id);
    // Increment the finger to update for the next call
    this.fingerToUpdate = (this.fingerToUpdate + 1) % M;
  }

  // Store a key-value pair in the DHT
  // TODO Implement a way of reporting if the key was present or not potentially by returning false if the key was not present
  async store(key: string, value: string): Promise<void> {
    // Hash the key to get the ID
    const id = hashStringSHA1(key);
    const successor = await this.findSuccessor(id);

    // If the successor is this node, store the key locally
    if (successor.nodeId === this.nodeId) {
      console.log(`Storing key ${key} with value ${value} locally`);
      this.dataStore.set(key, value);
      return Promise.resolve();
    } else {
      // Send a put request to the successor
      const request = {
        type: ChordRequestType.PUT,
        sender: this.toChordNodeBase(),
        data: { key, value },
      };
      await this.network.sendRequest(successor, request);
      return Promise.resolve();
    }
  }

  // Get a value from the DHT by key (if it exists) or return undefined if it does not
  async get(key: string): Promise<string | undefined> {
    console.log(`Getting key ${key}`);
    // TODO Evaluate if it is smarter to first check the local store or hash the key and check our responsibility
    // TODO Probably depends on the count of the existing nodes and the size of the data store
    // TODO But probably most of the time it is best to first check the local store rather then sending requests around the network
    // If the key is in the local store, return it
    if (this.dataStore.has(key)) {
      return Promise.resolve(this.dataStore.get(key));
    }

    // Hash the key to get the ID
    const id = hashStringSHA1(key);
    const successor = await this.findSuccessor(id);

    // if the successor is this node, then the key is not in the DHT
    if (successor.nodeId === this.nodeId) {
      return Promise.resolve(undefined);
    }

    // Send a get request to the successor
    const request = {
      type: ChordRequestType.GET,
      sender: this.toChordNodeBase(),
      data: { key },
    };
    const response = await this.network.sendRequest(successor, request);

    // Return the value from the response
    return response.data.value;
  }

  // Remove a key-value pair from the DHT
  // TODO Implement a way of reporting if the key was present or not potentially by returning false if the key was not present
  async remove(key: string): Promise<void> {
    const id = hashStringSHA1(key);
    const successor = await this.findSuccessor(id);

    // If the successor is this node, store the key locally
    if (successor.nodeId === this.nodeId) {
      console.log(`Removing key ${key} from local store`);
      this.dataStore.delete(key);
      return Promise.resolve();
    } else {
      // Send a put request to the successor
      const request = {
        type: ChordRequestType.REMOVE,
        sender: this.toChordNodeBase(),
        data: { key },
      };
      await this.network.sendRequest(successor, request);
      return Promise.resolve();
    }
  }

  // Notify the successor of this node that this node is its predecessor
  async notify(node: ChordNodeBase): Promise<void> {
    console.log(`Notifying node ${node.nodeId}`);
    const successor = this.getSuccessor();
    await this.network.sendRequest(successor, {
      type: ChordRequestType.NOTIFY,
      sender: this.toChordNodeBase(),
      data: { predecessor: this.toChordNodeBase() },
    });
  }

  // Stabilize the ring by checking the predecessor of the successor
  // TODO Implement ping to check if the successor / predecessor is still alive
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

    // Notify the new (or old) successor that this node is its predecessor
    await this.notify(this.getSuccessor());

    return Promise.resolve(undefined);
  }

  // Check if the predecessor is still alive
  async checkPredecessor(): Promise<void> {
    const predecessor = this.predecessor;
    if (!predecessor) {
      return Promise.resolve();
    }
    // TODO the Error case does not work yet because the network.sendRequest will result in a runtime error when the connection is refused
    await this.network.sendRequest(predecessor, {
      type: ChordRequestType.PING,
      sender: this.toChordNodeBase(),
      data: {},
    });
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

  // HELPER METHODS
  // ----------------

  // Helper method for converting this node to a ChordNodeBase
  public toChordNodeBase(): ChordNodeBase {
    return {
      nodeId: this.nodeId,
      ip: this.ip,
      port: this.port,
    };
  }
}
