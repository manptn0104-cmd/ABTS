import { configureStore } from '@reduxjs/toolkit';
import authReducer      from './authSlice';
import ambulanceReducer from './ambulanceSlice';
import bookingReducer   from './bookingSlice';

export const store = configureStore({
  reducer: {
    auth:      authReducer,
    ambulance: ambulanceReducer,
    booking:   bookingReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({ serializableCheck: false }),
});
