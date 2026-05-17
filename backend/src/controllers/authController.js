const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const User = require('../models/User');
const Otp  = require('../models/Otp');

const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

// POST /api/auth/register
exports.register = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { name, email, phone, password, role } = req.body;

    const existing = await User.findOne({ $or: [{ email }, { phone }] });
    if (existing) {
      const field = existing.email === email ? 'Email' : 'Phone';
      return res.status(400).json({ success: false, message: `${field} is already registered.` });
    }

    // Only allow 'user' or 'driver' roles on self-registration
    const allowedRole = ['user', 'driver'].includes(role) ? role : 'user';
    const user = await User.create({ name, email, phone, password, role: allowedRole });
    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      message: 'Registration successful.',
      token,
      user,
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/auth/login
exports.login = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const token = generateToken(user._id);
    res.json({ success: true, message: 'Login successful.', token, user });
  } catch (error) {
    next(error);
  }
};

// GET /api/auth/me
exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    res.json({ success: true, user });
  } catch (error) {
    next(error);
  }
};

// PUT /api/auth/profile
exports.updateProfile = async (req, res, next) => {
  try {
    const allowedFields = ['name', 'phone', 'address', 'fcmToken', 'profileImage'];
    const updates = {};
    allowedFields.forEach((f) => {
      if (req.body[f] !== undefined) updates[f] = req.body[f];
    });

    const user = await User.findByIdAndUpdate(req.user.id, updates, {
      new: true,
      runValidators: true,
    });

    res.json({ success: true, message: 'Profile updated.', user });
  } catch (error) {
    next(error);
  }
};

// PUT /api/auth/change-password
exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Both current and new passwords are required.' });
    }

    const user = await User.findById(req.user.id).select('+password');
    if (!(await user.comparePassword(currentPassword))) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect.' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters.' });
    }

    user.password = newPassword;
    await user.save();

    res.json({ success: true, message: 'Password changed successfully.' });
  } catch (error) {
    next(error);
  }
};

// POST /api/auth/send-otp
// Body: { phone }
exports.sendOtp = async (req, res, next) => {
  try {
    const { phone } = req.body;
    if (!phone || !/^[0-9]{10,15}$/.test(phone)) {
      return res.status(400).json({ success: false, message: 'A valid phone number (10–15 digits) is required.' });
    }

    const user = await User.findOne({ phone });
    if (!user) {
      return res.status(404).json({ success: false, message: 'No account found with this phone number.' });
    }

    // Invalidate any previous unused OTPs for this phone
    await Otp.deleteMany({ phone });

    // Generate a 6-digit OTP
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await Otp.create({ phone, code, expiresAt });

    const apiKey = process.env.FAST2SMS_API_KEY;

    if (apiKey) {
      // Send real SMS via Fast2SMS
      let smsFailed = false;
      try {
        const smsRes = await fetch('https://www.fast2sms.com/dev/bulkV2', {
          method: 'POST',
          headers: {
            'authorization': apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            route: 'otp',
            variables_values: code,
            numbers: phone,
          }),
        });
        const smsData = await smsRes.json();
        console.log(`[OTP] SMS response for ${phone}:`, smsData);
        if (!smsData.return) smsFailed = true;
      } catch (smsErr) {
        console.error('[OTP] SMS delivery error:', smsErr.message);
        smsFailed = true;
      }

      // In development, always return OTP so demo works even if SMS fails
      if (process.env.NODE_ENV !== 'production') {
        return res.json({
          success: true,
          message: smsFailed
            ? `SMS gateway error — use the OTP shown below (dev mode).`
            : `OTP sent to +91 ${phone}.`,
          otp: code,
        });
      }

      if (smsFailed) {
        return res.status(503).json({ success: false, message: 'SMS delivery failed. Please try again.' });
      }

      return res.json({ success: true, message: `OTP sent to +91 ${phone}.` });
    }

    // No API key configured — demo mode: return OTP in response
    console.log(`[OTP Demo] Phone: ${phone}  Code: ${code}`);
    res.json({
      success: true,
      message: 'OTP sent (demo mode — no SMS gateway configured).',
      otp: code,
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/auth/verify-otp
// Body: { phone, code }
exports.verifyOtp = async (req, res, next) => {
  try {
    const { phone, code } = req.body;
    if (!phone || !code) {
      return res.status(400).json({ success: false, message: 'Phone and OTP code are required.' });
    }

    const record = await Otp.findOne({ phone, used: false });
    if (!record) {
      return res.status(400).json({ success: false, message: 'OTP not found or already used. Please request a new one.' });
    }

    if (new Date() > record.expiresAt) {
      await Otp.deleteOne({ _id: record._id });
      return res.status(400).json({ success: false, message: 'OTP has expired. Please request a new one.' });
    }

    if (record.code !== String(code)) {
      return res.status(400).json({ success: false, message: 'Invalid OTP. Please check and try again.' });
    }

    // Mark OTP as used
    record.used = true;
    await record.save();

    const user = await User.findOne({ phone });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const token = generateToken(user._id);
    res.json({ success: true, message: 'OTP verified. Login successful.', token, user });
  } catch (error) {
    next(error);
  }
};
