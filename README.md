# Chord Algorithm (WIP) – TypeScript Implementation

This repository hosts a **work-in-progress** TypeScript implementation of the **Chord algorithm**, a peer-to-peer distributed hash table (DHT) protocol designed for efficient lookup operations in decentralized networks. Introduced in the seminal paper by Stoica et al. ([“Chord: A Scalable Peer-to-peer Lookup Service for Internet Applications,” 2001](http://pdos.csail.mit.edu/papers/chord:sigcomm01/chord_sigcomm.pdf)), Chord organizes nodes into a logical ring and uses consistent hashing to facilitate fast node insertions, deletions, and lookups. You can read more about it on [Wikipedia](https://en.wikipedia.org/wiki/Chord_(peer-to-peer)).

> **Note**  
> This project is not finished, and **many improvements and optimizations need to be done for it to be perfect**.

The project is built using `TypeScript` and `Node.js`, and it includes a simple WebSocket-based network layer for communication between nodes. 

For simplicity we are using a simple in-memory storage for the keys and values of the nodes.

We use following settings for the Chord Algorithm:
- We use `M=16` as the number of bits in the hash function
- The Chord Ring has a size of `2^M`, meaning that the ring has a maximum size of `2^16 = 65536` nodes
- The hash function is `SHA1` with a modified hash size of 16 bits

## Useful Commands
```bash
# Install dependencies
pnpm install

# Build the project
pnpm build

# # Start the built project on port 8080 (default)
pnpm start

# Start the built project on port 8081
pnpm start 8081

# Start the built project on port 8081 and connect to the node on port 8080
pnpm start 8082 8080

# Run the Project in Development Mode (with hot-reloading)
pnpm dev 

# Build the Docker Image
docker build -t chord-typescript .

# Run the Docker Image on port 8081
docker run -p 8081:8081 -e PORT=8081 chord-typescript

# Run the Docker Image on port 8081 and connect to the node on port 8080
docker run -p 8082:8082 -e PORT=8082 -e PEER_PORT=8080 chord-typescript
```

## Improvements / WIP
The following is an incomplete list of improvements that I would have liked to add if I had had more time to work on the project.

### Code Quality
- Improve the way files / classes and interfaces are organized in the project
  - Create subfolders / packages for the different functionalities (node, storage, network, message, etc.) of the chord
  - Possibly split the interfaces / classes into their own files for each packages
- Heavily improve logging (heavily) in the project
  - Add a logging library to the project
  - Configure the logging library to have readable logs with the node id, timestamp, class name, etc.
  - Write meaningful & understandable logs with adequate log levels
- Reduce redundancy in the GET, PUT and DELETE functionalities of the node

### Chord Algorithm
- The Check Predecessor function is probably not implemented correctly, the network will fail if the predecessor is not reachable and produce a runtime error
- Implement the handover of the storage keys when a node joins/ leaves the network
- Implement a redundancy strategy for the storage keys so that they are not lost when a node crashes (not part of original protocol)


### Functionality
- Introduce typing in a smart way for incoming messages and specifically their payloads
- Improve the Websocket connection handling
  - Research a potentially smarter way to handle Requests / Responses -> What happens if a response is not received or something is received in the wrong order?
  - Implement a caching strategy
  - Add IDs to the requests / messages so the responses can be matched to the requests
  - Evaluate a better way than the current "fire and forget" way  to send requests
- Evaluate a better way to handle the different types of messages
- Improve the passing of parameters to the index.ts file
  - Evaluate a better way to pass the parameters to the index.ts file (probably named parameters)
  - Refactor the code of passing the parameters to application
  - Find a good way to pass the peer connection parameters 
- Add a good console interface to the project for the user to interact with the chord
  - Add a way of visualisation of the nodes current state (finger table, successor, predecessor, storage, etc.)
- Improve Error Handling heavily
  - Write error classes / types
  - Potentially introduce Error Codes to Websockets / Responses

### Testing
- Heavily test every part of the project
- Unit tests especially for the in open / semi-open interval checks / Hashing
- Integration tests for testing the chord functionalities throughly 

### CI/CD
- Find a way to use the local & pipeline node_modules and pnpm store in the Docker build process
- Add Variables for Docker Build / Registry in Github
- Figure out a way of Deploying multiple Docker Containers (with differen ports connection strings etc) to a Hosting Service / Kubernetes & add it in the CI/CD pipeline