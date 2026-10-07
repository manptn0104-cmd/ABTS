import { configureStore } from '@reduxjs/toolkit';
import authReducer      from './authSlice';
import ambulanceReducer from './ambulanceSlice';
import bookingReducer   from './bookingSlice';
import configReducer    from './configSlice';

export const store = configureStore({
  reducer: {
    auth:      authReducer,
    ambulance: ambulanceReducer,
    booking:   bookingReducer,
    config:    configReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({ serializableCheck: false }),
});
