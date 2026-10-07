import React from 'react';
import { createNativeStackNavigator }  from '@react-navigation/native-stack';
import { createBottomTabNavigator }    from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons }      from '@expo/vector-icons';
import { Colors }                      from '../theme';

import SuperAdminDashboardScreen from '../screens/SuperAdmin/SuperAdminDashboardScreen';
import OrganizationsScreen       from '../screens/SuperAdmin/OrganizationsScreen';
import AmbulanceMgmtScreen       from '../screens/SuperAdmin/AmbulanceMgmtScreen';
import UserMgmtScreen            from '../screens/SuperAdmin/UserMgmtScreen';
import DriverMgmtScreen          from '../screens/SuperAdmin/DriverMgmtScreen';
import FeedbackScreen            from '../screens/SuperAdmin/FeedbackScreen';
import ComplaintScreen           from '../screens/SuperAdmin/ComplaintScreen';
import SubscriptionScreen        from '../screens/SuperAdmin/SubscriptionScreen';
import NotificationScreen        from '../screens/SuperAdmin/NotificationScreen';
import AnalyticsScreen           from '../screens/SuperAdmin/AnalyticsScreen';
import SAMoreScreen              from '../screens/SuperAdmin/SAMoreScreen';

const Stack = createNativeStackNavigator();
const Tab   = createBottomTabNavigator();

const PURPLE = '#6A1B9A';

const screenOpts = {
  headerStyle:      { backgroundColor: PURPLE },
  headerTintColor:  Colors.white,
  headerTitleStyle: { fontWeight: '700' },
};

// ── Per-tab Stack navigators ──────────────────────────────────────────────────

function DashboardStack() {
  return (
    <Stack.Navigator screenOptions={screenOpts}>
      <Stack.Screen name="SADashboard" component={SuperAdminDashboardScreen} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}

function OrgsStack() {
  return (
    <Stack.Navigator screenOptions={screenOpts}>
      <Stack.Screen name="SAOrganizations" component={OrganizationsScreen} options={{ title: 'Organizations' }} />
    </Stack.Navigator>
  );
}

function UsersStack() {
  return (
    <Stack.Navigator screenOptions={screenOpts}>
      <Stack.Screen name="SAUsers"   component={UserMgmtScreen}   options={{ title: 'Users' }} />
      <Stack.Screen name="SADrivers" component={DriverMgmtScreen} options={{ title: 'Drivers' }} />
    </Stack.Navigator>
  );
}

function MoreStack() {
  return (
    <Stack.Navigator screenOptions={screenOpts}>
      <Stack.Screen name="SAMore"          component={SAMoreScreen}        options={{ headerShown: false }} />
      <Stack.Screen name="SAAmbulances"    component={AmbulanceMgmtScreen} options={{ title: 'Ambulance Management' }} />
      <Stack.Screen name="SAFeedback"      component={FeedbackScreen}      options={{ title: 'Feedback & Ratings' }} />
      <Stack.Screen name="SAComplaints"    component={ComplaintScreen}     options={{ title: 'Complaint Management' }} />
      <Stack.Screen name="SASubscriptions" component={SubscriptionScreen}  options={{ title: 'Subscriptions & Billing' }} />
      <Stack.Screen name="SANotifications" component={NotificationScreen}  options={{ title: 'Send Notification' }} />
      <Stack.Screen name="SAAnalytics"     component={AnalyticsScreen}     options={{ title: 'Analytics & Reports' }} />
    </Stack.Navigator>
  );
}

// ── Bottom Tab Navigator ──────────────────────────────────────────────────────

function tabIcon(name) {
  return ({ color, size }) => <MaterialCommunityIcons name={name} size={size} color={color} />;
}

export default function SuperAdminNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown:             false,
        tabBarActiveTintColor:   PURPLE,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopColor:  Colors.border,
          paddingBottom:   4,
          height:          60,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardStack}
        options={{ title: 'Dashboard', tabBarIcon: tabIcon('view-dashboard') }}
      />
      <Tab.Screen
        name="Organizations"
        component={OrgsStack}
        options={{ title: 'Orgs', tabBarIcon: tabIcon('office-building') }}
      />
      <Tab.Screen
        name="Users"
        component={UsersStack}
        options={{ title: 'Users', tabBarIcon: tabIcon('account-group') }}
      />
      <Tab.Screen
        name="More"
        component={MoreStack}
        options={{ title: 'More', tabBarIcon: tabIcon('dots-horizontal-circle') }}
      />
    </Tab.Navigator>
  );
}

