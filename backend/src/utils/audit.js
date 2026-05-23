const AuditLog = require('../models/AuditLog');

const logAudit = async ({ actorId, action, targetType, targetId, metadata = {}, ip }) => {
  try {
    await AuditLog.create({
      actor: actorId,
      action,
      targetType,
      targetId,
      metadata,
      ip,
    });
  } catch (err) {
    console.error('[AuditLog] failed:', err.message);
  }
};

module.exports = { logAudit };
