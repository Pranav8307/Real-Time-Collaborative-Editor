import { WebSocketServer } from 'ws';
import * as Y from 'yjs';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import yjsPersistence from './yjs-persistence.js';
import Document from '../models/Document.js';
import logger from '../utils/logger.js';
import { activeConnections, presenceCount, errorCounter } from '../utils/metrics.js';

export class WebSocketHub {
  constructor(server) {
    this.wss = new WebSocketServer({ server, path: '/ws' });
    this.rooms = new Map(); // documentId -> Set of clients
    this.clients = new Map(); // ws -> client info
    this.awareness = new Map(); // documentId -> Map of clientId -> awareness state
    
    this.setupHandlers();
    this.startCleanupInterval();
  }

  setupHandlers() {
    this.wss.on('connection', (ws, req) => {
      const clientId = this.generateClientId();
      let documentId = null;
      let userId = null;
      
      logger.info({ clientId }, 'New WebSocket connection');

      ws.on('message', async (message) => {
        try {
          const decoder = decoding.createDecoder(new Uint8Array(message));
          const messageType = decoding.readVarUint(decoder);
          
          switch (messageType) {
            case 0: // Sync message (Yjs protocol)
              await this.handleSyncMessage(ws, decoder, clientId, documentId);
              break;
            case 1: // Awareness message
              await this.handleAwarenessMessage(ws, decoder, clientId, documentId);
              break;
            case 2: // Auth message
              const authData = this.decodeAuthMessage(decoder);
              documentId = authData.documentId;
              userId = authData.userId;
              
              if (!await this.authorizeAccess(userId, documentId)) {
                ws.close(1008, 'Unauthorized');
                return;
              }
              
              this.joinRoom(documentId, ws, clientId, userId);
              await this.sendInitialState(ws, documentId);
              break;
            default:
              logger.warn({ messageType, clientId }, 'Unknown message type');
          }
        } catch (error) {
          logger.error({ error, clientId, documentId }, 'Error handling message');
          errorCounter.inc({ error_type: 'websocket_message', document_id: documentId || 'unknown' });
        }
      });

      ws.on('close', () => {
        this.leaveRoom(documentId, ws, clientId);
        logger.info({ clientId, documentId }, 'WebSocket disconnected');
      });

      ws.on('error', (error) => {
        logger.error({ error, clientId, documentId }, 'WebSocket error');
        errorCounter.inc({ error_type: 'websocket_error', document_id: documentId || 'unknown' });
      });
    });
  }

  async handleSyncMessage(ws, decoder, clientId, documentId) {
    if (!documentId) return;
    
    const syncMessageType = decoding.readVarUint(decoder);
    
    switch (syncMessageType) {
      case 0: // Sync step 1: Client sends state vector
        const stateVector = decoding.readVarUint8Array(decoder);
        const missingUpdates = await yjsPersistence.getMissingUpdates(
          documentId,
          new Uint8Array(stateVector)
        );
        
        if (missingUpdates && missingUpdates.length > 0) {
          this.sendSyncMessage(ws, 1, missingUpdates); // Sync step 2: Send updates
        } else {
          this.sendSyncMessage(ws, 0, null); // Sync complete
        }
        break;
        
      case 1: // Sync step 2: Client sends update
        const update = decoding.readVarUint8Array(decoder);
        await this.handleUpdate(documentId, new Uint8Array(update), clientId);
        
        // Broadcast to other clients in room (exclude sender)
        this.broadcastToRoom(documentId, ws, 1, update);
        break;
        
      case 2: // Sync complete
        // Acknowledgment, no action needed
        break;
    }
  }

  async handleUpdate(documentId, update, clientId) {
    try {
      const vectorClock = new Map(); // Simplified - in production use proper vector clocks
      await yjsPersistence.saveUpdate(documentId, update, clientId, vectorClock);
    } catch (error) {
      logger.error({ error, documentId, clientId }, 'Failed to handle update');
      throw error;
    }
  }

