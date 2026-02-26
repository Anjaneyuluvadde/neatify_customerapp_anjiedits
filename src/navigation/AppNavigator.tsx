import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React from "react";

import BookingDetailsScreen from "../screens/BookingDetailsScreen";
import BookingScreen from "../screens/BookingScreen";
import CheckoutScreen from "../screens/CheckoutScreen";
import HomeScreen from "../screens/HomeScreen";
import LoginScreen from "../screens/LoginScreen";
import MyBookingsScreen from "../screens/MyBookingsScreen";
import ProfileScreen from "../screens/ProfileScreen";
import ResetPasswordScreen from "../screens/ResetPasswordScreen";
import ScheduleScreen from "../screens/ScheduleScreen";
import ServiceDetailScreen from "../screens/ServiceDetailScreen";
import CompleteProfileScreen from "../screens/CompleteProfileScreen";

import { Service } from "../types/service";

/* ================= TYPES ================= */

export type SelectedService = {
  id: string;
  title: string;
  duration: string;
  price: string;

  // optional fields from Supabase (used in ServiceDetail)
  description?: string | null;
  image_url?: string | null;

  // optional (used in cart UI)
  image?: string;

  // pricing fields
  original_price?: number | null;
  discount_percent?: number | null;
  discount_label?: string | null;
  tax_percent?: number | null;

  // quantity (for addons, tracks how many times added, max 3)
  quantity?: number;
};

export type RootStackParamList = {
  Login: undefined;
  Home: undefined;

  // Service detail shows ONE service
  ServiceDetail: {
    service?: Service;
    serviceId?: string;
  };

  Booking: {
    services: SelectedService[];
  };

  Schedule: {
    services: SelectedService[];
  };

  // ✅ ONLY Checkout (Payment removed)
  Checkout: {
    services: SelectedService[];
    total: number;
    bookingDateText: string;
  };

  Profile: undefined;
  MyBookings: undefined;
  ResetPassword: {
    access_token?: string;
    refresh_token?: string;
  };
  BookingDetails: {
    booking: any;
  };
  CompleteProfile: undefined;
};

/* ================= STACK ================= */

const Stack = createNativeStackNavigator<RootStackParamList>();

type AppNavigatorProps = {
  initialRouteName: keyof RootStackParamList;
};

/* ================= NAVIGATOR ================= */

export default function AppNavigator({ initialRouteName }: AppNavigatorProps) {
  return (
    <Stack.Navigator
      initialRouteName={initialRouteName}
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="ServiceDetail" component={ServiceDetailScreen} />

      <Stack.Screen name="Booking" component={BookingScreen} />
      <Stack.Screen name="Schedule" component={ScheduleScreen} />

      {/* ✅ Checkout is final step */}
      <Stack.Screen name="Checkout" component={CheckoutScreen} />

      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="MyBookings" component={MyBookingsScreen} />
      <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
      <Stack.Screen
        name="BookingDetails"
        component={BookingDetailsScreen}
      />
      {/* ✅ Complete Profile Screen */}
      <Stack.Screen name="CompleteProfile" component={CompleteProfileScreen} />
    </Stack.Navigator>
  );
}