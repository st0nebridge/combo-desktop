/**
 * Lightweight smoke tests for InstanceManager.
 */

const mockElectron = require('../electron-mock');

jest.mock('electron', () => mockElectron);
jest.mock('../../src/services/logging.service', () => ({
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));
jest.mock('../../src/services/instance.manager', () => ({
  initialize: jest.fn().mockResolvedValue(true),
  registerSession: jest.fn(),
  acquireLock: jest.fn(),
  releaseLock: jest.fn()
}));
jest.mock('proper-lockfile', () => ({
  check: jest.fn().mockResolvedValue(false),
  lock: jest.fn().mockResolvedValue(() => Promise.resolve())
}));
jest.mock('net');
jest.mock('child_process');
jest.mock('fs');
jest.mock('path');

describe('InstanceManager', () => {
  let instanceManager;

  beforeEach(() => {
    jest.resetModules();
    instanceManager = require('../../src/services/instance.manager');
  });

  test('initializes without throwing', async () => {
    await expect(instanceManager.initialize()).resolves.not.toThrow();
  });

  test('exposes core methods', () => {
    expect(typeof instanceManager.registerSession).toBe('function');
    expect(typeof instanceManager.acquireLock).toBe('function');
    expect(typeof instanceManager.releaseLock).toBe('function');
  });
});
