# BizChat CLI Configuration

BizChat CLI supports global configuration management, similar to git's global config system. This allows you to set your preferences once and use them across all chat sessions.

## Quick Start

1. **Set your global username** (required):
   ```bash
   bizchat config --set-username your-username
   ```

2. **Start chatting**:
   ```bash
   bizchat chat -r room-name
   ```
   or simply:
   ```bash
   bizchat -r room-name
   ```

## Configuration Commands

### Set Username
```bash
bizchat config --set-username <username>
```
Sets your global username. This will be used automatically in all chat sessions unless overridden.

### Get Current Username
```bash
bizchat config --get-username
```
Shows your currently configured global username.

### List All Configuration
```bash
bizchat config --list
```
Shows all your current configuration settings and the config file location.

### Clear Configuration
```bash
bizchat config --clear
```
Removes all configuration settings.

## Chat Commands

### Start Chat Session
```bash
bizchat chat [options]
```

**Options:**
- `-h, --host <host>` - Chat server hostname (default: localhost:8787)
- `-u, --username <username>` - Override global username for this session
- `-r, --room <room>` - Room to join

### Examples

```bash
# Use global username, prompt for room
bizchat chat

# Use global username, join specific room
bizchat chat -r general

# Override username for this session
bizchat chat -u temp-user -r test-room

# Connect to different server
bizchat chat -h chat.example.com -r lobby
```

## Configuration File

Your configuration is stored in `~/.bizchat/config.json`. You can view its location with:
```bash
bizchat config --list
```

The configuration file contains:
```json
{
  "username": "your-username"
}
```

## First Time Setup

When you run BizChat CLI for the first time without a configured username, you'll see:

```
⚠️  No username configured!
Set up your global username first:
  bizchat config --set-username <your-username>

Or provide username with: bizchat chat -u <username>
```

Simply follow the instructions to set up your global username, and you're ready to chat!

## Legacy Support

For backward compatibility, you can still use the old command format:
```bash
bizchat -u username -r room-name
```

This will work the same as:
```bash
bizchat chat -u username -r room-name
``` 