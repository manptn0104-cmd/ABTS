const AppConfig = require('../models/AppConfig');

// GET /api/config  —  public, no auth required
exports.getConfig = async (req, res, next) => {
  try {
    const docs = await AppConfig.find({}, 'key value -_id').lean();
    const config = {};
    docs.forEach((d) => { config[d.key] = d.value; });
    res.json({ success: true, config });
  } catch (error) {
    next(error);
  }
};

// PUT /api/config/:key  —  superadmin only (future use)
exports.updateConfig = async (req, res, next) => {
  try {
    const { value } = req.body;
    if (value === undefined) {
      return res.status(400).json({ success: false, message: 'value is required.' });
    }
    const doc = await AppConfig.findOneAndUpdate(
      { key: req.params.key },
      { value },
      { new: true, upsert: true, runValidators: true }
    );
    res.json({ success: true, config: { key: doc.key, value: doc.value } });
  } catch (error) {
    next(error);
  }
};
