import inquirer from 'inquirer';
import chalk from 'chalk';
import boxen from 'boxen';
import ora from 'ora';
import { UserInterface } from './UserInterface.js';
import { WebSocketClient } from './WebSocketClient.js';
import { RoomManager } from './RoomManager.js';

export class ChatApp {
  constructor(options = {}) {
    this.options = options;
    // Extract hostname without protocol for WebSocket URL construction
    const rawHost = options.host || 'biz-chat-server.sreeragh-bizmo.workers.dev';
    this.hostname = rawHost.replace(/^https?:\/\//, ''); // Remove protocol if present
    this.protocol = 'https:';
    this.wsProtocol = 'wss:';
    
    this.username = options.username || '';
    this.roomname = options.room || '';
    this.updateChecker = options.updateChecker || null;
    
    this.ui = null;
    this.wsClient = null;
    this.roomManager = null;
  }

  async start() {
    try {
      // Show welcome message
      this.showWelcome();
      
      // Get room name if not provided via CLI options
      await this.gatherRoomInput();
      
      // Initialize managers
      this.roomManager = new RoomManager(this.hostname, this.protocol);
      this.wsClient = new WebSocketClient(this.hostname, this.wsProtocol);
      
      // Start chat interface
      await this.startChatInterface();
      
    } catch (error) {
      console.error(chalk.red('❌ Application error:'), error.message);
      process.exit(1);
    }
  }

  showWelcome() {
    console.log(
      boxen(
        chalk.cyan.bold('Welcome to BizChat!') + '\n\n' +
        chalk.gray('Connect to chat rooms from your terminal'),
        {
          padding: 1,
          margin: 1,
          borderStyle: 'round',
          borderColor: 'cyan',
          textAlignment: 'center'
        }
      )
    );
  }

  async gatherRoomInput() {
    // Room name prompt if no room specified
    if (!this.roomname) {
      const { roomname } = await inquirer.prompt([
        {
          type: 'input',
          name: 'roomname',
          message: 'Enter room name to join:',
          validate: (input) => {
            if (!input.trim()) return 'Room name cannot be empty';
            if (input.length > 32) return 'Room name must be 32 characters or less';
            return true;
          }
        }
      ]);
      
      this.roomname = roomname;
    }
  }

  async startChatInterface() {
    console.log('\n' + chalk.green('🚀 Starting chat interface...\n'));
    
    // Add process-level signal handlers for graceful shutdown
    process.on('SIGINT', () => {
      if (this.ui) {
        this.ui.cleanup();
      }
      if (this.wsClient) {
        this.wsClient.disconnect();
      }
      process.exit(0);
    });
    
    // Small delay to let console messages settle
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Initialize UI
    this.ui = new UserInterface();
    
    // Check for updates in the background and show in UI if available
    if (this.updateChecker) {
      this.checkForUpdatesInBackground();
    }
    
    // Setup WebSocket connection
    this.wsClient.on('connected', () => {
      this.ui.setStatus(`Connected to room: ${this.roomname}`);
      this.ui.addSystemMessage(`👋 Joined room: ${this.roomname}`);
    });

    this.wsClient.on('disconnected', (reason) => {
      this.ui.setStatus('Disconnected');
      this.ui.addSystemMessage(`🔌 Disconnected: ${reason || 'Unknown reason'}`);
    });

    this.wsClient.on('error', (error) => {
      this.ui.addErrorMessage(`❌ Error: ${error}`);
    });

    this.wsClient.on('message', (data) => {
      if (data.name && data.message) {
        this.ui.addChatMessage(data.name, data.message, data.timestamp);
      }
    });

    this.wsClient.on('ready', (data) => {
      this.ui.addSystemMessage('⚠️  WARNING: Participants are random internet users.');
      this.ui.addSystemMessage(`👋 Welcome to #${this.roomname}. Say hi!`);
    });

    this.wsClient.on('userJoined', (username) => {
      this.ui.addUser(username);
      this.ui.addSystemMessage(`➕ ${username} joined`);
    });

    this.wsClient.on('userLeft', (username) => {
      this.ui.removeUser(username);
      this.ui.addSystemMessage(`➖ ${username} left`);
    });

    // Handle user input
    this.ui.on('message', (message) => {
      if (this.wsClient.isConnected()) {
        this.wsClient.sendMessage(message);
      }
    });

    this.ui.on('quit', () => {
      if (this.wsClient) {
        this.wsClient.disconnect();
      }
      process.exit(0);
    });

    // Connect to WebSocket
    try {
      await this.wsClient.connect(this.roomname, this.username);
    } catch (error) {
      console.error(chalk.red('❌ Failed to connect:'), error.message);
      process.exit(1);
    }
    
    // Start UI after successful connection
    this.ui.start();
    
    // Keep the process alive
    return new Promise(() => {
      // This promise never resolves, keeping the process running
    });
  }

  async checkForUpdatesInBackground() {
    try {
      // First check for cached updates
      const cachedUpdate = this.updateChecker.getCachedUpdate();
      if (cachedUpdate && cachedUpdate.hasUpdate) {
        this.showUpdateInUI(cachedUpdate);
        return;
      }

      // Then do async check for new updates
      const updateInfo = await this.updateChecker.checkForUpdatesAsync();
      if (updateInfo && updateInfo.hasUpdate) {
        this.showUpdateInUI(updateInfo);
      }
    } catch (error) {
      // Silently ignore update check errors in the UI
    }
  }

  showUpdateInUI(updateInfo) {
    if (this.ui && updateInfo && updateInfo.hasUpdate) {
      // Add an info message about the update
      this.ui.addInfoMessage(
        `🚀 Update available: v${updateInfo.latestVersion} (current: v${updateInfo.currentVersion}). Run 'npm install -g bizchat' to update.`
      );
      
      // Update status to show update is available
      const updateStatus = this.updateChecker.getUpdateStatusMessage(updateInfo);
      if (updateStatus) {
        this.ui.setUpdateStatus(updateStatus);
      }
    }
  }

  handleWebSocketMessage(data) {
    if (data.name && data.message) {
      this.ui.addChatMessage(data.name, data.message, data.timestamp);
    }
  }
} 