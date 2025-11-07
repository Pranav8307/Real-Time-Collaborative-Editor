import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';

export class YjsWebSocketProvider {
  constructor(documentId, userId, ydoc, awareness) {
    this.documentId = documentId;
    this.userId = userId;
    this.ydoc = ydoc;
    this.awareness = awareness;
    this.ws = null;
    this.synced = false;
    this.shouldConnect = true;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 1000;
    
    // IndexedDB persistence for offline support
    this.persistence = new IndexeddbPersistence(documentId, ydoc);
    
    // Setup awareness broadcasting
    this.setupAwareness();
    
    this.connect();
    this.setupPersistenceHandlers();
  }

  setupAwareness() {
    // Broadcast awareness changes to server
    this.awareness.on('update', ({ added, updated, removed }) => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        // Throttle awareness updates to reduce network traffic
        if (this.awarenessUpdateTimeout) {
          clearTimeout(this.awarenessUpdateTimeout);
        }
        this.awarenessUpdateTimeout = setTimeout(() => {
          import('y-protocols/awareness').then(({ encodeAwarenessUpdate }) => {
            const changed = Array.from(added).concat(Array.from(updated));
            if (changed.length > 0) {
              const awarenessUpdate = encodeAwarenessUpdate(this.awareness, changed);
              this.sendAwarenessMessage(awarenessUpdate);
            }
          }).catch(() => {
            // Fallback: send awareness state as JSON
            const state = {};
            this.awareness.getStates().forEach((value, key) => {
              state[key] = value;
            });
            const encoder = encoding.createEncoder();
            encoding.writeVarUint(encoder, 1); // Awareness message type
            encoding.writeVarString(encoder, JSON.stringify(state));
            if (this.ws.readyState === WebSocket.OPEN) {
              this.ws.send(encoding.toUint8Array(encoder));
            }
          });
        }, 100); // Throttle to max 10 updates per second
      }
    });
  }

  sendAwarenessMessage(awarenessUpdate) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, 1); // Awareness message type
      encoding.writeVarUint8Array(encoder, awarenessUpdate);
      this.ws.send(encoding.toUint8Array(encoder));
    }
  }

  connect() {
    if (!this.shouldConnect) return;
    
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    try {
      this.ws = new WebSocket(wsUrl);
      this.setupWebSocketHandlers();
    } catch (error) {
      console.error('WebSocket connection error:', error);
      this.scheduleReconnect();
    }
  }

  setupWebSocketHandlers() {
    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
      this.sendAuth();
      
      // Send initial awareness state after auth
      // Also send periodic updates to ensure awareness is synced
      const sendAwareness = () => {
        if (this.awareness && this.ws.readyState === WebSocket.OPEN) {
          import('y-protocols/awareness').then(({ encodeAwarenessUpdate }) => {
            const awarenessUpdate = encodeAwarenessUpdate(this.awareness, [this.awareness.clientID]);
            this.sendAwarenessMessage(awarenessUpdate);
            console.log('📤 Sent awareness update, clientID:', this.awareness.clientID);
          }).catch(() => {
            // Fallback
            const state = {};
            this.awareness.getStates().forEach((value, key) => {
              state[key] = value;
            });
            const encoder = encoding.createEncoder();
            encoding.writeVarUint(encoder, 1);
            encoding.writeVarString(encoder, JSON.stringify(state));
            if (this.ws.readyState === WebSocket.OPEN) {
              this.ws.send(encoding.toUint8Array(encoder));
            }
          });
        }
      };
      
      // Send immediately and then periodically
      setTimeout(sendAwareness, 300);
      this.awarenessInterval = setInterval(sendAwareness, 2000); // Send every 2 seconds
    };

    this.ws.onmessage = (event) => {
      this.handleMessage(new Uint8Array(event.data));
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    this.ws.onclose = () => {
      console.log('WebSocket disconnected');
      this.synced = false;
      if (this.awarenessInterval) {
        clearInterval(this.awarenessInterval);
        this.awarenessInterval = null;
      }
      if (this.shouldConnect) {
        this.scheduleReconnect();
      }
    };
  }

  sendAuth() {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, 2); // Auth message type
    encoding.writeVarString(encoder, this.documentId);
    encoding.writeVarString(encoder, this.userId);
    this.ws.send(encoding.toUint8Array(encoder));
  }

  handleMessage(message) {
    try {
      if (!message || message.length === 0) {
        console.warn('Received empty message');
        return;
      }
      
      const decoder = decoding.createDecoder(message);
      
      // Check if decoder has data
      if (decoder.pos >= decoder.length) {
        console.warn('Decoder has no data');
        return;
      }
      
      const messageType = decoding.readVarUint(decoder);

      switch (messageType) {
        case 0: // Sync message
          this.handleSyncMessage(decoder);
          break;
        case 1: // Awareness message
          this.handleAwarenessMessage(decoder);
          break;
        default:
          console.warn('Unknown message type:', messageType);
      }
    } catch (error) {
      console.error('Error handling WebSocket message:', error);
      // Don't crash the app, just log the error
    }
  }

  handleSyncMessage(decoder) {
    try {
      if (decoder.pos >= decoder.length) {
        console.warn('Sync message decoder has no data');
        return;
      }
      
      const syncType = decoding.readVarUint(decoder);

      switch (syncType) {
        case 0: // State vector request
          const stateVector = Y.encodeStateVector(this.ydoc);
          this.sendSyncMessage(1, stateVector);
          break;
        case 1: // Update message
          if (decoder.pos >= decoder.length) {
            console.warn('Update message has no data');
            return;
          }
          const update = decoding.readVarUint8Array(decoder);
          if (update && update.length > 0) {
            Y.applyUpdate(this.ydoc, update, 'server');
            if (!this.synced) {
              this.synced = true;
              this.sendSyncMessage(0, Y.encodeStateVector(this.ydoc));
            }
          }
          break;
        case 2: // Sync complete
          this.synced = true;
          break;
      }
    } catch (error) {
      console.error('Error handling sync message:', error);
    }
  }

  handleAwarenessMessage(decoder) {
    try {
      if (decoder.pos >= decoder.length) {
        console.warn('Awareness message has no data');
        return;
      }
      const awarenessUpdate = decoding.readVarUint8Array(decoder);
      // Apply awareness update using Yjs awareness protocol
      if (this.awareness) {
        // Use dynamic import for awareness protocol
        import('y-protocols/awareness').then(({ applyAwarenessUpdate }) => {
          applyAwarenessUpdate(this.awareness, awarenessUpdate, this);
          const states = this.awareness.getStates();
          console.log('📥 Applied awareness update, current states:', states.size);
          states.forEach((state, clientId) => {
            if (state.user) {
              console.log('  - Client:', clientId, 'User:', state.user.name, 'Color:', state.user.color);
            }
          });
        }).catch((err) => {
          // Fallback: try JSON format
          try {
            const jsonStr = new TextDecoder().decode(awarenessUpdate);
            const state = JSON.parse(jsonStr);
            Object.entries(state).forEach(([clientId, value]) => {
              if (parseInt(clientId) !== this.awareness.clientID) {
                this.awareness.setLocalStateField(parseInt(clientId), value);
              }
            });
            console.log('📥 Applied awareness update (JSON fallback)');
          } catch (parseErr) {
            console.warn('Could not apply awareness update:', parseErr);
          }
        });
      }
    } catch (error) {
      console.error('Error handling awareness message:', error);
    }
  }

  sendSyncMessage(syncType, data) {
    if (this.ws.readyState !== WebSocket.OPEN) return;

    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, 0); // Sync message type
    encoding.writeVarUint(encoder, syncType);
    
    if (data) {
      encoding.writeVarUint8Array(encoder, data);
    }

    this.ws.send(encoding.toUint8Array(encoder));
  }

  sendUpdate(update) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.synced) {
      this.sendSyncMessage(1, update);
    }
  }

  setupPersistenceHandlers() {
    this.persistence.on('synced', () => {
      console.log('Document synced with IndexedDB');
    });

    // Listen to Yjs updates and send to server
    this.ydoc.on('update', (update, origin) => {
      // Don't send updates that came from the server (marked with 'server' origin)
      // or from IndexedDB persistence
      if (origin !== 'server' && origin !== this.persistence) {
        this.sendUpdate(update);
      }
    });

    // Update awareness when cursor/selection changes in CodeMirror
    // This will be handled by y-codemirror, but we ensure awareness is synced
    if (this.awareness) {
      // Awareness updates are automatically sent via setupAwareness()
      console.log('Awareness setup complete, clientID:', this.awareness.clientID);
    }
  }

  scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnect attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    setTimeout(() => {
      if (this.shouldConnect) {
        console.log(`Reconnecting... (attempt ${this.reconnectAttempts})`);
        this.connect();
      }
    }, delay);
  }

  disconnect() {
    this.shouldConnect = false;
    if (this.ws) {
      this.ws.close();
    }
    if (this.persistence) {
      this.persistence.destroy();
    }
  }
}

