import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as authApi from '../api/auth';

// ── Thunks ────────────────────────────────────────────────────────────────────

export const register = createAsyncThunk('auth/register', async (data, { rejectWithValue }) => {
  try {
    const res = await authApi.registerUser(data);
    await AsyncStorage.setItem('abts_token', res.data.token);
    await AsyncStorage.setItem('abts_user', JSON.stringify(res.data.user));
    return res.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Registration failed.');
  }
});

export const login = createAsyncThunk('auth/login', async (data, { rejectWithValue }) => {
  try {
    const res = await authApi.loginUser(data);
    await AsyncStorage.setItem('abts_token', res.data.token);
    await AsyncStorage.setItem('abts_user', JSON.stringify(res.data.user));
    return res.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Login failed.');
  }
});

export const loadUser = createAsyncThunk('auth/loadUser', async (_, { rejectWithValue }) => {
  try {
    const token = await AsyncStorage.getItem('abts_token');
    if (!token) throw new Error('No token');
    const res = await authApi.getMe();
    return { user: res.data.user, token };
  } catch (err) {
    await AsyncStorage.removeItem('abts_token');
    await AsyncStorage.removeItem('abts_user');
    return rejectWithValue('Session expired.');
  }
});

export const updateProfile = createAsyncThunk('auth/updateProfile', async (data, { rejectWithValue }) => {
  try {
    const res = await authApi.updateProfile(data);
    await AsyncStorage.setItem('abts_user', JSON.stringify(res.data.user));
    return res.data.user;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Update failed.');
  }
});

export const loginWithOtp = createAsyncThunk('auth/loginWithOtp', async (data, { rejectWithValue }) => {
  try {
    const res = await authApi.verifyOtp(data);
    await AsyncStorage.setItem('abts_token', res.data.token);
    await AsyncStorage.setItem('abts_user', JSON.stringify(res.data.user));
    return res.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'OTP verification failed.');
  }
});

// ── Slice ──────────────────────────────────────────────────────────────────────

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user:         null,
    token:        null,
    isLoading:    false,
    isInitialised: false,
    error:        null,
  },
  reducers: {
    logout: (state) => {
      state.user  = null;
      state.token = null;
      AsyncStorage.multiRemove(['abts_token', 'abts_user']);
    },
    clearError: (state) => { state.error = null; },
  },
  extraReducers: (builder) => {
    // register
    builder
      .addCase(register.pending,   (s) => { s.isLoading = true;  s.error = null; })
      .addCase(register.fulfilled, (s, a) => { s.isLoading = false; s.user = a.payload.user; s.token = a.payload.token; })
      .addCase(register.rejected,  (s, a) => { s.isLoading = false; s.error = a.payload; });

    // login
    builder
      .addCase(login.pending,   (s) => { s.isLoading = true;  s.error = null; })
      .addCase(login.fulfilled, (s, a) => { s.isLoading = false; s.user = a.payload.user; s.token = a.payload.token; })
      .addCase(login.rejected,  (s, a) => { s.isLoading = false; s.error = a.payload; });

    // loadUser
    builder
      .addCase(loadUser.pending,   (s) => { s.isLoading = true; })
      .addCase(loadUser.fulfilled, (s, a) => { s.isLoading = false; s.isInitialised = true; s.user = a.payload.user; s.token = a.payload.token; })
      .addCase(loadUser.rejected,  (s) => { s.isLoading = false; s.isInitialised = true; });

    // updateProfile
    builder
      .addCase(updateProfile.fulfilled, (s, a) => { s.user = a.payload; });

    // loginWithOtp
    builder
      .addCase(loginWithOtp.pending,   (s) => { s.isLoading = true;  s.error = null; })
      .addCase(loginWithOtp.fulfilled, (s, a) => { s.isLoading = false; s.user = a.payload.user; s.token = a.payload.token; })
      .addCase(loginWithOtp.rejected,  (s, a) => { s.isLoading = false; s.error = a.payload; });
  },
});

export const { logout, clearError } = authSlice.actions;
export default authSlice.reducer;
