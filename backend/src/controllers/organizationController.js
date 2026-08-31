const mongoose = require('mongoose');
const Organization = require('../models/Organization');

const VALID_STATUSES = ['pending', 'active', 'suspended', 'expired'];

// POST /api/organizations
exports.createOrganization = async (req, res, next) => {
  try {
    const {
      organizationName,
      organizationCode,
      registrationNumber,
      gstNumber,
      contactPerson,
      address,
      mobileNumber,
      email,
      city,
      state,
      country,
      maximumAmbulanceLimit,
      maximumDriverLimit,
      maximumUserLimit,
    } = req.body;

    // status/isDeleted/subscription fields are never accepted from the client here.
    const organization = await Organization.create({
      organizationName,
      organizationCode,
      registrationNumber,
      gstNumber,
      contactPerson,
      address,
      mobileNumber,
      email,
      city,
      state,
      country,
      maximumAmbulanceLimit,
      maximumDriverLimit,
      maximumUserLimit,
      status: 'pending',
      isDeleted: false,
    });

    res.status(201).json({ success: true, message: 'Organization created.', organization });
  } catch (error) {
    next(error);
  }
};

// GET /api/organizations?page=1&limit=10&search=&status=&sortBy=&sortOrder=
exports.getAllOrganizations = async (req, res, next) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page, 10)  || 1);
    const limit = Math.min(100, parseInt(req.query.limit, 10) || 10);
    const skip  = (page - 1) * limit;

    const filter = { isDeleted: false };

    if (req.query.status) {
      if (!VALID_STATUSES.includes(req.query.status)) {
        return res.status(400).json({ success: false, message: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}.` });
      }
      filter.status = req.query.status;
    }

    if (req.query.search) {
      const term = req.query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(term, 'i');
      filter.$or = [
        { organizationName: regex },
        { organizationCode: regex },
        { email: regex },
        { registrationNumber: regex },
      ];
    }

    const sortableFields = ['createdAt', 'organizationName', 'status', 'subscriptionExpiryDate'];
    const sortBy = sortableFields.includes(req.query.sortBy) ? req.query.sortBy : 'createdAt';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;

    const [organizations, total] = await Promise.all([
      Organization.find(filter)
        .sort({ [sortBy]: sortOrder })
        .skip(skip)
        .limit(limit),
      Organization.countDocuments(filter),
    ]);

    res.json({
      success: true,
      count: organizations.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      organizations,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/organizations/:id
exports.getOrganizationById = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid organization id.' });
    }

    const organization = await Organization.findOne({ _id: req.params.id, isDeleted: false });
    if (!organization) {
      return res.status(404).json({ success: false, message: 'Organization not found.' });
    }

    res.json({ success: true, organization });
  } catch (error) {
    next(error);
  }
};

// PUT /api/organizations/:id
exports.updateOrganization = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid organization id.' });
    }

    // Protected lifecycle fields are excluded — updated via their own endpoints only.
    const allowedFields = [
      'organizationName',
      'registrationNumber',
      'gstNumber',
      'contactPerson',
      'address',
      'mobileNumber',
      'email',
      'city',
      'state',
      'country',
      'maximumAmbulanceLimit',
      'maximumDriverLimit',
      'maximumUserLimit',
    ];
    const updates = {};
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    const existing = await Organization.findOne({ _id: req.params.id, isDeleted: false });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Organization not found.' });
    }

    const organization = await Organization.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });

    res.json({ success: true, message: 'Organization updated.', organization });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/organizations/:id/status
exports.updateOrganizationStatus = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid organization id.' });
    }

    const { status } = req.body;
    if (!status || !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ success: false, message: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}.` });
    }

    const organization = await Organization.findOne({ _id: req.params.id, isDeleted: false });
    if (!organization) {
      return res.status(404).json({ success: false, message: 'Organization not found.' });
    }

    organization.status = status;
    await organization.save();

    res.json({ success: true, message: 'Organization status updated.', organization });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/organizations/:id  (soft delete)
exports.deleteOrganization = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid organization id.' });
    }

    const organization = await Organization.findOne({ _id: req.params.id, isDeleted: false });
    if (!organization) {
      return res.status(404).json({ success: false, message: 'Organization not found.' });
    }

    organization.isDeleted = true;
    await organization.save();

    res.json({ success: true, message: 'Organization deleted.' });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/organizations/:id/restore
exports.restoreOrganization = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid organization id.' });
    }

    const organization = await Organization.findOne({ _id: req.params.id, isDeleted: true });
    if (!organization) {
      return res.status(404).json({ success: false, message: 'Deleted organization not found.' });
    }

    organization.isDeleted = false;
    await organization.save();

    res.json({ success: true, message: 'Organization restored.', organization });
  } catch (error) {
    next(error);
  }
};
