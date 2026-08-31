const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Organization = require('../models/Organization');

const protect = async (req, res, next) => {
  try {
    let token;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer ')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res
        .status(401)
        .json({ success: false, message: 'Access denied. No token provided.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: 'Token is invalid or user no longer exists.' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Role '${req.user.role}' is not authorized to access this resource.`,
      });
    }
    next();
  };
};

// Only the authenticated DB user's role can grant this — never client input.
const authorizeSuperAdmin = authorize('superadmin');

const requireActiveOrganization = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Access denied. Authentication is required.' });
    }

    if (req.user.role === 'superadmin' || req.user.role === 'user') {
      req.organization = null;
      return next();
    }

    if (!req.user.organizationId) {
      return res.status(403).json({ success: false, message: 'Organization membership is required.' });
    }

    const organization = await Organization.findById(req.user.organizationId);
    if (!organization || organization.isDeleted) {
      return res.status(403).json({ success: false, message: 'Organization is no longer active.' });
    }

    if (organization.status !== 'active') {
      const statusMessages = {
        pending: 'Organization is pending approval.',
        suspended: 'Organization account has been suspended.',
        expired: 'Organization subscription has expired.',
      };
      return res.status(403).json({
        success: false,
        message: statusMessages[organization.status] || 'Organization is not active.',
      });
    }

    req.organization = organization;
    next();
  } catch (error) {
    next(error);
  }
};

const isSameOrganization = (resourceOrganizationId, req, { allowSuperAdmin = false } = {}) => {
  if (!req.user) return false;
  if (req.user.role === 'superadmin') return allowSuperAdmin;
  if (!resourceOrganizationId || !req.user.organizationId) return false;
  return String(resourceOrganizationId) === String(req.user.organizationId);
};

const canAccessAmbulance = (ambulance, req, { allowSuperAdmin = false } = {}) => {
  if (!ambulance || !req.user) return false;
  if (req.user.role === 'superadmin') return allowSuperAdmin;
  if (!isSameOrganization(ambulance.organizationId, req)) return false;
  if (req.user.role === 'admin') return true;
  const userId = req.user._id || req.user.id;
  return Boolean(
    req.user.role === 'driver' && ambulance.owner && userId && String(ambulance.owner) === String(userId)
  );
};

module.exports = {
  protect,
  authorize,
  authorizeSuperAdmin,
  requireActiveOrganization,
  isSameOrganization,
  canAccessAmbulance,
};
