import { EventEmitter } from 'events';
import terminalKit from 'terminal-kit';
import chalk from 'chalk';

const term = terminalKit.terminal;

export class UserInterface extends EventEmitter {
  constructor() {
    super();
    this.messages = [];
    this.users = new Set();
    this.currentInput = '';
    this.status = 'Initializing...';
    this.isActive = false;
    this.maxMessages = 500;
    this.inputMode = false;
    
    // Scrolling state
    this.messageScrollOffset = 0; // How many lines scrolled up from bottom
    this.maxScrollOffset = 0;
  }

  start() {
    this.isActive = true;
    this.setupTerminal();
    this.render();
    this.setupInput();
  }

  setupTerminal() {
    // Clear screen and initially hide cursor (will show during input)
    term.clear();
    term.hideCursor(true);
    
    // Handle terminal resize
    term.on('resize', () => {
      if (this.isActive) {
        this.recalculateScrollLimits();
        this.render();
      }
    });
  }

  setupInput() {
    // Create input area at bottom
    this.inputMode = true;
    this.currentInput = '';
    
    // Show cursor for input and render prompt first
    term.hideCursor(false);
    this.renderInputPrompt();
    
    // Setup keyboard event handling
    this.setupKeyboardHandling();
    
    // Use a simpler approach - start the input loop
    this.startInputLoop();
  }

  setupKeyboardHandling() {
    // Enable key grabbing for scroll controls
    term.grabInput(true);
    
    term.on('key', (name, matches, data) => {
      if (!this.isActive) return;
      
      // Handle scrolling keys when not in input mode
      switch (name) {
        case 'UP':
          this.scrollUp();
          break;
        case 'DOWN':
          this.scrollDown();
          break;
        case 'PAGE_UP':
          this.scrollPageUp();
          break;
        case 'PAGE_DOWN':
          this.scrollPageDown();
          break;
        case 'HOME':
          this.scrollToTop();
          break;
        case 'END':
          this.scrollToBottom();
          break;
      }
    });
  }

  scrollUp() {
    if (this.messageScrollOffset < this.maxScrollOffset) {
      this.messageScrollOffset += 1;
      this.render();
    }
  }

  scrollDown() {
    if (this.messageScrollOffset > 0) {
      this.messageScrollOffset -= 1;
      this.render();
    }
  }

  scrollPageUp() {
    const { height } = term;
    const messageAreaHeight = height - 6; // Adjust for headers and input
    const scrollAmount = Math.min(messageAreaHeight - 2, this.maxScrollOffset - this.messageScrollOffset);
    this.messageScrollOffset += scrollAmount;
    this.render();
  }

  scrollPageDown() {
    const { height } = term;
    const messageAreaHeight = height - 6;
    const scrollAmount = Math.min(messageAreaHeight - 2, this.messageScrollOffset);
    this.messageScrollOffset -= scrollAmount;
    this.render();
  }

  scrollToTop() {
    this.messageScrollOffset = this.maxScrollOffset;
    this.render();
  }

  scrollToBottom() {
    this.messageScrollOffset = 0;
    this.render();
  }

  recalculateScrollLimits() {
    const { width, height } = term;
    const headerHeight = 3;
    const inputHeight = 3;
    const contentHeight = height - headerHeight - inputHeight;
    const messageAreaWidth = Math.floor(width * 0.75);
    const messageDisplayHeight = contentHeight - 2;
    
    // Calculate total lines needed for all messages
    let totalLines = 0;
    this.messages.forEach(msg => {
      const lines = this.calculateMessageLines(msg, messageAreaWidth - 2);
      totalLines += lines;
    });
    
    this.maxScrollOffset = Math.max(0, totalLines - messageDisplayHeight);
  }

  calculateMessageLines(msg, maxWidth) {
    const formattedMsg = this.formatMessage(msg, maxWidth, false); // Don't truncate for calculation
    const plainText = this.stripAnsiCodes(formattedMsg);
    return Math.ceil(plainText.length / maxWidth) || 1;
  }

