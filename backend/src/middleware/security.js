const mongoSanitize = require('express-mongo-sanitize');
const hpp = require('hpp');

/**
 * Strip common XSS patterns from string inputs in req.body / req.query.
 * Helmet also sets security headers; this adds request sanitization.
 */
const stripXss = (value) => {
  if (typeof value !== 'string') return value;
  return value
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '');
};

const sanitizeRequestStrings = (obj) => {
  if (!obj || typeof obj !== 'object') return;
  Object.keys(obj).forEach((key) => {
    if (typeof obj[key] === 'string') {
      obj[key] = stripXss(obj[key]);
    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      sanitizeRequestStrings(obj[key]);
    }
  });
};

const xssSanitizeMiddleware = (req, res, next) => {
  sanitizeRequestStrings(req.body);
  sanitizeRequestStrings(req.query);
  next();
};

const applySecurityMiddleware = (app) => {
  app.use(mongoSanitize());
  app.use(hpp());
  app.use(xssSanitizeMiddleware);
};

module.exports = { applySecurityMiddleware, stripXss };
