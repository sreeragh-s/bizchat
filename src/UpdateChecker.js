import fetch from 'node-fetch';
import chalk from 'chalk';
import boxen from 'boxen';
import { ConfigManager } from './ConfigManager.js';

export class UpdateChecker {
  constructor() {
    this.configManager = new ConfigManager();
    this.packageName = 'bizchat';
    this.currentVersion = '2.0.3'; // This should match package.json
    this.checkInterval = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
  }

  /**
   * Check for updates and return npupdate information
   */
  async checkForUpdates() {
    try {
      // Check if we should skip this check based on last check time
      if (this.shouldSkipCheck()) {
        return null;
      }

      const latestVersion = await this.getLatestVersion();
      
      if (latestVersion && this.isNewerVersion(latestVersion, this.currentVersion)) {
        // Save the last check time and available version
        this.updateLastCheckTime();
        this.saveAvailableUpdate(latestVersion);
        
        return {
          hasUpdate: true,
          currentVersion: this.currentVersion,
          latestVersion: latestVersion,
          updateUrl: `https://www.npmjs.com/package/${this.packageName}`
        };
      } else {
        // Update last check time
        this.updateLastCheckTime();
        // Clear any saved update info since we're up to date
        this.clearAvailableUpdate();
        
        return {
          hasUpdate: false,
          currentVersion: this.currentVersion,
          latestVersion: latestVersion || this.currentVersion
        };
      }
    } catch (error) {
      console.error(chalk.gray('⚠️  Could not check for updates:'), error.message);
      return null;
    }
  }

  /**
   * Get the latest version from npm registry
   */
  async getLatestVersion() {
    try {
      const response = await fetch(`https://registry.npmjs.org/${this.packageName}/latest`, {
        timeout: 5000,
        headers: {
          'User-Agent': `${this.packageName}/${this.currentVersion} update-checker`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data.version;
    } catch (error) {
      throw new Error(`Failed to fetch version info: ${error.message}`);
    }
  }

  /**
   * Compare two version strings (simple semver comparison)
   */
  isNewerVersion(latest, current) {
    const latestParts = latest.split('.').map(Number);
    const currentParts = current.split('.').map(Number);

    for (let i = 0; i < Math.max(latestParts.length, currentParts.length); i++) {
      const latestPart = latestParts[i] || 0;
      const currentPart = currentParts[i] || 0;

      if (latestPart > currentPart) {
        return true;
      } else if (latestPart < currentPart) {
        return false;
      }
    }

    return false;
  }

  /**
   * Check if we should skip the update check based on last check time
   */
  shouldSkipCheck() {
    const lastCheck = this.configManager.getConfig('lastUpdateCheck');
    if (!lastCheck) {
      return false;
    }

    const lastCheckTime = new Date(lastCheck);
    const now = new Date();
    const timeDiff = now.getTime() - lastCheckTime.getTime();

    return timeDiff < this.checkInterval;
  }

  /**
   * Update the last check time in config
   */
  updateLastCheckTime() {
    this.configManager.setConfig('lastUpdateCheck', new Date().toISOString());
  }

  /**
   * Save available update information
   */
  saveAvailableUpdate(version) {
    this.configManager.setConfig('availableUpdate', version);
  }

  /**
   * Clear available update information
   */
  clearAvailableUpdate() {
    this.configManager.setConfig('availableUpdate', null);
  }

  /**
   * Get cached available update information
   */
  getCachedUpdate() {
    const availableUpdate = this.configManager.getConfig('availableUpdate');
    if (availableUpdate && this.isNewerVersion(availableUpdate, this.currentVersion)) {
      return {
        hasUpdate: true,
        currentVersion: this.currentVersion,
        latestVersion: availableUpdate,
        updateUrl: `https://www.npmjs.com/package/${this.packageName}`
      };
    }
    return null;
  }

  /**
   * Display update notification in the terminal
   */
  displayUpdateNotification(updateInfo) {
    if (!updateInfo || !updateInfo.hasUpdate) {
      return;
    }

    const notification = boxen(
      chalk.yellow.bold('🚀 Update Available!') + '\n\n' +
      chalk.white(`Current version: ${chalk.cyan(updateInfo.currentVersion)}\n`) +
      chalk.white(`Latest version:  ${chalk.green.bold(updateInfo.latestVersion)}\n\n`) +
      chalk.white('Update with: ') + chalk.cyan.bold('npm install -g bizchat') + '\n' +
      chalk.gray(`More info: ${updateInfo.updateUrl}`),
      {
        padding: 1,
        margin: 1,
        borderStyle: 'round',
        borderColor: 'yellow',
        textAlignment: 'left'
      }
    );

    console.log('\n' + notification);
  }

  /**
   * Display a subtle update reminder in the UI
   */
  getUpdateStatusMessage(updateInfo) {
    if (!updateInfo || !updateInfo.hasUpdate) {
      return null;
    }

    return `Update available: v${updateInfo.latestVersion} (current: v${updateInfo.currentVersion})`;
  }

  /**
   * Check for updates silently and return cached result
   */
  async checkForUpdatesAsync() {
    try {
      // Try to get cached update first
      const cachedUpdate = this.getCachedUpdate();
      if (cachedUpdate) {
        return cachedUpdate;
      }

      // If no cached update and we should check, do async check
      if (!this.shouldSkipCheck()) {
        // Run update check in background without blocking
        this.checkForUpdates().catch(() => {
          // Silently ignore errors in background check
        });
      }

      return null;
    } catch (error) {
      // Silently ignore errors
      return null;
    }
  }
} 