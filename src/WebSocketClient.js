import { WebSocket } from 'ws';
import { EventEmitter } from 'events';

export class WebSocketClient extends EventEmitter {
  constructor(hostname, wsProtocol) {
    super();
    this.hostname = hostname;
    this.wsProtocol = wsProtocol;
    this.ws = null;
    this.connected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 5000;
    this.username = '';
    this.roomname = '';
    this.lastSeenTimestamp = 0;
  }

  async connect(roomname, username) {
    this.roomname = roomname;
    this.username = username;

    let wsUrl = `${this.wsProtocol}//${this.hostname}/api/room/${roomname}/websocket`;

    try {
      this.ws = new WebSocket(wsUrl);
      this.setupEventHandlers();
      
      return new Promise((resolve, reject) => {
        this.ws.once('open', () => {
          this.connected = true;
          this.reconnectAttempts = 0;
          this.emit('connected');
          this.ws.send(JSON.stringify({ name: username }));
          resolve();
        });

        this.ws.once('error', (error) => {
          reject(error);
        });

        // Set a timeout for connection
        setTimeout(() => {
          if (!this.connected) {
            reject(new Error('Connection timeout'));
          }
        }, 10000);
      });
    } catch (error) {
      this.emit('error', error.message);
      throw error;
    }
  }

  setupEventHandlers() {
    this.ws.on('message', (data) => {
      try {
        const parsedData = JSON.parse(data.toString());
        this.handleMessage(parsedData);
      } catch (e) {
        this.emit('error', `Error parsing message: ${e.message}`);
      }
    });

    this.ws.on('close', (code, reason) => {
      this.connected = false;
      this.emit('disconnected', reason.toString());
      
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.scheduleReconnect();
      }
    });

    this.ws.on('error', (error) => {
      this.connected = false;
      this.emit('error', error.message);
      
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.scheduleReconnect();
      }
    });
  }

  handleMessage(data) {
    if (data.error) {
      this.emit('error', data.error);
    } else if (data.joined) {
      this.emit('userJoined', data.joined);
    } else if (data.quit) {
      this.emit('userLeft', data.quit);
    } else if (data.ready) {
      this.emit('message', data);
    } else if (data.timestamp && data.timestamp > this.lastSeenTimestamp) {
      this.lastSeenTimestamp = data.timestamp;
      this.emit('message', data);
    }
  }

  scheduleReconnect() {
    this.reconnectAttempts++;
    this.emit('reconnecting', this.reconnectAttempts);
    
    setTimeout(() => {
      if (!this.connected) {
        this.connect(this.roomname, this.username);
      }
    }, this.reconnectDelay);
  }

  sendMessage(message) {
    if (this.connected && this.ws) {
      this.ws.send(JSON.stringify({ message: message }));
    } else {
      this.emit('error', 'Not connected to chat room');
    }
  }

  disconnect() {
    this.connected = false;
    this.reconnectAttempts = this.maxReconnectAttempts; // Prevent reconnection
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  isConnected() {
    return this.connected && this.ws && this.ws.readyState === WebSocket.OPEN;
  }
} 