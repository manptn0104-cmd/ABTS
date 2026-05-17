import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import * as bookingApi from '../api/bookings';

export const createBooking = createAsyncThunk(
  'booking/create',
  async (data, { rejectWithValue }) => {
    try {
      const res = await bookingApi.createBooking(data);
      return res.data.booking;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to create booking.');
    }
  }
);

export const fetchMyBookings = createAsyncThunk(
  'booking/fetchMy',
  async (params, { rejectWithValue }) => {
    try {
      const res = await bookingApi.fetchMyBookings(params);
      return res.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to load bookings.');
    }
  }
);

export const fetchBookingById = createAsyncThunk(
  'booking/fetchById',
  async (id, { rejectWithValue }) => {
    try {
      const res = await bookingApi.fetchBooking(id);
      return res.data.booking;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to load booking.');
    }
  }
);

export const cancelBooking = createAsyncThunk(
  'booking/cancel',
  async (id, { rejectWithValue }) => {
    try {
      const res = await bookingApi.cancelBooking(id);
      return res.data.booking;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to cancel booking.');
    }
  }
);

export const submitRating = createAsyncThunk(
  'booking/rate',
  async ({ id, ...data }, { rejectWithValue }) => {
    try {
      const res = await bookingApi.rateBooking(id, data);
      return res.data.booking;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to submit rating.');
    }
  }
);

const bookingSlice = createSlice({
  name: 'booking',
  initialState: {
    list:          [],
    current:       null,
    total:         0,
    isLoading:     false,
    isCreating:    false,
    error:         null,
  },
  reducers: {
    setCurrentBooking: (s, a) => { s.current = a.payload; },
    clearCurrent:      (s)    => { s.current = null; },
    updateCurrentStatus: (s, a) => {
      if (s.current) s.current.status = a.payload;
    },
    clearError: (s) => { s.error = null; },
    updateBookingInList: (s, a) => {
      // a.payload = { bookingId, status }
      const { bookingId, status } = a.payload;
      const idx = s.list.findIndex((b) => b._id === bookingId);
      if (idx !== -1) s.list[idx] = { ...s.list[idx], status };
      if (s.current?._id === bookingId) s.current = { ...s.current, status };
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(createBooking.pending,   (s) => { s.isCreating = true; s.error = null; })
      .addCase(createBooking.fulfilled, (s, a) => { s.isCreating = false; s.current = a.payload; })
      .addCase(createBooking.rejected,  (s, a) => { s.isCreating = false; s.error = a.payload; });

    builder
      .addCase(fetchMyBookings.pending,   (s) => { s.isLoading = true; })
      .addCase(fetchMyBookings.fulfilled, (s, a) => { s.isLoading = false; s.list = a.payload.bookings; s.total = a.payload.total; })
      .addCase(fetchMyBookings.rejected,  (s, a) => { s.isLoading = false; s.error = a.payload; });

    builder
      .addCase(fetchBookingById.pending,   (s) => { s.isLoading = true; })
      .addCase(fetchBookingById.fulfilled, (s, a) => { s.isLoading = false; s.current = a.payload; })
      .addCase(fetchBookingById.rejected,  (s, a) => { s.isLoading = false; s.error = a.payload; });

    builder
      .addCase(cancelBooking.fulfilled, (s, a) => {
        s.current = a.payload;
        s.list = s.list.map((b) => (b._id === a.payload._id ? a.payload : b));
      });

    builder
      .addCase(submitRating.fulfilled, (s, a) => {
        s.current = a.payload;
        s.list = s.list.map((b) => (b._id === a.payload._id ? a.payload : b));
      });
  },
});

export const { setCurrentBooking, clearCurrent, updateCurrentStatus, updateBookingInList, clearError } = bookingSlice.actions;
export default bookingSlice.reducer;
