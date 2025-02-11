import { ChordNode } from './chord/node';
import { Connectable } from './chord/network';

// read port from the command line or use 8080 as default
const port = parseInt(process.argv[2]!) || 8080;

console.log('Args: ', process.argv);

// Read the known peer's IP and port in the format 'ip:port' from the command line
const knownPeerPort = process.argv[3];
let peer: Connectable | undefined;
if (knownPeerPort) {
  const ip = parseInt(knownPeerPort);

  peer = {
    ip: '127.0.0.1',
    port: ip,
  };

  console.log('Known peer:', peer);
}

console.log('Starting Chord node...');

if (peer) {
  console.log('Joining ring with known peer.');
  const node = new ChordNode(port, peer);
  console.log(
    `Node ID: ${node.nodeId} started on port ${port} with peer on port ${peer.port}.`,
  );
} else {
  console.log('Starting a new ring.');
  const node = new ChordNode(port);
  console.log(
    `Node ID: ${node.nodeId} started on port ${port} with no known peer.`,
  );
}
