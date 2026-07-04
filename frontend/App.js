import React, { useEffect } from 'react';
import { Provider as ReduxProvider } from 'react-redux';
import { Provider as PaperProvider } from 'react-native-paper';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native';

import { store } from './src/store';
import AppNavigator from './src/navigation/AppNavigator';
import { paperTheme } from './src/theme';

// Sync browser history ↔ React Navigation (fixes browser back button on web)
const linking = {
  prefixes: ['http://localhost:8081'],
  config: {
    screens: {
      // Auth
      Login:           'login',
      Register:        'register',
      OtpVerification: 'otp',

      // Main App
      MainTabs: {
        screens: {
          Home:     '',
          Bookings: 'bookings',
          Profile:  'profile',
        },
      },
      AmbulanceList:       'ambulances',
      AmbulanceDetails:    'ambulances/:id',
      BookingConfirmation: 'booking/confirm',
      LiveTracking:        'booking/tracking',
      HelpSupport:         'help',

      // Driver
      DriverTabs: {
        screens: {
          DriverHome:    'driver',
          DriverProfile: 'driver/profile',
        },
      },
      DriverMap: 'driver/map',

      // Admin
      AdminTabs: {
        screens: {
          AdminHome:    'admin',
          AdminProfile: 'admin/profile',
        },
      },
    },
  },
};

export default function App() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <ReduxProvider store={store}>
        <PaperProvider theme={paperTheme}>
          <SafeAreaProvider>
            <NavigationContainer linking={linking}>
              <StatusBar style="light" backgroundColor="#C62828" />
              <AppNavigator />
            </NavigationContainer>
          </SafeAreaProvider>
        </PaperProvider>
      </ReduxProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
