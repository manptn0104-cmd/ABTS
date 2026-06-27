import React, { useEffect } from 'react';
import { Provider as ReduxProvider } from 'react-redux';
import { Provider as PaperProvider } from 'react-native-paper';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet, Platform, Alert } from 'react-native';

import { store } from './src/store';
import AppNavigator from './src/navigation/AppNavigator';
import { paperTheme } from './src/theme';

// Polyfill Alert.alert for Web platform
if (Platform.OS === 'web') {
  Alert.alert = (title, message, buttons) => {
    const text = `${title}${message ? `\n\n${message}` : ''}`;
    if (buttons && buttons.length > 0) {
      // If there are buttons (e.g. Cancel and Confirm), use window.confirm
      if (buttons.length > 1) {
        const ok = window.confirm(text);
        const cancelBtn = buttons.find((b) => b.style === 'cancel');
        const confirmBtn = buttons.find((b) => b.style !== 'cancel') || buttons[buttons.length - 1];
        if (ok) {
          if (confirmBtn?.onPress) confirmBtn.onPress();
        } else {
          if (cancelBtn?.onPress) cancelBtn.onPress();
        }
      } else {
        // Single button alert
        window.alert(text);
        if (buttons[0]?.onPress) buttons[0].onPress();
      }
    } else {
      window.alert(text);
    }
  };
}

export default function App() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <ReduxProvider store={store}>
        <PaperProvider theme={paperTheme}>
          <SafeAreaProvider>
            <NavigationContainer>
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
