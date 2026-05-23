import * as Yup from 'yup';

export const loginSchema = Yup.object({
  email: Yup.string().trim().email('Enter a valid email').required('Email is required'),
  password: Yup.string().required('Password is required'),
});

export const registerSchema = Yup.object({
  name: Yup.string().trim().min(2, 'Name is too short').required('Name is required'),
  email: Yup.string().trim().email('Enter a valid email').required('Email is required'),
  phone: Yup.string()
    .required('Phone is required')
    .test('phone-digits', 'Enter 10-15 digit phone number', (val) => {
      const digits = String(val || '').replace(/\D/g, '');
      return /^[0-9]{10,15}$/.test(digits);
    }),
  password: Yup.string().min(6, 'Password must be at least 6 characters').required('Password is required'),
  confirmPassword: Yup.string()
    .oneOf([Yup.ref('password')], 'Passwords must match')
    .required('Confirm your password'),
  role: Yup.string().oneOf(['user', 'driver']).required('Select a role'),
});

export const otpPhoneSchema = Yup.object({
  phone: Yup.string()
    .required('Phone is required')
    .test('phone-digits', 'Enter a valid 10-digit mobile number', (val) => {
      const digits = String(val || '').replace(/\D/g, '');
      return digits.length >= 10 && digits.length <= 15;
    }),
});
