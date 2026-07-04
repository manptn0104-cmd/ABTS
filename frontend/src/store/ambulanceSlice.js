import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import * as ambulanceApi from '../api/ambulances';

export const fetchAmbulances = createAsyncThunk(
  'ambulance/fetchAll',
  async (params, { rejectWithValue }) => {
    try {
      const res = await ambulanceApi.fetchAmbulances(params);
      return res.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to load ambulances.');
    }
  }
);

export const fetchAmbulanceById = createAsyncThunk(
  'ambulance/fetchById',
  async (id, { rejectWithValue }) => {
    try {
      const res = await ambulanceApi.fetchAmbulance(id);
      return res.data.ambulance;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to load ambulance details.');
    }
  }
);

const defaultFilters = {
  oxygen: false,
  saline: false,
  stretcher: false,
  nurse: false,
  doctor: false,
  minPrice: '',
  maxPrice: '',
  type: '',
  available: 'true',
};

const ambulanceSlice = createSlice({
  name: 'ambulance',
  initialState: {
    list:             [],
    selected:         null,
    total:            0,
    isLoading:        false,
    isLoadingDetails: false,
    error:            null,
    filters:          defaultFilters,
  },
  reducers: {
    setFilters: (s, a) => { s.filters = { ...s.filters, ...a.payload }; },
    resetFilters: (s) => { s.filters = defaultFilters; },
    clearSelected: (s) => { s.selected = null; },
    clearError: (s) => { s.error = null; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAmbulances.pending,   (s) => { s.isLoading = true; s.error = null; })
      .addCase(fetchAmbulances.fulfilled, (s, a) => {
        s.isLoading = false;
        s.list  = a.payload.ambulances;
        s.total = a.payload.total;
      })
      .addCase(fetchAmbulances.rejected,  (s, a) => { s.isLoading = false; s.error = a.payload; });

    builder
      .addCase(fetchAmbulanceById.pending,   (s) => { s.isLoadingDetails = true; })
      .addCase(fetchAmbulanceById.fulfilled, (s, a) => { s.isLoadingDetails = false; s.selected = a.payload; })
      .addCase(fetchAmbulanceById.rejected,  (s, a) => { s.isLoadingDetails = false; s.error = a.payload; });
  },
});

export const { setFilters, resetFilters, clearSelected, clearError } = ambulanceSlice.actions;
export default ambulanceSlice.reducer;