  async handleAwarenessMessage(ws, decoder, clientId, documentId) {
    if (!documentId) return;
    
    const awarenessUpdate = decoding.readVarUint8Array(decoder);
    
    // Update local awareness state
    if (!this.awareness.has(documentId)) {
      this.awareness.set(documentId, new Map());
    }
    
    const awareness = this.awareness.get(documentId);
    // Parse awareness update (simplified - Yjs awareness protocol)
    try {
      const update = JSON.parse(new TextDecoder().decode(awarenessUpdate));
      awareness.set(clientId, update);
      presenceCount.set({ document_id: documentId.toString() }, awareness.size);
    } catch (error) {
      // Binary awareness format
      awareness.set(clientId, awarenessUpdate);
    }
    
    // Broadcast to other clients
    this.broadcastAwareness(documentId, ws, awarenessUpdate);
  }

  async sendInitialState(ws, documentId) {
    const stateVector = await yjsPersistence.getStateVector(documentId);
    this.sendSyncMessage(ws, 0, stateVector); // Send state vector
  }

  sendSyncMessage(ws, syncType, data) {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, 0); // Message type: Sync
    encoding.writeVarUint(encoder, syncType);
    
    if (data) {
      encoding.writeVarUint8Array(encoder, data);
    }
    
    if (ws.readyState === ws.OPEN) {
      ws.send(encoding.toUint8Array(encoder));
    }
  }

  broadcastToRoom(documentId, excludeWs, syncType, update) {
    const room = this.rooms.get(documentId);
    if (!room) return;
    
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, 0); // Message type: Sync
    encoding.writeVarUint(encoder, syncType);
    encoding.writeVarUint8Array(encoder, update);
    const message = encoding.toUint8Array(encoder);
    
    room.forEach((client) => {
      if (client.ws !== excludeWs && client.ws.readyState === client.ws.OPEN) {
        client.ws.send(message);
      }
    });
  }

  broadcastAwareness(documentId, excludeWs, awarenessUpdate) {
    const room = this.rooms.get(documentId);
    if (!room) return;
    
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, 1); // Message type: Awareness
    encoding.writeVarUint8Array(encoder, awarenessUpdate);
    const message = encoding.toUint8Array(encoder);
    
    room.forEach((client) => {
      if (client.ws !== excludeWs && client.ws.readyState === client.ws.OPEN) {
        client.ws.send(message);
      }
    });
  }

  async joinRoom(documentId, ws, clientId, userId) {
    if (!this.rooms.has(documentId)) {
      this.rooms.set(documentId, new Set());
    }
    
    const room = this.rooms.get(documentId);
    room.add({ ws, clientId, userId });
    this.clients.set(ws, { documentId, clientId, userId });
    
    activeConnections.inc({ document_id: documentId.toString() });
    logger.info({ documentId, clientId, userId, roomSize: room.size }, 'Client joined room');
  }

  leaveRoom(documentId, ws, clientId) {
    if (documentId && this.rooms.has(documentId)) {
      const room = this.rooms.get(documentId);
      room.forEach((client) => {
        if (client.ws === ws) {
          room.delete(client);
        }
      });
      
      if (room.size === 0) {
        this.rooms.delete(documentId);
        this.awareness.delete(documentId);
      } else {
        presenceCount.set({ document_id: documentId.toString() }, room.size);
      }
      
      activeConnections.dec({ document_id: documentId.toString() });
    }
    
    this.clients.delete(ws);
  }

  async authorizeAccess(userId, documentId) {
    try {
      const document = await Document.findById(documentId);
      if (!document || document.isDeleted) {
        return false;
      }
      
      // Owner has access
      if (document.ownerId.toString() === userId) {
        return true;
      }
      
      // Check ACL
      return document.accessControl.some(
        (acl) => acl.userId.toString() === userId && acl.role !== 'viewer'
      );
    } catch (error) {
      logger.error({ error, userId, documentId }, 'Authorization check failed');
      return false;
    }
  }

  decodeAuthMessage(decoder) {
    const documentId = decoding.readVarString(decoder);
    const userId = decoding.readVarString(decoder);
    return { documentId, userId };
  }

  generateClientId() {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  startCleanupInterval() {
    // Cleanup disconnected clients every 5 minutes
    setInterval(() => {
      for (const [documentId, room] of this.rooms.entries()) {
        for (const client of room) {
          if (client.ws.readyState !== client.ws.OPEN) {
            room.delete(client);
            this.clients.delete(client.ws);
          }
        }
        
        if (room.size === 0) {
          this.rooms.delete(documentId);
          this.awareness.delete(documentId);
        }
      }
    }, 5 * 60 * 1000);
  }
}

