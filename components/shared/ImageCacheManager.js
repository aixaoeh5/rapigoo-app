import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';

class ImageCacheManager {
  constructor() {
    this.cache = new Map();
    this.cacheDir = FileSystem.cacheDirectory + 'images/';
    this.maxCacheSize = 50 * 1024 * 1024; // 50MB
    this.maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
    this.initializeCache();
  }

  async initializeCache() {
    try {
      const dirInfo = await FileSystem.getInfoAsync(this.cacheDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(this.cacheDir, { intermediates: true });
      }
      await this.cleanExpiredImages();
    } catch (error) {
      console.warn('Error initializing image cache:', error);
    }
  }

  generateCacheKey(uri) {
    return uri.replace(/[^a-zA-Z0-9]/g, '_') + '.jpg';
  }

  async getCachedImagePath(uri) {
    if (!uri) return null;

    const cacheKey = this.generateCacheKey(uri);
    const cachedPath = this.cacheDir + cacheKey;

    try {
      const fileInfo = await FileSystem.getInfoAsync(cachedPath);
      
      if (fileInfo.exists) {
        // Check if file is not expired
        const now = Date.now();
        if (now - fileInfo.modificationTime < this.maxAge) {
          return cachedPath;
        } else {
          // Remove expired file
          await FileSystem.deleteAsync(cachedPath);
        }
      }

      // Download and cache the image
      const downloadResult = await FileSystem.downloadAsync(uri, cachedPath);
      
      if (downloadResult.status === 200) {
        return downloadResult.uri;
      }
    } catch (error) {
      console.warn('Error caching image:', error);
    }

    return null;
  }

  async cleanExpiredImages() {
    try {
      const files = await FileSystem.readDirectoryAsync(this.cacheDir);
      const now = Date.now();

      for (const file of files) {
        const filePath = this.cacheDir + file;
        const fileInfo = await FileSystem.getInfoAsync(filePath);
        
        if (now - fileInfo.modificationTime > this.maxAge) {
          await FileSystem.deleteAsync(filePath);
        }
      }
    } catch (error) {
      console.warn('Error cleaning expired images:', error);
    }
  }

  async clearCache() {
    try {
      await FileSystem.deleteAsync(this.cacheDir);
      await FileSystem.makeDirectoryAsync(this.cacheDir, { intermediates: true });
    } catch (error) {
      console.warn('Error clearing image cache:', error);
    }
  }

  async getCacheSize() {
    try {
      const files = await FileSystem.readDirectoryAsync(this.cacheDir);
      let totalSize = 0;

      for (const file of files) {
        const filePath = this.cacheDir + file;
        const fileInfo = await FileSystem.getInfoAsync(filePath);
        totalSize += fileInfo.size || 0;
      }

      return totalSize;
    } catch (error) {
      console.warn('Error calculating cache size:', error);
      return 0;
    }
  }
}

export default new ImageCacheManager();