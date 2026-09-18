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
  async (request, { rejectWithValue }) => {
    try {
      const { id, lat, lng } = typeof request === 'string' ? { id: request } : request;
      const params = lat !== undefined && lng !== undefined ? { lat, lng } : undefined;
      const res = await ambulanceApi.fetchAmbulance(id, params);
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
    currentRequestId: null,
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
      .addCase(fetchAmbulances.pending, (s, action) => {
        s.isLoading = true;
        s.error = null;
        s.currentRequestId = action.meta.requestId;
      })
      .addCase(fetchAmbulances.fulfilled, (s, action) => {
        // Only accept if this is the latest request
        if (action.meta.requestId === s.currentRequestId) {
          s.isLoading = false;
          s.list = action.payload.ambulances;
          action.payload.ambulances?.forEach((amb) => {
            console.log('[TRACE REDUX]', {
              vehicleNumber: amb.vehicleNumber,
              roadDistanceKm: amb.roadDistanceKm,
              etaMinutes: amb.etaMinutes,
              estimatedArrivalMin: amb.estimatedArrivalMin,
              etaFallback: amb.etaFallback,
            });
          });
          s.total = action.payload.total;
        }
      })
      .addCase(fetchAmbulances.rejected, (s, action) => {
        // Only clear loading/error if this is the latest request
        if (action.meta.requestId === s.currentRequestId) {
          s.isLoading = false;
          s.error = action.payload;
        }
      })

    builder
      .addCase(fetchAmbulanceById.pending,   (s) => { s.isLoadingDetails = true; })
      .addCase(fetchAmbulanceById.fulfilled, (s, a) => { s.isLoadingDetails = false; s.selected = a.payload; })
      .addCase(fetchAmbulanceById.rejected,  (s, a) => { s.isLoadingDetails = false; s.error = a.payload; });
  },
});

export const { setFilters, resetFilters, clearSelected, clearError } = ambulanceSlice.actions;
export default ambulanceSlice.reducer;
