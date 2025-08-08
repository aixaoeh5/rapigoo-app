const compression = require('compression');
const zlib = require('zlib');

const compressionMiddleware = compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    
    const contentType = res.getHeader('Content-Type');
    if (!contentType) {
      return compression.filter(req, res);
    }
    
    const compressibleTypes = [
      'text/',
      'application/json',
      'application/javascript',
      'application/xml',
      'application/rss+xml',
      'application/atom+xml',
      'image/svg+xml'
    ];
    
    return compressibleTypes.some(type => contentType.includes(type));
  },
  
  level: 6,
  
  threshold: 1024,
  
  memLevel: 8,
  
  chunkSize: 16 * 1024,
  
  windowBits: 15,
  
  strategy: zlib.constants.Z_DEFAULT_STRATEGY
});

module.exports = compressionMiddleware;