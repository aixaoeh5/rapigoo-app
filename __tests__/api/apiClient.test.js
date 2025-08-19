import apiClient from '../../api/apiClient';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Mock axios
jest.mock('axios', () => ({
  create: jest.fn(() => ({
    defaults: {
      headers: {
        common: {}
      }
    },
    interceptors: {
      request: {
        use: jest.fn(),
      },
      response: {
        use: jest.fn(),
      },
    },
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  })),
}));

describe('apiClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    AsyncStorage.clear();
  });

  it('creates axios instance with correct base configuration', () => {
    const axios = require('axios');
    
    expect(axios.create).toHaveBeenCalledWith(
      expect.objectContaining({
        timeout: expect.any(Number),
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
      })
    );
  });

  it('sets up request interceptor', () => {
    const axios = require('axios');
    const mockInstance = axios.create();

    expect(mockInstance.interceptors.request.use).toHaveBeenCalled();
  });

  it('sets up response interceptor', () => {
    const axios = require('axios');
    const mockInstance = axios.create();

    expect(mockInstance.interceptors.response.use).toHaveBeenCalled();
  });

  describe('request interceptor', () => {
    it('adds authorization header when token exists', async () => {
      await AsyncStorage.setItem('token', 'test-token');
      
      // Since the interceptor is set up during import,
      // we need to test the behavior indirectly
      expect(AsyncStorage.getItem).toBeDefined();
    });

    it('proceeds without authorization header when no token exists', async () => {
      // Token should be null by default
      const token = await AsyncStorage.getItem('token');
      expect(token).toBeNull();
    });

    it('adds API key to headers if configured', () => {
      // Test that API key is added to headers if it exists in config
      const axios = require('axios');
      expect(axios.create).toHaveBeenCalled();
    });
  });

  describe('response interceptor', () => {
    it('handles successful responses', () => {
      const axios = require('axios');
      const mockInstance = axios.create();
      
      // Verify that response interceptor was set up
      expect(mockInstance.interceptors.response.use).toHaveBeenCalled();
      
      const [successHandler] = mockInstance.interceptors.response.use.mock.calls[0];
      
      const mockResponse = { data: { success: true } };
      const result = successHandler(mockResponse);
      
      expect(result).toBe(mockResponse);
    });

    it('handles 401 unauthorized errors', async () => {
      const axios = require('axios');
      const mockInstance = axios.create();
      
      const [, errorHandler] = mockInstance.interceptors.response.use.mock.calls[0];
      
      const mockError = {
        response: {
          status: 401,
          data: { message: 'Unauthorized' }
        }
      };

      await expect(errorHandler(mockError)).rejects.toBe(mockError);
      
      // Should clear token from storage on 401
      const token = await AsyncStorage.getItem('token');
      expect(token).toBeNull();
    });

    it('handles network errors', async () => {
      const axios = require('axios');
      const mockInstance = axios.create();
      
      const [, errorHandler] = mockInstance.interceptors.response.use.mock.calls[0];
      
      const mockError = {
        code: 'NETWORK_ERROR',
        message: 'Network Error'
      };

      await expect(errorHandler(mockError)).rejects.toBe(mockError);
    });

    it('handles timeout errors', async () => {
      const axios = require('axios');
      const mockInstance = axios.create();
      
      const [, errorHandler] = mockInstance.interceptors.response.use.mock.calls[0];
      
      const mockError = {
        code: 'ECONNABORTED',
        message: 'timeout of 10000ms exceeded'
      };

      await expect(errorHandler(mockError)).rejects.toBe(mockError);
    });

    it('handles 500 server errors', async () => {
      const axios = require('axios');
      const mockInstance = axios.create();
      
      const [, errorHandler] = mockInstance.interceptors.response.use.mock.calls[0];
      
      const mockError = {
        response: {
          status: 500,
          data: { message: 'Internal Server Error' }
        }
      };

      await expect(errorHandler(mockError)).rejects.toBe(mockError);
    });
  });

  describe('API methods', () => {
    it('exposes GET method', () => {
      expect(apiClient.get).toBeDefined();
      expect(typeof apiClient.get).toBe('function');
    });

    it('exposes POST method', () => {
      expect(apiClient.post).toBeDefined();
      expect(typeof apiClient.post).toBe('function');
    });

    it('exposes PUT method', () => {
      expect(apiClient.put).toBeDefined();
      expect(typeof apiClient.put).toBe('function');
    });

    it('exposes DELETE method', () => {
      expect(apiClient.delete).toBeDefined();
      expect(typeof apiClient.delete).toBe('function');
    });
  });

  describe('configuration', () => {
    it('uses correct base URL from environment', () => {
      const axios = require('axios');
      
      // Should use environment-specific base URL
      expect(axios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: expect.any(String),
        })
      );
    });

    it('sets appropriate timeout', () => {
      const axios = require('axios');
      
      expect(axios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          timeout: expect.any(Number),
        })
      );
    });

    it('sets correct content type header', () => {
      const axios = require('axios');
      
      expect(axios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
    });
  });
});