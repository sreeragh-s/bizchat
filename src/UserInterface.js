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
    this.updateStatus = null; // New property for update status
    this.isActive = false;
    this.maxMessages = 500;
    this.inputMode = false;
    
    // New simplified scrolling state
    this.viewMode = 'normal'; // 'normal' or 'scrolling'
    this.scrollPosition = 0; // Number of messages from the bottom (0 = bottom, 1 = one message up, etc.)
    
    // User suggestion state
    this.showingSuggestions = false;
    this.userSuggestions = [];
    this.selectedSuggestionIndex = 0;
    this.lastAtIndex = -1;
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
        // When resizing, ensure we stay at the bottom if we were in normal mode
        // or preserve scroll position appropriately
        if (this.viewMode === 'normal') {
          this.scrollToBottom();
        } else {
          // Adjust scroll position to account for new terminal size
          this.adjustScrollPositionForResize();
        }
        this.render();
      }
    });
  }

  // New method to handle scroll position adjustment on resize
  adjustScrollPositionForResize() {
    const maxScroll = Math.max(0, this.messages.length - this.getVisibleMessageCount());
    // Ensure scroll position doesn't exceed the new maximum
    this.scrollPosition = Math.min(this.scrollPosition, maxScroll);
    
    // If scroll position becomes 0, switch back to normal mode
    if (this.scrollPosition === 0) {
      this.viewMode = 'normal';
    }
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
      
      // Handle quit keys
      if (name === 'ESCAPE' || name === 'CTRL_C') {
        this.cleanup();
        this.emit('quit');
        return;
      }
      
      // Handle scrolling keys
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

  // New simplified scroll methods
  scrollUp() {
    const maxScroll = Math.max(0, this.messages.length - this.getVisibleMessageCount());
    if (this.scrollPosition < maxScroll) {
      this.scrollPosition++;
      this.viewMode = 'scrolling';
      this.render();
    }
  }

  scrollDown() {
    if (this.scrollPosition > 0) {
      this.scrollPosition--;
      if (this.scrollPosition === 0) {
        this.viewMode = 'normal';
      }
      this.render();
    }
  }

  scrollPageUp() {
    const pageSize = Math.max(1, this.getVisibleMessageCount() - 1);
    const maxScroll = Math.max(0, this.messages.length - this.getVisibleMessageCount());
    this.scrollPosition = Math.min(maxScroll, this.scrollPosition + pageSize);
    this.viewMode = 'scrolling';
    this.render();
  }

  scrollPageDown() {
    const pageSize = Math.max(1, this.getVisibleMessageCount() - 1);
    this.scrollPosition = Math.max(0, this.scrollPosition - pageSize);
    if (this.scrollPosition === 0) {
      this.viewMode = 'normal';
    }
    this.render();
  }

  scrollToTop() {
    const maxScroll = Math.max(0, this.messages.length - this.getVisibleMessageCount());
    this.scrollPosition = maxScroll;
    this.viewMode = 'scrolling';
    this.render();
  }

  scrollToBottom() {
    this.scrollPosition = 0;
    this.viewMode = 'normal';
    this.render();
  }

  // Calculate how many messages can fit in the display area
  getVisibleMessageCount() {
    const { height } = term;
    const headerHeight = this.updateStatus ? 4 : 3;
    const inputHeight = 3;
    const contentHeight = height - headerHeight - inputHeight;
    const messageDisplayHeight = contentHeight - 2; // Subtract for messages header and border
    
    // Ensure we have at least minimal space for messages
    if (messageDisplayHeight < 1) {
      return 1; // Always allow at least one message
    }
    
    // More conservative estimate for small terminals
    // Use 1.5 lines per message average instead of 2 for better space utilization
    const avgLinesPerMessage = messageDisplayHeight < 10 ? 1.2 : 1.5;
    return Math.max(1, Math.floor(messageDisplayHeight / avgLinesPerMessage));
  }

  // Calculate which messages should be displayed
  getMessagesToDisplay() {
    const totalMessages = this.messages.length;
    
    // For very small terminals or when we have few messages, show all messages
    if (totalMessages === 0) {
      return [];
    }
    
    // Calculate how many lines we actually have available for message content
    const { height } = term;
    const headerHeight = this.updateStatus ? 4 : 3;
    const inputHeight = 3;
    const contentHeight = height - headerHeight - inputHeight;
    const messageDisplayHeight = Math.max(1, contentHeight - 2);
    
    if (this.viewMode === 'normal' || this.scrollPosition === 0) {
      // Show the most recent messages, but ensure we always include the latest message
      // Calculate how many messages we can reasonably fit
      const estimatedVisibleCount = this.getVisibleMessageCount();
      
      // Always include at least the last message, even in very small terminals
      const minMessages = 1;
      const maxMessages = Math.max(minMessages, estimatedVisibleCount);
      
      const startIndex = Math.max(0, totalMessages - maxMessages);
      return this.messages.slice(startIndex);
    } else {
      // Show messages based on scroll position
      const estimatedVisibleCount = this.getVisibleMessageCount();
      const endIndex = totalMessages - this.scrollPosition;
      const startIndex = Math.max(0, endIndex - estimatedVisibleCount);
      return this.messages.slice(startIndex, endIndex);
    }
  }

  stripAnsiCodes(str) {
    // Remove ANSI color codes for accurate length calculation
    return str.replace(/\u001b\[[0-9;]*m/g, '');
  }
  
  async startInputLoop() {
    // Add process-level signal handlers for Ctrl+C
    process.on('SIGINT', () => {
      this.cleanup();
      this.emit('quit');
    });
    
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
          cancelable: true,
          autoComplete: (input) => this.handleAutoComplete(input),
          autoCompleteHint: true,
          autoCompleteMenu: true
        }).promise;
        
        if (result && result.trim()) {
          const message = result.trim();
          this.emit('message', message);
          
          // Clear input and immediately show the message as pending
          this.currentInput = '';
          this.addPendingMessage(message);
          this.updateInputDisplay();
          
          // Auto-scroll to bottom when sending a message
          this.scrollToBottom();
          this.render();
        }
        
      } catch (error) {
        // Handle cancellation or errors
        if (error.message && (error.message.includes('cancel') || error.message.includes('interrupt'))) {
          this.cleanup();
          this.emit('quit');
          break;
        }
      }
    }
  }

  handleAutoComplete(input) {
    if (!input) return [];

    const lastAtIndex = input.lastIndexOf('@');
    if (lastAtIndex === -1) return [];

    const searchTerm = input.slice(lastAtIndex + 1).toLowerCase();
    const usersList = Array.from(this.users);
    
    return usersList
      .filter(user => user.toLowerCase().startsWith(searchTerm))
      .map(user => input.slice(0, lastAtIndex + 1) + user);
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
  }

  renderHeader() {
    const { width } = term;
    let headerHeight = 3;
    
    // Status bar
    term.moveTo(1, 1);
    term.bgBlue.white(`${' '.repeat(width)}`);
    term.moveTo(1, 1);
    term.bgBlue.white(` Status: ${this.status}`);
    term.moveTo(width - 20, 1);
    term.bgBlue.white(`Users: ${this.users.size} `);
    
    // Update status bar (if update is available)
    if (this.updateStatus) {
      term.moveTo(1, 2);
      term.bgYellow.black(`${' '.repeat(width)}`);
      term.moveTo(1, 2);
      term.bgYellow.black(` 🚀 ${this.updateStatus}`);
      headerHeight = 4;
    }
    
    // Border
    term.moveTo(1, headerHeight - 1);
    term.cyan('─'.repeat(width));
  }

  renderMainContent() {
    const { width, height } = term;
    const headerHeight = this.updateStatus ? 4 : 3;
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
    if (this.viewMode === 'scrolling' && this.scrollPosition > 0) {
      term.moveTo(x + width - 20, y);
      term.yellow(`↑${this.scrollPosition} messages`);
    }
    
    term.moveTo(x, y + 1);
    term.cyan('─'.repeat(width - 1));
    
    // Display messages
    const startY = y + 2;
    const messageDisplayHeight = height - 2;
    const maxLineWidth = width - 2;
    
    // Get messages to display based on current scroll position
    const messagesToShow = this.getMessagesToDisplay();
    
    let currentY = startY;
    const maxY = startY + messageDisplayHeight - 1;
    
    // If we're in normal mode and running out of space, prioritize recent messages
    if (this.viewMode === 'normal' && messagesToShow.length > 0) {
      // For very small terminals, render from the end backwards to ensure
      // the most recent message is always visible
      const reversedMessages = [...messagesToShow].reverse();
      const renderedLines = [];
      
      // First pass: calculate all message lines
      for (const message of reversedMessages) {
        const messageLines = this.formatMessageToLines(message, maxLineWidth);
        renderedLines.unshift(...messageLines);
      }
      
      // Second pass: render lines, prioritizing the most recent
      const availableLines = maxY - startY + 1;
      const linesToRender = renderedLines.slice(-availableLines);
      
      for (let i = 0; i < linesToRender.length && currentY <= maxY; i++) {
        term.moveTo(x, currentY);
        term(linesToRender[i]);
        currentY++;
      }
    } else {
      // Normal rendering for scrolling mode or when we have plenty of space
      for (const message of messagesToShow) {
        if (currentY > maxY) break;
        
        const messageLines = this.formatMessageToLines(message, maxLineWidth);
        
        for (const line of messageLines) {
          if (currentY > maxY) break;
          
          term.moveTo(x, currentY);
          term(line);
          currentY++;
        }
      }
    }
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
      case 'pending':
        content = `${chalk.yellow.bold(msg.name)}: ${chalk.gray(msg.text)} ${chalk.gray('(sending...)')}`;
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
    
    // Help text with scroll instructions and @ mention hint
    term.moveTo(1, height - 1);
    term.gray('Type and press ENTER • ↑↓ PgUp/PgDn Home/End to scroll • @ for mentions • ESC/Ctrl+C to quit');
    
    // Update input display
    this.updateInputDisplay();
  }

  addPendingMessage(text) {
    // Add a temporary pending message that will be replaced by the server response
    const pendingMessage = {
      type: 'pending',
      text,
      timestamp: new Date().toLocaleTimeString(),
      name: 'You',  // Keep as 'You' for display consistency
      id: Date.now() // Add unique ID to track this message
    };
    
    this.messages.push(pendingMessage);
    this.trimMessages();
    // Auto-scroll to bottom when adding pending message
    this.scrollToBottom();
    this.render();
  }

  addChatMessage(name, text, timestamp) {
    // Find and remove the most recent pending message if it exists and matches
    // Look for pending messages with matching text (regardless of name for better matching)
    let pendingIndex = -1;
    for (let i = this.messages.length - 1; i >= 0; i--) {
      if (this.messages[i].type === 'pending' && this.messages[i].text === text) {
        pendingIndex = i;
        break; // Found the most recent matching pending message
      }
    }

    if (pendingIndex !== -1) {
      // Replace the pending message with the confirmed one
      const time = timestamp ? new Date(timestamp).toLocaleTimeString() : new Date().toLocaleTimeString();
      this.messages[pendingIndex] = {
        type: 'chat',
        name,
        text,
        timestamp: time
      };
    } else {
      // If no pending message found, add as new message
      const time = timestamp ? new Date(timestamp).toLocaleTimeString() : new Date().toLocaleTimeString();
      this.messages.push({
        type: 'chat',
        name,
        text,
        timestamp: time
      });
    }
    
    this.trimMessages();
    
    // Only auto-scroll to bottom if we're currently at the bottom
    if (this.viewMode === 'normal') {
      this.render();
    } else {
      // If we're scrolled up, just render without changing scroll position
      this.render();
    }
  }

  addSystemMessage(text) {
    const systemMessage = {
      type: 'system',
      text,
      timestamp: new Date().toLocaleTimeString()
    };
    
    this.messages.push(systemMessage);
    this.trimMessages();
    
    // Always render after adding a system message
    this.render();
  }

  addErrorMessage(text) {
    this.messages.push({
      type: 'error',
      text,
      timestamp: new Date().toLocaleTimeString()
    });
    
    this.trimMessages();
    
    // Auto-scroll to bottom for error messages only if we're currently at bottom
    if (this.viewMode === 'normal') {
      this.render();
    } else {
      this.render();
    }
  }

  addInfoMessage(text) {
    this.messages.push({
      type: 'info',
      text,
      timestamp: new Date().toLocaleTimeString()
    });
    
    this.trimMessages();
    
    // Auto-scroll to bottom for info messages only if we're currently at bottom
    if (this.viewMode === 'normal') {
      this.render();
    } else {
      this.render();
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

  setUpdateStatus(updateStatus) {
    this.updateStatus = updateStatus;
    this.render();
  }

  trimMessages() {
    if (this.messages.length > this.maxMessages) {
      const removed = this.messages.length - this.maxMessages;
      this.messages = this.messages.slice(-this.maxMessages);
      
      // Adjust scroll position if needed
      if (this.scrollPosition > 0) {
        this.scrollPosition = Math.max(0, this.scrollPosition - removed);
        if (this.scrollPosition === 0) {
          this.viewMode = 'normal';
        }
      }
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
    
    // Clear screen and reset terminal
    term.clear();
    term.moveTo(1, 1);
    term.hideCursor(false); // Show cursor on cleanup
    term.styleReset();
    
    // Reset process handlers
    try {
      process.removeAllListeners('SIGINT');
    } catch (e) {
      // Ignore errors during cleanup
    }
    
    // Graceful exit message
    console.log('\n👋 Thanks for using BizChat CLI!');
  }
} 