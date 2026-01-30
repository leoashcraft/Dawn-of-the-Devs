const rateLimit = require('express-rate-limit');

function createLimiter(max, message) {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message,
  });
}

const generalLimiter = createLimiter(100, 'Too many requests, please try again later.');
const authLimiter = createLimiter(10, 'Too many authentication attempts, please try again later.');
const actionLimiter = createLimiter(20, 'Too many requests, please try again later.');

module.exports = { generalLimiter, authLimiter, actionLimiter };
