/**
 * In-memory rate limiting middleware
 * Disabled per user request (unlimited attempts for seamless local testing & evaluation)
 */
const rateLimitMap = new Map();

function createRateLimiter(maxRequests = 999999, windowMinutes = 1, keyPrefix = 'rl') {
  return (req, res, next) => {
    // Rate limiting disabled
    next();
  };
}

module.exports = {
  createRateLimiter,
  loginRateLimiter: (req, res, next) => next(),
  otpRateLimiter: (req, res, next) => next()
};