  stripAnsiCodes(str) {
    // Remove ANSI color codes for accurate length calculation
    return str.replace(/\u001b\[[0-9;]*m/g, '');
  }
  
  async startInputLoop() {
    while (this.inputMode && this.isActive) {
      try {
        // Position cursor at input area
        const { width, height } = term;
        const inputY = height - 2;
        const promptText = 'Message: ';
        const inputStartX = promptText.length + 1;
        
        term.moveTo(inputStartX, inputY);
        
        // Use terminal-kit's inputField for proper input handling
        const result = await term.inputField({
          echo: true,
          maxLength: 256,
          cancelable: true
        }).promise;
        
        if (result && result.trim()) {
          this.emit('message', result.trim());
          this.currentInput = '';
          this.updateInputDisplay();
          // Auto-scroll to bottom when sending a message
          this.scrollToBottom();
        }
        
        // Re-render to maintain the UI state
        this.render();
        
      } catch (error) {
        // Handle cancellation or errors
        if (error.message && error.message.includes('cancel')) {
          this.cleanup();
          this.emit('quit');
          break;
        }
      }
    }
  }

  updateInputDisplay() {
    // Clear the input area for fresh display
    const { width, height } = term;
    const inputY = height - 2;
    const promptText = 'Message: ';
    const inputStartX = promptText.length + 1;
    
    // Clear input area
    term.moveTo(inputStartX, inputY);
    term(' '.repeat(width - inputStartX));
    
    // Position cursor for next input
    term.moveTo(inputStartX, inputY);
  }

  render() {
    if (!this.isActive) return;

    const { width, height } = term;
    
    // Clear screen
    term.clear();
    
    // Header
    this.renderHeader();
    
    // Main content area
    this.renderMainContent();
    
    // Input area
    this.renderInputPrompt();
    
    // Recalculate scroll limits after render
    this.recalculateScrollLimits();
  }

  renderHeader() {
    const { width } = term;
    const headerHeight = 3;
    
    // Status bar
    term.moveTo(1, 1);
    term.bgBlue.white(`${' '.repeat(width)}`);
    term.moveTo(1, 1);
    term.bgBlue.white(` Status: ${this.status}`);
    term.moveTo(width - 20, 1);
    term.bgBlue.white(`Users: ${this.users.size} `);
    
    // Border
    term.moveTo(1, 2);
    term.cyan('─'.repeat(width));
  }

  renderMainContent() {
    const { width, height } = term;
    const headerHeight = 3;
    const inputHeight = 3;
    const contentHeight = height - headerHeight - inputHeight;
    const messageAreaWidth = Math.floor(width * 0.75);
    const userAreaWidth = width - messageAreaWidth - 1;
    
    // Messages area
    this.renderMessages(1, headerHeight + 1, messageAreaWidth, contentHeight);
    
    // Users area
    this.renderUsers(messageAreaWidth + 2, headerHeight + 1, userAreaWidth, contentHeight);
    
    // Separator
    term.moveTo(messageAreaWidth + 1, headerHeight + 1);
    for (let i = 0; i < contentHeight; i++) {
      term.moveTo(messageAreaWidth + 1, headerHeight + 1 + i);
      term.cyan('│');
    }
  }

  renderMessages(x, y, width, height) {
    // Messages header
    term.moveTo(x, y);
    term.bold.blue('Messages');
    
    // Scroll indicator
    if (this.messageScrollOffset > 0) {
      term.moveTo(x + width - 15, y);
      term.yellow(`↑${this.messageScrollOffset} lines`);
    }
    
    term.moveTo(x, y + 1);
    term.cyan('─'.repeat(width - 1));
    
    // Display messages with scrolling
    const startY = y + 2;
    const messageDisplayHeight = height - 2;
    
    // Calculate which messages to show based on scroll offset
    const messagesToRender = this.getMessagesForDisplay(messageDisplayHeight, width - 2);
    
    messagesToRender.forEach((line, index) => {
      const lineY = startY + index;
      if (lineY < y + height) {
        term.moveTo(x, lineY);
        term(line);
      }
    });
  }

  getMessagesForDisplay(displayHeight, maxWidth) {
    const allLines = [];
    
    // Convert all messages to display lines
    this.messages.forEach(msg => {
      const lines = this.formatMessageToLines(msg, maxWidth);
      allLines.push(...lines);
    });
    
    // Apply scroll offset
    const totalLines = allLines.length;
    const startIndex = Math.max(0, totalLines - displayHeight - this.messageScrollOffset);
    const endIndex = Math.max(0, totalLines - this.messageScrollOffset);
    
    return allLines.slice(startIndex, endIndex);
  }

  formatMessageToLines(msg, maxWidth) {
    const timestamp = `[${msg.timestamp}]`;
    let content = '';
    
    switch (msg.type) {
      case 'chat':
        content = `${chalk.green.bold(msg.name)}: ${msg.text}`;
        break;
      case 'system':
        content = chalk.gray(msg.text);
        break;
      case 'error':
        content = chalk.red(msg.text);
        break;
      case 'info':
        content = chalk.cyan(msg.text);
        break;
      default:
        content = msg.text;
    }
    
    const fullMessage = `${chalk.gray(timestamp)} ${content}`;
    const plainText = this.stripAnsiCodes(fullMessage);
    
    // If message fits on one line, return it
    if (plainText.length <= maxWidth) {
      return [fullMessage];
    }
    
    // Split into multiple lines preserving colors
    const lines = [];
    const words = content.split(' ');
    let currentLine = `${chalk.gray(timestamp)} `;
    let currentPlainLine = `${timestamp} `;
    
    for (const word of words) {
      const plainWord = this.stripAnsiCodes(word);
      const testLine = currentPlainLine + (currentPlainLine.endsWith(' ') ? '' : ' ') + plainWord;
      
      if (testLine.length <= maxWidth) {
        if (currentLine === `${chalk.gray(timestamp)} `) {
          currentLine += word;
          currentPlainLine += plainWord;
        } else {
          currentLine += ' ' + word;
          currentPlainLine += ' ' + plainWord;
        }
      } else {
        // Line would be too long, start a new line
        if (currentLine.trim() !== `${chalk.gray(timestamp)}`) {
          lines.push(currentLine);
        }
        
        // Start new line with proper indentation
        const indent = ' '.repeat(timestamp.length + 2);
        currentLine = chalk.gray(indent) + word;
        currentPlainLine = indent + plainWord;
      }
    }
    
    // Add the last line
    if (currentLine.trim() !== `${chalk.gray(timestamp)}`) {
      lines.push(currentLine);
    }
    
    return lines.length > 0 ? lines : [fullMessage];
  }

  renderUsers(x, y, width, height) {
    // Users header
    term.moveTo(x, y);
    term.bold.green('Users');
    term.moveTo(x, y + 1);
    term.cyan('─'.repeat(width - 1));
    
    // Display users
    const startY = y + 2;
    const usersList = Array.from(this.users);
    
    usersList.forEach((user, index) => {
      const lineY = startY + index;
      if (lineY < y + height - 1) {
        term.moveTo(x, lineY);
        term.green(`• ${user.substring(0, width - 4)}`);
      }
    });
  }

  renderInputPrompt() {
    const { width, height } = term;
    const inputY = height - 2;
    const promptText = 'Message: ';
    
    // Input border
    term.moveTo(1, inputY - 1);
    term.cyan('─'.repeat(width));
    
    // Input prompt
    term.moveTo(1, inputY);
    term.yellow(promptText);
    
    // Help text with scroll instructions
    term.moveTo(1, height - 1);
    term.gray('Type and press ENTER • ↑↓ PgUp/PgDn Home/End to scroll • ESC/Ctrl+C to quit');
    
    // Update input display
    this.updateInputDisplay();
  }

  formatMessage(msg, maxWidth, allowTruncation = true) {
    const timestamp = `[${msg.timestamp}]`;
    let content = '';
    
    switch (msg.type) {
      case 'chat':
        content = `${chalk.green.bold(msg.name)}: ${msg.text}`;
        break;
      case 'system':
        content = chalk.gray(msg.text);
        break;
      case 'error':
        content = chalk.red(msg.text);
        break;
      case 'info':
        content = chalk.cyan(msg.text);
        break;
      default:
        content = msg.text;
    }
    
    const fullMessage = `${chalk.gray(timestamp)} ${content}`;
    
    // Only truncate if explicitly allowed (for legacy compatibility)
    if (allowTruncation && this.stripAnsiCodes(fullMessage).length > maxWidth) {
      return fullMessage.substring(0, maxWidth - 3) + '...';
    }
    
    return fullMessage;
  }

  addChatMessage(name, text, timestamp) {
    const time = timestamp ? new Date(timestamp).toLocaleTimeString() : new Date().toLocaleTimeString();
    this.messages.push({
      type: 'chat',
      name,
      text,
      timestamp: time
    });
    
    this.trimMessages();
    
    // Auto-scroll to bottom for new messages if already at bottom
    if (this.messageScrollOffset === 0) {
      this.render();
    } else {
      // Just recalculate limits without auto-scroll if user is scrolled up
      this.recalculateScrollLimits();
    }
  }

  addSystemMessage(text) {
    this.messages.push({
      type: 'system',
      text,
      timestamp: new Date().toLocaleTimeString()
    });
    
    this.trimMessages();
    
    // Auto-scroll to bottom for system messages
    if (this.messageScrollOffset === 0) {
      this.render();
    } else {
      this.recalculateScrollLimits();
    }
  }

  addErrorMessage(text) {
    this.messages.push({
      type: 'error',
      text,
      timestamp: new Date().toLocaleTimeString()
    });
    
    this.trimMessages();
    
    // Auto-scroll to bottom for error messages
    if (this.messageScrollOffset === 0) {
      this.render();
    } else {
      this.recalculateScrollLimits();
    }
  }

  addInfoMessage(text) {
    this.messages.push({
      type: 'info',
      text,
      timestamp: new Date().toLocaleTimeString()
    });
    
    this.trimMessages();
    
    // Auto-scroll to bottom for info messages
    if (this.messageScrollOffset === 0) {
      this.render();
    } else {
      this.recalculateScrollLimits();
    }
  }

  addUser(username) {
    this.users.add(username);
    this.render();
  }

  removeUser(username) {
    this.users.delete(username);
    this.render();
  }

  setStatus(status) {
    this.status = status;
    this.render();
  }

  trimMessages() {
    if (this.messages.length > this.maxMessages) {
      this.messages = this.messages.slice(-this.maxMessages);
    }
  }

  cleanup() {
    this.isActive = false;
    this.inputMode = false;
    
    // Release input grabbing
    try {
      term.grabInput(false);
      term.removeAllListeners('key');
      term.removeAllListeners('resize');
    } catch (e) {
      // Ignore errors during cleanup
    }
    
    term.clear();
    term.moveTo(1, 1);
    term.hideCursor(false); // Show cursor on cleanup
    term.styleReset();
  }
} 