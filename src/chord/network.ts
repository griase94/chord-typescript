import { RawData, WebSocket, WebSocketServer } from 'ws';

import { ChordRequest, ChordResponse, getResponseType } from './messages';

export interface Connectable {
  ip: string;
  port: number;
}

export class ChordNetwork {
  // This class will be used to handle the network communication between nodes
  // It will be used to send and receive messages between nodes

  // The WebSocket server instance
  private wss: WebSocketServer;

  // Cache for WebSocket connections
  private wsCache: Map<Connectable, WebSocket> = new Map();

  // port is the port number to listen on
  constructor(port: number) {
    this.wss = new WebSocketServer({ port });
  }

  // Method to open the WebSocket server
  public open(
    handleRequest: (request: ChordRequest) => Promise<ChordResponse>,
  ): void {
    this.wss.on('connection', (socket: WebSocket) => {
      socket.on('message', async (data: RawData) => {
        console.log('Received message:', data.toString());
        // Convert the incoming RawData to a string safely
        const request: ChordRequest = JSON.parse(data.toString());
        console.log('Received request:', request);
        const response = await handleRequest(request);
        console.log('Sending response:', response);
        socket.send(JSON.stringify(response));
      });
    });
  }

  // Method to close the WebSocket server
  public close(): void {
    this.wss.close();
  }

  // Method to send a fire and forget request to a node
  // TODO: Implement a retry mechanism, Add error handling, Cache connections
  public async sendRequest(
    node: Connectable,
    message: ChordRequest,
  ): Promise<ChordResponse> {
    return new Promise((resolve, reject) => {
      // Connect to the WebSocket
      const ws = new WebSocket(`ws://${node.ip}:${node.port}`);

      // Send the message to the node
      ws.on('open', () => {
        console.log('Connected to', node);
        ws.send(JSON.stringify(message));
      });

      // Handle the response from the node
      ws.on('message', (data: RawData) => {
        const response: ChordResponse = JSON.parse(data.toString());
        console.log('Received Response: ', response);
        if (getResponseType(message.type) === response.type) {
          resolve(response);
        } else {
          reject(new Error('Invalid response type'));
        }
        ws.close();
      });
    });
  }
}
