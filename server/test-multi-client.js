/**
 * Multi-client simulation test
 * Simulates multiple clients editing the same document
 */

import * as Y from 'yjs';
import { WebSocket } from 'ws';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';

const WS_URL = 'ws://localhost:3001/ws';
const DOCUMENT_ID = 'test-doc-123';
const USER_ID = 'test-user-1';

class TestClient {
  constructor(id) {
    this.id = id;
    this.ydoc = new Y.Doc();
    this.ytext = this.ydoc.getText('content');
    this.ws = null;
    this.synced = false;
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(WS_URL);

      this.ws.onopen = () => {
        console.log(`[Client ${this.id}] Connected`);
        this.sendAuth();
        resolve();
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(new Uint8Array(event.data));
      };

      this.ws.onerror = (error) => {
        console.error(`[Client ${this.id}] Error:`, error);
        reject(error);
      };

      this.ws.onclose = () => {
        console.log(`[Client ${this.id}] Disconnected`);
      };
    });
  }

  sendAuth() {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, 2); // Auth
    encoding.writeVarString(encoder, DOCUMENT_ID);
    encoding.writeVarString(encoder, USER_ID);
    this.ws.send(encoding.toUint8Array(encoder));
  }

  handleMessage(message) {
    const decoder = decoding.createDecoder(message);
    const messageType = decoding.readVarUint(decoder);

    if (messageType === 0) {
      const syncType = decoding.readVarUint(decoder);
      if (syncType === 1) {
        const update = decoding.readVarUint8Array(decoder);
        Y.applyUpdate(this.ydoc, update);
        if (!this.synced) {
          this.synced = true;
          console.log(`[Client ${this.id}] Synced`);
        }
      }
    }
  }

  insert(text, index) {
    this.ytext.insert(index, text);
    const update = Y.encodeStateAsUpdate(this.ydoc);
    this.sendUpdate(update);
  }

  sendUpdate(update) {
    if (!this.synced) return;

    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, 0); // Sync
    encoding.writeVarUint(encoder, 1); // Update
    encoding.writeVarUint8Array(encoder, update);
    this.ws.send(encoding.toUint8Array(encoder));
  }

  getContent() {
    return this.ytext.toString();
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

async function runTest() {
  console.log('Starting multi-client test...\n');

  const clients = [];
  const numClients = 3;

  // Create and connect clients
  for (let i = 0; i < numClients; i++) {
    const client = new TestClient(i + 1);
    await client.connect();
    await new Promise(resolve => setTimeout(resolve, 100)); // Wait for sync
    clients.push(client);
  }

  console.log('\nAll clients connected. Starting concurrent edits...\n');

  // Concurrent edits
  const edits = [
    () => clients[0].insert('Hello ', 0),
    () => clients[1].insert('World', 5),
    () => clients[2].insert('!', 10),
    () => clients[0].insert(' from Client 1', 11),
    () => clients[1].insert(' from Client 2', 11),
  ];

  // Execute edits concurrently
  await Promise.all(edits.map(edit => {
    setTimeout(edit, Math.random() * 100);
    return new Promise(resolve => setTimeout(resolve, 200));
  }));

  // Wait for sync
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Check convergence
  console.log('\nChecking convergence...\n');
  const contents = clients.map(c => c.getContent());
  const allMatch = contents.every(c => c === contents[0]);

  console.log('Final content from each client:');
  contents.forEach((content, i) => {
    console.log(`  Client ${i + 1}: "${content}"`);
  });

  console.log(`\n✓ Convergence: ${allMatch ? 'PASSED' : 'FAILED'}`);

  // Cleanup
  clients.forEach(c => c.disconnect());
  process.exit(allMatch ? 0 : 1);
}

runTest().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});

