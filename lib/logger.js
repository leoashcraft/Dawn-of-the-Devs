const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const LOG_LEVEL = IS_PRODUCTION ? LEVELS.info : LEVELS.debug;

function log(level, message, data = {}) {
  if (LEVELS[level] > LOG_LEVEL) return;

  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...data,
  };

  if (IS_PRODUCTION) {
    console.log(JSON.stringify(entry));
  } else {
    const prefix = `[${entry.timestamp}] ${level.toUpperCase()}:`;
    if (Object.keys(data).length > 0) {
      console.log(prefix, message, data);
    } else {
      console.log(prefix, message);
    }
  }
}

function error(message, data) { log('error', message, data); }
function warn(message, data) { log('warn', message, data); }
function info(message, data) { log('info', message, data); }
function debug(message, data) { log('debug', message, data); }

/**
 * Express request logging middleware.
 */
function requestLogger(req, res, next) {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    info('request', {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration,
      ip: req.ip,
    });
  });
  next();
}

module.exports = { error, warn, info, debug, requestLogger };
