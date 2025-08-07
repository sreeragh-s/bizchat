# BizChat CLI

A modern terminal-based chat client for workers-chat.

## Features

- 🌐 Join public chat rooms
- 🔒 Create private, password-protected rooms
- 💬 Real-time messaging with WebSocket connection
- 👥 Live user roster
- 🎨 Beautiful terminal UI with colors and borders
- ⌨️ Full keyboard navigation
- 🔄 Automatic reconnection on connection loss
- 📱 Responsive design that adapts to terminal size

## Installation

```bash
# Install dependencies
npm install

# Make the CLI executable
chmod +x index.js
```

## Usage

### Interactive Mode (Recommended)

Simply run the CLI and follow the prompts:

```bash
npm start
```

### Command Line Options

You can also provide options directly:

```bash
# Basic usage
node index.js

# Specify username and room
node index.js --username "John" --room "general"

# Join a password-protected room
node index.js --username "John" --room "private-room" --password "secret"

# Use a different server
node index.js --host "myserver.com:8080"
```

### Available Options

- `-u, --username <username>` - Your username
- `-r, --room <room>` - Room to join
- `-p, --password <password>` - Room password (if required)
- `-h, --host <host>` - Chat server hostname (default: localhost:8787)
- `--help` - Show help
- `--version` - Show version

## Controls

### Navigation
- **Arrow Keys (↑↓)** - Navigate menu options (during setup)
- **Enter** - Select option or send message
- **Tab** - Switch between input areas (where applicable)

### Chat Interface
- **Type and Enter** - Send a message
- **ESC** - Go back or quit
- **Ctrl+C** - Quit application

## Room Types

### Public Rooms
- Open to everyone who knows the room name
- No password required
- Messages are visible to all participants

### Private Rooms
- Created with a custom name
- Optionally password-protected
- More secure and controlled access

## Architecture

The CLI is built with a modular architecture:

```
bizchat/
├── index.js                # Main entry point
├── src/
│   ├── ChatApp.js          # Main application orchestrator
│   ├── UserInterface.js    # Terminal UI handling
│   ├── WebSocketClient.js  # WebSocket connection management
│   └── RoomManager.js      # Room creation and management
├── package.json
└── README.md
```

### Key Components

- **ChatApp**: Main application coordinator that manages the flow
- **UserInterface**: Handles all terminal rendering and user input
- **WebSocketClient**: Manages WebSocket connections with auto-reconnect
- **RoomManager**: Handles room creation and password checking

## Dependencies

- **commander**: Command-line argument parsing
- **inquirer**: Interactive command-line prompts
- **chalk**: Terminal string styling
- **ora**: Loading spinners
- **boxen**: Terminal boxes
- **terminal-kit**: Advanced terminal control
- **ws**: WebSocket client
- **node-fetch**: HTTP requests
- **gradient-string**: Gradient text effects
- **figlet**: ASCII art text

## Troubleshooting

### Connection Issues
- Ensure the workers-chat server is running on the specified host
- Check your network connection
- Try connecting to a different room

### Input Problems
- Make sure your terminal supports the required features
- Try resizing your terminal window
- Restart the application if input becomes unresponsive

### Password Issues
- Ensure you're entering the correct password
- Check if the room actually requires a password
- Try creating a new room with a different name

## Development

### Project Structure
- `index.js` - Entry point with CLI argument parsing
- `src/ChatApp.js` - Main application logic
- `src/UserInterface.js` - Terminal UI using terminal-kit
- `src/WebSocketClient.js` - WebSocket handling with EventEmitter
- `src/RoomManager.js` - HTTP API interactions

### Running in Development
```bash
npm run dev
```

### Features Implemented
- ✅ Interactive setup wizard
- ✅ Command-line argument support
- ✅ Real-time chat with WebSocket
- ✅ User roster management
- ✅ Password-protected rooms
- ✅ Auto-reconnection
- ✅ Responsive terminal UI
- ✅ Proper error handling
- ✅ Keyboard navigation

## License

MIT License 