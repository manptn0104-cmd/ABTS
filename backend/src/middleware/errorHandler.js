const errorHandler = (err, req, res, next) => {
  console.error(`[ERROR] ${err.name}: ${err.message}`);

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    return res.status(404).json({ success: false, message: 'Resource not found.' });
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    const capitalField = field.charAt(0).toUpperCase() + field.slice(1);
    return res.status(400).json({
      success: false,
      message: `${capitalField} already exists.`,
    });
  }

  // Mongoose validation errors
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((val) => val.message);
    return res.status(400).json({ success: false, message: messages.join('. ') });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ success: false, message: 'Invalid token.' });
  }
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ success: false, message: 'Token has expired.' });
  }

  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
  });
};

module.exports = errorHandler;
