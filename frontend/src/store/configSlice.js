import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { getAppConfig } from '../api/config';
import {
  FACILITIES,
  AMBULANCE_TYPES,
  BOOKING_STATUS,
  PAYMENT_METHODS,
  DEFAULT_REGION,
} from '../utils/constants';

// ── Thunk ─────────────────────────────────────────────────────────────────────
export const loadConfig = createAsyncThunk('config/load', async (_, { rejectWithValue }) => {
  try {
    const res = await getAppConfig();
    return res.data.config;
  } catch {
    return rejectWithValue('Config fetch failed — using built-in defaults.');
  }
});

// ── Slice ─────────────────────────────────────────────────────────────────────
const configSlice = createSlice({
  name: 'config',
  initialState: {
    facilities:         FACILITIES,
    ambulanceTypes:     AMBULANCE_TYPES,
    ambulanceTypesList: ['basic', 'advanced', 'icu', 'neonatal'],
    specializations:    ['accident', 'cardiac', 'respiratory', 'trauma', 'maternity', 'general', 'other'],
    bookingStatus:      BOOKING_STATUS,
    paymentMethods:     PAYMENT_METHODS,
    defaultRegion:      DEFAULT_REGION,
    loaded:             false,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(loadConfig.fulfilled, (state, action) => {
        const c = action.payload;
        if (c.facilities)         state.facilities         = c.facilities;
        if (c.ambulanceTypes)     state.ambulanceTypes     = c.ambulanceTypes;
        if (c.ambulanceTypesList) state.ambulanceTypesList = c.ambulanceTypesList;
        if (c.specializations)    state.specializations    = c.specializations;
        if (c.bookingStatus)      state.bookingStatus      = c.bookingStatus;
        if (c.paymentMethods)     state.paymentMethods     = c.paymentMethods;
        if (c.defaultRegion)      state.defaultRegion      = c.defaultRegion;
        state.loaded = true;
      })
      .addCase(loadConfig.rejected, (state) => {
        // Keep defaults already in initialState
        state.loaded = true;
      });
  },
});

export default configSlice.reducer;
