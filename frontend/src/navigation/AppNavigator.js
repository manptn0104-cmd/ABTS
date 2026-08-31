import React, { useEffect } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator }   from '@react-navigation/bottom-tabs';
import { useSelector, useDispatch }   from 'react-redux';
import { ActivityIndicator, View }    from 'react-native';
import { MaterialCommunityIcons }     from '@expo/vector-icons';

import { loadUser }  from '../store/authSlice';
import { Colors }    from '../theme';

import LoginScreen              from '../screens/Auth/LoginScreen';
import RegisterScreen           from '../screens/Auth/RegisterScreen';
import OtpVerificationScreen    from '../screens/Auth/OtpVerificationScreen';
import HomeScreen               from '../screens/Home/HomeScreen';
import AmbulanceListScreen      from '../screens/AmbulanceList/AmbulanceListScreen';
import AmbulanceDetailsScreen   from '../screens/AmbulanceDetails/AmbulanceDetailsScreen';
import BookingConfirmationScreen from '../screens/Booking/BookingConfirmationScreen';
import LiveTrackingScreen       from '../screens/Tracking/LiveTrackingScreen';
import ProfileScreen            from '../screens/Profile/ProfileScreen';
import MyBookingsScreen         from '../screens/Booking/MyBookingsScreen';
import DriverDashboardScreen    from '../screens/Driver/DriverDashboardScreen';
import DriverMapScreen          from '../screens/Driver/DriverMapScreen';
import ReviewsScreen            from '../screens/Driver/ReviewsScreen';
import AdminDashboardScreen     from '../screens/Admin/AdminDashboardScreen';
import HelpSupportScreen        from '../screens/Help/HelpSupportScreen';
import FeedbackScreen          from '../screens/Feedback/FeedbackScreen';
import SuperAdminDashboardScreen from '../screens/SuperAdmin/SuperAdminDashboardScreen';
import OrganizationListScreen   from '../screens/SuperAdmin/OrganizationListScreen';
import AdminManagementScreen    from '../screens/SuperAdmin/AdminManagementScreen';
import CreateOrganizationScreen from '../screens/SuperAdmin/CreateOrganizationScreen';
import OrganizationDetailsScreen from '../screens/SuperAdmin/OrganizationDetailsScreen';
import EditOrganizationScreen   from '../screens/SuperAdmin/EditOrganizationScreen';

const Stack = createNativeStackNavigator();
const Tab   = createBottomTabNavigator();

const TAB_ICON = {
  Home:       'home',
  Bookings:   'clipboard-list',
  Profile:    'account-circle',
  Dashboard:  'view-dashboard',
  Orgs:       'office-building',
  Admins:     'shield-account',
};

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor:   Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopColor:  Colors.border,
          paddingBottom:   4,
          height:          60,
        },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
        tabBarIcon: ({ color, size }) => (
          <MaterialCommunityIcons
            name={TAB_ICON[route.name] || 'home'}
            size={size}
            color={color}
          />
        ),
      })}
    >
      <Tab.Screen name="Home"     component={HomeScreen} />
      <Tab.Screen name="Bookings" component={MyBookingsScreen} />
      <Tab.Screen name="Profile"  component={ProfileScreen} />
    </Tab.Navigator>
  );
}

function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login"           component={LoginScreen} />
      <Stack.Screen name="Register"        component={RegisterScreen} />
      <Stack.Screen name="OtpVerification" component={OtpVerificationScreen} />
    </Stack.Navigator>
  );
}

function AppStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle:     { backgroundColor: Colors.primary },
        headerTintColor: Colors.white,
        headerTitleStyle:{ fontWeight: '700' },
      }}
    >
      <Stack.Screen name="MainTabs"            component={MainTabs}               options={{ headerShown: false }} />
      <Stack.Screen name="AmbulanceList"       component={AmbulanceListScreen}    options={{ title: 'Nearby Ambulances' }} />
      <Stack.Screen name="AmbulanceDetails"    component={AmbulanceDetailsScreen} options={{ title: 'Ambulance Details' }} />
      <Stack.Screen name="BookingConfirmation" component={BookingConfirmationScreen} options={{ title: 'Booking', headerBackVisible: false }} />
      <Stack.Screen name="LiveTracking"        component={LiveTrackingScreen}     options={{ title: 'Live Tracking', headerBackVisible: false }} />
      <Stack.Screen name="Feedback"            component={FeedbackScreen}         options={{ title: 'Rate Your Experience' }} />
      <Stack.Screen name="HelpSupport"         component={HelpSupportScreen}      options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}

// ── Driver Tab Navigator ──────────────────────────────────────────────────────
function DriverTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor:   Colors.secondary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopColor:  Colors.border,
          paddingBottom:   4,
          height:          60,
        },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
      }}
    >
      <Tab.Screen
        name="DriverHome"
        component={DriverDashboardScreen}
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="view-dashboard" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Reviews"
        component={ReviewsScreen}
        options={{
          title: 'Reviews',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="star" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="DriverProfile"
        component={ProfileScreen}
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="account-circle" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

function DriverStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="DriverTabs" component={DriverTabs} />
      <Stack.Screen name="DriverMap"  component={DriverMapScreen} />
    </Stack.Navigator>
  );
}

// ── Admin Tab Navigator ──────────────────────────────────────────────────────
function AdminTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor:   Colors.error,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopColor:  Colors.border,
          paddingBottom:   4,
          height:          60,
        },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
      }}
    >
      <Tab.Screen
        name="AdminHome"
        component={AdminDashboardScreen}
        options={{
          title: 'Admin',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="shield-account" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="AdminProfile"
        component={ProfileScreen}
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="account-circle" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

function AdminStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="AdminTabs" component={AdminTabs} />
    </Stack.Navigator>
  );
}

// ── SuperAdmin Tab Navigator ──────────────────────────────────────────────────────
function SuperAdminTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor:   '#9C27B0',
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopColor:  Colors.border,
          paddingBottom:   4,
          height:          60,
        },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
      }}
    >
      <Tab.Screen
        name="SuperAdminDashboard"
        component={SuperAdminDashboardScreen}
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name={TAB_ICON.Dashboard} size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Organizations"
        component={OrganizationListScreen}
        options={{
          title: 'Organizations',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name={TAB_ICON.Orgs} size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="AdminManagement"
        component={AdminManagementScreen}
        options={{
          title: 'Admins',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name={TAB_ICON.Admins} size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="SuperAdminProfile"
        component={ProfileScreen}
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="account-circle" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

function SuperAdminStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="SuperAdminTabs" component={SuperAdminTabs} />
      <Stack.Screen 
        name="CreateOrganization" 
        component={CreateOrganizationScreen}
        options={{ presentation: 'card' }}
      />
      <Stack.Screen 
        name="OrganizationDetails" 
        component={OrganizationDetailsScreen}
        options={{ presentation: 'card' }}
      />
      <Stack.Screen 
        name="EditOrganization" 
        component={EditOrganizationScreen}
        options={{ presentation: 'card' }}
      />
    </Stack.Navigator>
  );
}

export default function AppNavigator() {
  const dispatch      = useDispatch();
  const { user, isInitialised } = useSelector((s) => s.auth);

  useEffect(() => {
    dispatch(loadUser());
  }, [dispatch]);

  if (!isInitialised) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background }}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!user) return <AuthStack />;
  if (user.role === 'superadmin') return <SuperAdminStack />;
  if (user.role === 'admin')  return <AdminStack />;
  if (user.role === 'driver') return <DriverStack />;
  return <AppStack />;
}
