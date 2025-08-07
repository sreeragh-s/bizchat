#!/usr/bin/env node

import { program } from 'commander';
import chalk from 'chalk';
import figlet from 'figlet';
import gradient from 'gradient-string';
import { ChatApp } from './src/ChatApp.js';
import { ConfigManager } from './src/ConfigManager.js';

// ASCII Art Header
console.log(
  gradient.rainbow(
    figlet.textSync('BizChat CLI', {
      font: 'Small',
      horizontalLayout: 'default',
      verticalLayout: 'default'
    })
  )
);

console.log(chalk.cyan.bold('\n🚀 Terminal-based chat client for workers-chat\n'));

const configManager = new ConfigManager();

// Set program info
program
  .name('bizchat')
  .description('CLI client for workers-chat')
  .version('1.0.0');

// Config command
program
  .command('config')
  .description('Manage global configuration')
  .option('--set-username <username>', 'set global username')
  .option('--get-username', 'get current global username')
  .option('--list', 'list all configuration')
  .option('--clear', 'clear all configuration')
  .action((options) => {
    if (options.setUsername) {
      if (options.setUsername.length > 32) {
        console.error(chalk.red('❌ Username must be 32 characters or less'));
        process.exit(1);
      }
      if (configManager.setUsername(options.setUsername)) {
        console.log(chalk.green(`✅ Username set to: ${options.setUsername}`));
        console.log(chalk.gray(`Config saved to: ${configManager.getConfigPath()}`));
      } else {
        console.error(chalk.red('❌ Failed to save username'));
        process.exit(1);
      }
    } else if (options.getUsername) {
      const username = configManager.getUsername();
      if (username) {
        console.log(chalk.green(`Current username: ${username}`));
      } else {
        console.log(chalk.yellow('No username configured'));
        console.log(chalk.gray('Use: bizchat config --set-username <username>'));
      }
    } else if (options.list) {
      const config = configManager.getAllConfig();
      if (Object.keys(config).length === 0) {
        console.log(chalk.yellow('No configuration found'));
      } else {
        console.log(chalk.cyan('Current configuration:'));
        for (const [key, value] of Object.entries(config)) {
          console.log(chalk.gray(`  ${key}: ${value}`));
        }
      }
      console.log(chalk.gray(`\nConfig file: ${configManager.getConfigPath()}`));
    } else if (options.clear) {
      if (configManager.clearConfig()) {
        console.log(chalk.green('✅ Configuration cleared'));
      } else {
        console.error(chalk.red('❌ Failed to clear configuration'));
        process.exit(1);
      }
    } else {
      console.log(chalk.yellow('No config option specified. Use --help for available options.'));
    }
  });

// Main chat command
program
  .command('chat', { isDefault: true })
  .description('Start chat session')
  .option('-h, --host <host>', 'chat server hostname', 'localhost:8787')
  .option('-u, --username <username>', 'your username (overrides global config)')
  .option('-r, --room <room>', 'room to join')
  .action(async (options) => {
    try {
      // Check for global username if not provided
      if (!options.username) {
        const globalUsername = configManager.getUsername();
        if (globalUsername) {
          options.username = globalUsername;
          console.log(chalk.gray(`Using global username: ${globalUsername}`));
        } else {
          console.log(chalk.yellow('⚠️  No username configured!'));
          console.log(chalk.white('Set up your global username first:'));
          console.log(chalk.cyan('  bizchat config --set-username <your-username>'));
          console.log(chalk.gray('\nOr provide username with: bizchat chat -u <username>'));
          process.exit(1);
        }
      }

      const app = new ChatApp(options);
      await app.start();
    } catch (error) {
      console.error(chalk.red('❌ Fatal error:'), error.message);
      process.exit(1);
    }
  });



// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log(chalk.yellow('\n👋 Thanks for using BizChat CLI!'));
  process.exit(0);
});

process.on('SIGTERM', () => {
  process.exit(0);
});

program.parse(); 