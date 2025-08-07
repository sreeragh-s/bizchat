import fs from 'fs';
import path from 'path';
import os from 'os';
import chalk from 'chalk';

export class ConfigManager {
  constructor() {
    this.configDir = path.join(os.homedir(), '.bizchat');
    this.configFile = path.join(this.configDir, 'config.json');
    this.ensureConfigDir();
  }

  ensureConfigDir() {
    if (!fs.existsSync(this.configDir)) {
      fs.mkdirSync(this.configDir, { recursive: true });
    }
  }

  loadConfig() {
    try {
      if (fs.existsSync(this.configFile)) {
        const configData = fs.readFileSync(this.configFile, 'utf8');
        return JSON.parse(configData);
      }
    } catch (error) {
      console.warn(chalk.yellow('⚠️  Warning: Could not load config file, using defaults'));
    }
    return {};
  }

  saveConfig(config) {
    try {
      fs.writeFileSync(this.configFile, JSON.stringify(config, null, 2));
      return true;
    } catch (error) {
      console.error(chalk.red('❌ Error saving config:'), error.message);
      return false;
    }
  }

  getUsername() {
    const config = this.loadConfig();
    return config.username || null;
  }

  setUsername(username) {
    const config = this.loadConfig();
    config.username = username;
    return this.saveConfig(config);
  }

  getConfig(key) {
    const config = this.loadConfig();
    return config[key] || null;
  }

  setConfig(key, value) {
    const config = this.loadConfig();
    config[key] = value;
    return this.saveConfig(config);
  }

  getAllConfig() {
    return this.loadConfig();
  }

  clearConfig() {
    try {
      if (fs.existsSync(this.configFile)) {
        fs.unlinkSync(this.configFile);
        return true;
      }
    } catch (error) {
      console.error(chalk.red('❌ Error clearing config:'), error.message);
      return false;
    }
    return true;
  }

  getConfigPath() {
    return this.configFile;
  }
} 