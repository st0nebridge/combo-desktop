/**
 * Integration tests for the Instance Manager service
 * 
 * These tests validate the Instance Manager's interaction with:
 * - The file system for lock and PID file management
 * - The network for IPC communication
 * - Multiple instances of the application
 */

const path = require('path');
const fs = require('fs-extra');
const os = require('os');
const net = require('net');
const { spawn } = require('child_process');
const electronMock = require('../electron-mock');
const lockfile = require('proper-lockfile');

// Create a temporary test directory
const TEST_DIR = path.join(os.tmpdir(), 'combo-desktop-test-' + Date.now());
fs.mkdirpSync(TEST_DIR);

// Mock Electron
jest.mock('electron', () => electronMock);
electronMock.app.getPath.mockImplementation(type => {
  if (type === 'userData') return TEST_DIR;
  return '';
});

// Initialize test environment
let instanceManager;
let secondInstanceManager;

describe('InstanceManager Integration', () => {
  beforeAll(() => {
    // Create test directory
    fs.mkdirpSync(TEST_DIR);
    
    // Use real fs for integration tests
    jest.unmock('fs');
    jest.unmock('net');
    jest.unmock('proper-lockfile');
    jest.unmock('child_process');
  });
  
  afterAll(() => {
    // Clean up test directory
    fs.removeSync(TEST_DIR);
  });
  
  beforeEach(() => {
    // Reset modules
    jest.resetModules();
    
    // Re-require the instance manager
    instanceManager = require('../../src/services/instance.manager');
  });
  
  afterEach(async () => {
    // Clean up IPC server and intervals
    if (instanceManager.ipcServer) {
      instanceManager.ipcServer.close();
    }
    if (instanceManager.heartbeatInterval) {
      clearInterval(instanceManager.heartbeatInterval);
    }
    if (instanceManager.staleCheckInterval) {
      clearInterval(instanceManager.staleCheckInterval);
    }
    if (instanceManager.ipcHealthCheckInterval) {
      clearInterval(instanceManager.ipcHealthCheckInterval);
    }
    
    // Clean up second instance if it exists
    if (secondInstanceManager) {
      if (secondInstanceManager.ipcServer) {
        secondInstanceManager.ipcServer.close();
      }
      if (secondInstanceManager.heartbeatInterval) {
        clearInterval(secondInstanceManager.heartbeatInterval);
      }
      if (secondInstanceManager.staleCheckInterval) {
        clearInterval(secondInstanceManager.staleCheckInterval);
      }
      if (secondInstanceManager.ipcHealthCheckInterval) {
        clearInterval(secondInstanceManager.ipcHealthCheckInterval);
      }
      secondInstanceManager = null;
    }
    
    // Release locks and clean up
    try {
      await instanceManager.cleanup();
    } catch (error) {
      console.error('Error cleaning up instance manager:', error);
    }
    
    // Clean up lock files
    try {
      const lockFilePath = path.join(TEST_DIR, 'instance.lock');
      if (fs.existsSync(lockFilePath)) {
        fs.unlinkSync(lockFilePath);
      }
      const pidFilePath = path.join(TEST_DIR, 'instance.pid');
      if (fs.existsSync(pidFilePath)) {
        fs.unlinkSync(pidFilePath);
      }
    } catch (error) {
      console.error('Error cleaning up test files:', error);
    }
  });
  
  test('should initialize as first instance', async () => {
    // Act
    await instanceManager.initialize();
    
    // Assert
    expect(instanceManager.isFirstInstance).toBe(true);
    expect(instanceManager.instanceId).not.toBeNull();
    
    // Verify lock file creation
    const lockFilePath = path.join(TEST_DIR, 'instance.lock');
    expect(fs.existsSync(lockFilePath)).toBe(true);
    
    // Verify PID file creation
    const pidFilePath = path.join(TEST_DIR, 'instance.pid');
    expect(fs.existsSync(pidFilePath)).toBe(true);
  });
  
  test('should properly handle IPC communication between instances', async () => {
    // Skip this test if we can't run real processes
    if (process.env.SKIP_PROCESS_TESTS) {
      return;
    }
    
    // Arrange - Start first instance
    await instanceManager.initialize();
    expect(instanceManager.isFirstInstance).toBe(true);
    
    // Set up a test IPC handler
    let receivedCommand = null;
    instanceManager.handleIpcCommand = (command, data, socket) => {
      receivedCommand = { command, data };
      socket.write(JSON.stringify({ status: 'ok', result: 'test-response' }));
    };
    
    // Act - Send IPC command
    const result = await instanceManager.delegateCommandToInstance(
      instanceManager.instanceId,
      'test-command',
      { testData: 'test-value' }
    );
    
    // Assert
    expect(receivedCommand).not.toBeNull();
    expect(receivedCommand.command).toBe('test-command');
    expect(receivedCommand.data.testData).toBe('test-value');
    expect(result.status).toBe('ok');
    expect(result.result).toBe('test-response');
  });
  
  test('should detect and recover from stale instances', async () => {
    // Skip this test in CI environments that can't handle file locks properly
    if (process.env.CI) {
      return;
    }
    
    // Arrange - Create a fake stale instance in the lock file
    const lockFilePath = path.join(TEST_DIR, 'instance.lock');
    
    // Create a stale instance entry
    const staleInstanceData = {
      instances: {
        'stale-test-instance': {
          pid: 9999, // Non-existent PID
          lastHeartbeat: Date.now() - 600000, // 10 minutes ago
          startTime: Date.now() - 3600000, // 1 hour ago
          pipeName: '\\\\?\\pipe\\test-9999'
        }
      }
    };
    
    // Write the fake stale instance data
    fs.writeFileSync(lockFilePath, JSON.stringify(staleInstanceData, null, 2));
    
    // Act - Initialize instance manager which should detect and clean up the stale instance
    await instanceManager.initialize();
    await instanceManager.detectAndCleanupStaleInstances();
    
    // Assert - The stale instance should be removed from the lock file
    const lockFileContent = JSON.parse(fs.readFileSync(lockFilePath, 'utf8'));
    expect(lockFileContent.instances['stale-test-instance']).toBeUndefined();
    
    // There should be cleanup history in the lock file
    expect(lockFileContent.cleanupHistory).toBeDefined();
    expect(lockFileContent.cleanupHistory.length).toBeGreaterThan(0);
    expect(lockFileContent.cleanupHistory[0].instanceId).toBe('stale-test-instance');
  });
  
  test('should handle transaction operations atomically', async () => {
    // Arrange
    await instanceManager.initialize();
    
    // Create a test file to modify in the transaction
    const testFilePath = path.join(TEST_DIR, 'test-transaction.json');
    const initialData = { value: 1 };
    fs.writeFileSync(testFilePath, JSON.stringify(initialData));
    
    // Act - Create a transaction that will update the test file
    const tx = instanceManager.createInstanceTransaction('test-transaction');
    
    // Add an operation to the transaction
    tx.operations.push(async () => {
      const data = JSON.parse(fs.readFileSync(testFilePath, 'utf8'));
      data.value += 1;
      fs.writeFileSync(testFilePath, JSON.stringify(data));
    });
    
    // Add a second operation
    tx.operations.push(async () => {
      const data = JSON.parse(fs.readFileSync(testFilePath, 'utf8'));
      data.newField = 'test';
      fs.writeFileSync(testFilePath, JSON.stringify(data));
    });
    
    // Execute the transaction
    await tx.commit();
    
    // Assert - The test file should have been modified by both operations
    const finalData = JSON.parse(fs.readFileSync(testFilePath, 'utf8'));
    expect(finalData.value).toBe(2);
    expect(finalData.newField).toBe('test');
  });
  
  test('should rollback transaction on failure', async () => {
    // Arrange
    await instanceManager.initialize();
    
    // Create a test file to modify in the transaction
    const testFilePath = path.join(TEST_DIR, 'test-rollback.json');
    const initialData = { value: 1 };
    fs.writeFileSync(testFilePath, JSON.stringify(initialData));
    
    // Create a backup function for rollback
    const backupFile = () => {
      const data = fs.readFileSync(testFilePath, 'utf8');
      return data;
    };
    
    const restoreFile = (backup) => {
      fs.writeFileSync(testFilePath, backup);
    };
    
    // Act - Create a transaction that will fail
    const tx = instanceManager.createInstanceTransaction('test-transaction');
    
    // Add backup/restore handlers
    const backup = backupFile();
    tx.backups.push({ restore: () => restoreFile(backup) });
    
    // Add an operation that succeeds
    tx.operations.push(async () => {
      const data = JSON.parse(fs.readFileSync(testFilePath, 'utf8'));
      data.value += 1;
      fs.writeFileSync(testFilePath, JSON.stringify(data));
    });
    
    // Add an operation that fails
    tx.operations.push(async () => {
      const data = JSON.parse(fs.readFileSync(testFilePath, 'utf8'));
      data.newField = 'test';
      fs.writeFileSync(testFilePath, JSON.stringify(data));
      throw new Error('Test error');
    });
    
    // Execute the transaction and catch the error
    try {
      await tx.commit();
      fail('Transaction should have failed');
    } catch (error) {
      // Transaction failed as expected
      expect(error.message).toBe('Test error');
    }
    
    // Assert - The test file should be rolled back to its initial state
    const finalData = JSON.parse(fs.readFileSync(testFilePath, 'utf8'));
    expect(finalData.value).toBe(1);
    expect(finalData.newField).toBeUndefined();
  });
});
