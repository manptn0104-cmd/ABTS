/**
 * Registration role values accepted by the API (must match backend User.role enum).
 */
export const REGISTRATION_ROLES = [
  { label: 'Patient / User', value: 'user', icon: 'account' },
  { label: 'Ambulance Driver', value: 'driver', icon: 'ambulance' },
];

/**
 * Map UI labels or legacy values to API role: 'user' | 'driver'.
 */
export const normalizeRegistrationRole = (role) => {
  if (!role) return 'user';
  const normalized = String(role).trim().toLowerCase();
  if (
    normalized === 'driver' ||
    normalized === 'ambulance driver' ||
    normalized === 'ambulance_driver'
  ) {
    return 'driver';
  }
  if (normalized === 'user' || normalized === 'patient' || normalized === 'patient / user') {
    return 'user';
  }
  return 'user';
};

/** Strip non-digits so backend /^[0-9]{10,15}$/ validation passes. */
export const normalizePhone = (phone) => String(phone || '').replace(/\D/g, '');

export const buildRegisterPayload = (form) => ({
  name: form.name.trim(),
  email: form.email.trim().toLowerCase(),
  phone: normalizePhone(form.phone),
  password: form.password,
  role: normalizeRegistrationRole(form.role),
});

/**
 * Extract a user-facing message from axios / API error responses.
 */
export const getApiErrorMessage = (err, fallback = 'Request failed.') => {
  const data = err?.response?.data;
  if (!data) return err?.message || fallback;
  if (typeof data.message === 'string' && data.message) return data.message;
  if (Array.isArray(data.errors) && data.errors.length > 0) {
    return data.errors.map((e) => e.msg || e.message).filter(Boolean).join('\n');
  }
  return fallback;
};
