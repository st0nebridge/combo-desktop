/**
 * Unit tests for the Instance Manager service
 */

const path = require('path');
const fs = require('fs-extra');
const electronMock = require('../electron-mock');
const lockfile = require('proper-lockfile');

// Mock dependencies
jest.mock('electron', () => electronMock);
jest.mock('../../src/services/logging.service', () => ({
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));
jest.mock('proper-lockfile');
jest.mock('net');
jest.mock('child_process');
jest.mock('fs');
jest.mock('path');

// Initialize mocks before importing the module
const mockAppPaths = {
  userData: path.join(__dirname, '../fixtures/userData/test')
};
electronMock.app.getPath.mockImplementation(type => mockAppPaths[type] || '');

// Import the module to test
let instanceManager;
let originalDateNow;

describe('InstanceManager', () => {
  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Reset InstanceManager singleton
    jest.resetModules();
    
    // Mock Date.now for predictable heartbeat timestamps
    originalDateNow = Date.now;
    Date.now = jest.fn(() => 1619808000000); // Fixed timestamp
    
    // Re-require the module for each test
    instanceManager = require('../../src/services/instance.manager');
  });

  afterEach(() => {
    // Restore Date.now
    Date.now = originalDateNow;
    
    // Clear intervals
    if (instanceManager.heartbeatInterval) {
      clearInterval(instanceManager.heartbeatInterval);
    }
    if (instanceManager.staleCheckInterval) {
      clearInterval(instanceManager.staleCheckInterval);
    }
    if (instanceManager.ipcHealthCheckInterval) {
      clearInterval(instanceManager.ipcHealthCheckInterval);
    }
  });

  describe('Initialization', () => {
    test('should initialize successfully', async () => {
      // Arrange
      lockfile.check.mockResolvedValue(false);
      fs.existsSync.mockReturnValue(false);
      
      // Act
      await instanceManager.initialize();
      
      // Assert
      expect(instanceManager.instanceId).not.toBeNull();
      expect(instanceManager.isFirstInstance).toBe(true);
    });
    
    test('should detect existing instance', async () => {
      // Arrange
      lockfile.check.mockResolvedValue(true);
      fs.existsSync.mockReturnValue(true);
      
      // Act
      await instanceManager.initialize();
      
      // Assert
      expect(instanceManager.isFirstInstance).toBe(false);
    });
  });

  describe('Lock Management', () => {
    test('should acquire lock successfully', async () => {
      // Arrange
      lockfile.lock.mockResolvedValue(() => Promise.resolve());
      
      // Act
      await instanceManager.acquireLock();
      
      // Assert
      expect(lockfile.lock).toHaveBeenCalled();
      expect(instanceManager.lockRelease).not.toBeNull();
    });
    
    test('should release lock successfully', async () => {
      // Arrange
      const mockRelease = jest.fn().mockResolvedValue(undefined);
      instanceManager.lockRelease = mockRelease;
      
      // Act
      await instanceManager.releaseLock();
      
      // Assert
      expect(mockRelease).toHaveBeenCalled();
      expect(instanceManager.lockRelease).toBeNull();
    });
    
    test('should handle lock release errors gracefully', async () => {
      // Arrange
      const mockRelease = jest.fn().mockRejectedValue(new Error('Lock release error'));
      instanceManager.lockRelease = mockRelease;
      
      // Act
      await instanceManager.releaseLock();
      
      // Assert
      expect(mockRelease).toHaveBeenCalled();
      expect(instanceManager.lockRelease).toBeNull();
    });
  });

  describe('Heartbeat and Stale Instance Detection', () => {
    test('should update heartbeat successfully', async () => {
      // Arrange
      instanceManager.instanceId = 'test-instance';
      instanceManager.acquireLock = jest.fn().mockResolvedValue(undefined);
      instanceManager.releaseLock = jest.fn().mockResolvedValue(undefined);
      fs.readFileSync = jest.fn().mockReturnValue(JSON.stringify({
        instances: {
          'test-instance': { pid: process.pid }
        }
      }));
      fs.writeFileSync = jest.fn();
      
      // Act
      const result = await instanceManager.updateHeartbeat();
      
      // Assert
      expect(result).toBe(true);
      expect(fs.writeFileSync).toHaveBeenCalled();
      expect(instanceManager.acquireLock).toHaveBeenCalled();
      expect(instanceManager.releaseLock).toHaveBeenCalled();
    });
    
    test('should start heartbeat mechanism', () => {
      // Arrange
      instanceManager.updateHeartbeat = jest.fn().mockResolvedValue(true);
      instanceManager.detectAndCleanupStaleInstances = jest.fn().mockResolvedValue([]);
      jest.useFakeTimers();
      
      // Act
      instanceManager.startHeartbeat();
      jest.advanceTimersByTime(30000);
      
      // Assert
      expect(instanceManager.heartbeatInterval).not.toBeNull();
      expect(instanceManager.staleCheckInterval).not.toBeNull();
      expect(instanceManager.updateHeartbeat).toHaveBeenCalled();
    });
    
    test('should detect and cleanup stale instances', async () => {
      // Arrange
      instanceManager.acquireLock = jest.fn().mockResolvedValue(undefined);
      instanceManager.releaseLock = jest.fn().mockResolvedValue(undefined);
      instanceManager.checkInstanceResponsiveness = jest.fn().mockResolvedValue(false);
      
      fs.readFileSync = jest.fn().mockReturnValue(JSON.stringify({
        instances: {
          'stale-instance': {
            pid: 12345,
            lastHeartbeat: Date.now() - 300000 // 5 minutes ago, exceeding threshold
          },
          'active-instance': {
            pid: 67890,
            lastHeartbeat: Date.now() - 10000 // Recently updated
          }
        }
      }));
      fs.writeFileSync = jest.fn();
      
      // Act
      const result = await instanceManager.detectAndCleanupStaleInstances();
      
      // Assert
      expect(result.length).toBe(1);
      expect(result[0]).toBe('stale-instance');
      expect(fs.writeFileSync).toHaveBeenCalled();
    });
  });

  describe('IPC Communication', () => {
    test('should setup IPC server successfully', async () => {
      // Arrange
      const mockServer = {
        listen: jest.fn(),
        on: jest.fn()
      };
      require('net').createServer.mockReturnValue(mockServer);
      
      // Act
      await instanceManager.setupIpcServer();
      
      // Assert
      expect(require('net').createServer).toHaveBeenCalled();
      expect(mockServer.listen).toHaveBeenCalled();
    });
    
    test('should delegate commands to other instances', async () => {
      // Arrange
      const mockSocket = {
        write: jest.fn(),
        on: jest.fn(),
        end: jest.fn()
      };
      require('net').connect.mockImplementation((path, callback) => {
        callback();
        return mockSocket;
      });
      
      // Act
      const result = await instanceManager.delegateCommandToInstance('target-instance', 'test-command', { data: 'test' });
      
      // Assert
      expect(require('net').connect).toHaveBeenCalled();
      expect(mockSocket.write).toHaveBeenCalled();
    });
  });

  describe('Transaction Support', () => {
    test('should create instance transaction', () => {
      // Act
      const tx = instanceManager.createInstanceTransaction('test-tx');
      
      // Assert
      expect(tx).toBeDefined();
      expect(typeof tx.commit).toBe('function');
      expect(typeof tx.rollback).toBe('function');
    });
    
    test('should commit transaction successfully', async () => {
      // Arrange
      const mockTx = {
        operations: [jest.fn().mockResolvedValue(undefined)],
        commit: jest.fn().mockResolvedValue(undefined),
        rollback: jest.fn()
      };
      
      // Act
      await mockTx.commit();
      
      // Assert
      expect(mockTx.operations[0]).toHaveBeenCalled();
      expect(mockTx.rollback).not.toHaveBeenCalled();
    });
  });
});
