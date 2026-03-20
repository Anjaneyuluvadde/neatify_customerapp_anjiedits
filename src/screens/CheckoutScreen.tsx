import { Ionicons } from "@expo/vector-icons";
import { RouteProp, useFocusEffect, useNavigation } from "@react-navigation/native";
import * as Location from "expo-location";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  Vibration,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import Header from "../components/Header";
import LoadingOverlay from "../components/LoadingOverlay";
import AnimatedGradientBorder from "../components/AnimatedGradientBorder";

import { useTheme } from "../context/ThemeContext";
import { useLanguage } from "../context/LanguageContext";
import { processPayment } from "../lib/paymentService";
import { supabase } from "../lib/supabase";
import { RootStackParamList, SelectedService } from "../navigation/AppNavigator";
import { COLORS } from "../theme/colors";

/* ================= TYPES ================= */

type CheckoutRouteProp = RouteProp<RootStackParamList, "Checkout">;

type Props = {
  route: CheckoutRouteProp;
};

type Profile = {
  full_name: string;
  email: string;
  phone: string;
  address: string;
  pincode: string;
};

type Policies = {
  user_policies: string;
  terms_and_conditions: string;
};

/* ================= HELPERS ================= */

const parseDurationToMinutes = (duration: string) => {
  let minutes = 0;
  const hrMatch = duration.match(/(\d+)\s*hr/);
  const minMatch = duration.match(/(\d+)\s*min/);

  if (hrMatch) minutes += parseInt(hrMatch[1]) * 60;
  if (minMatch) minutes += parseInt(minMatch[1]);

  return minutes;
};

const formatMinutes = (mins: number) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h && m) return `${h} hrs ${m} mins`;
  if (h) return `${h} hrs`;
  return `${m} mins`;
};

const parsePrice = (price: string) => Number(price.replace(/[^\d]/g, ""));

const formatDisplayPhone = (phone: string | undefined | null) => {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) {
    return digits.slice(2);
  }
  return digits.length > 10 ? digits.slice(-10) : digits;
};

/* ================= COMPONENT ================= */

export default function CheckoutScreen({ route }: Props) {
  const navigation = useNavigation<any>();
  const { t } = useLanguage();
  const { theme, isDark } = useTheme();
  const { services, bookingDateText } = route.params;

  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  const [isProcessing, setIsProcessing] = useState(false);

  // Checkbox states for policies and terms
  const [acceptedPolicies, setAcceptedPolicies] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  // Modal states
  const [showPoliciesModal, setShowPoliciesModal] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [alertConfig, setAlertConfig] = useState<{
    title: string;
    message: string;
    type: 'error' | 'info' | 'warning';
  }>({ title: '', message: '', type: 'error' });

  // Address Form State
  const [manualAddress, setManualAddress] = useState("");
  const [pincode, setPincode] = useState("");

  // Location coordinates (not displayed, only stored in booking)
  const [bookingLatitude, setBookingLatitude] = useState<number | null>(null);
  const [bookingLongitude, setBookingLongitude] = useState<number | null>(null);
  const [fetchingLocation, setFetchingLocation] = useState(false);
  const [isAddressSummaryMode, setIsAddressSummaryMode] = useState(true);
  const [hasUsedLocationFetch, setHasUsedLocationFetch] = useState(true);

  // ✅ Pincode verification state
  const [isPincodeServiceable, setIsPincodeServiceable] = useState<boolean>(false);
  const [checkingPincode, setCheckingPincode] = useState<boolean>(false);

  // ✅ Dynamic Policies State
  const [policies, setPolicies] = useState<Policies | null>(null);

  // ✅ Coupon state
  const [coupon, setCoupon] = useState<{ id: string; coupon_code: string; discount_percentage: number } | null>(null);
  const [couponApplied, setCouponApplied] = useState(false);
  const [couponDiscount, setCouponDiscount] = useState(0);

  // ✅ Centralized Geocoding Helper
  const handleManualGeocode = async (addressToGeocode: string) => {
    if (!addressToGeocode || !addressToGeocode.trim()) return null;
    try {
      console.log("📍 Geocoding address:", addressToGeocode);
      const geoResults = await Location.geocodeAsync(addressToGeocode);
      if (geoResults && geoResults.length > 0) {
        const { latitude, longitude } = geoResults[0];
        setBookingLatitude(latitude);
        setBookingLongitude(longitude);
        console.log("✅ Geocode success:", latitude, longitude);
        return { latitude, longitude };
      }
    } catch (err) {
      console.log("⚠️ Geocoding failed for:", addressToGeocode, err);
    }
    return null;
  };

  // ✅ Function to view coordinates on external map
  const handleViewOnMap = async () => {
    let currentLat = bookingLatitude;
    let currentLng = bookingLongitude;

    // Proactive geocode if coordinates are missing
    if (!currentLat || !currentLng) {
      console.log("📍 Proactive geocode for map view...");
      const result = await handleManualGeocode(`${manualAddress}, ${pincode}`);
      if (result) {
        currentLat = result.latitude;
        currentLng = result.longitude;
      }
    }

    if (!currentLat || !currentLng) {
      setAlertConfig({
        title: "Location Missing",
        message: "Please fetch or enter your address first.",
        type: "warning"
      });
      setShowAlertModal(true);
      return;
    }

    const scheme = Platform.select({ ios: 'maps:0,0?q=', android: 'geo:0,0?q=' });
    const latLng = `${currentLat},${currentLng}`;
    const label = 'Service Location';
    const url = Platform.select({
      ios: `${scheme}${label}@${latLng}`,
      android: `${scheme}${latLng}(${label})`
    });

    if (url) {
      Linking.openURL(url).catch(err => {
        console.error("Failed to open map:", err);
      });
    }
  };

  /* ================= PINCODE CHECK FUNCTION ================= */

  const checkPincodeServiceable = async (pin: string) => {
    const cleanedPin = pin.trim();

    if (cleanedPin.length !== 6) {
      setIsPincodeServiceable(false);
      return;
    }

    try {
      setCheckingPincode(true);

      const { data, error } = await supabase
        .from("neatify_service_areas")
        .select("id")
        .eq("pincode", cleanedPin)
        .limit(1);

      if (error) {
        console.log("Pincode check error:", error.message);
        setIsPincodeServiceable(false);
        return;
      }

      setIsPincodeServiceable(!!(data && data.length > 0));
    } catch (err) {
      console.log("Pincode check failed:", err);
      setIsPincodeServiceable(false);
    } finally {
      setCheckingPincode(false);
    }
  };

  useEffect(() => {
    checkPincodeServiceable(pincode);
  }, [pincode]);

  /* ================= FETCH POLICIES ================= */

  useEffect(() => {
    const fetchPolicies = async () => {
      const { data, error } = await supabase
        .from("app_policies")
        .select("user_policies, terms_and_conditions")
        .limit(1)
        .maybeSingle();

      if (error) {
        console.log("Error fetching policies:", error);
      } else if (data) {
        setPolicies(data as Policies);
      }
    };

    fetchPolicies();
  }, []);

  /* ================= LOAD PROFILE ================= */

  useEffect(() => {
    const loadProfile = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;

      setUserId(data.user.id);

      const { data: profileData, error } = await supabase
        .from("profile")
        .select("full_name,email,phone,address,pincode")
        .eq("id", data.user.id)
        .maybeSingle();

      if (error) {
        setAlertConfig({ title: 'Error', message: error.message, type: 'error' });
        setShowAlertModal(true);
        setLoadingProfile(false);
        return;
      }

      if (profileData) {
        // Apply phone formatting
        const cleanedProfile = {
          ...profileData,
          phone: formatDisplayPhone(profileData.phone)
        };
        setProfile(cleanedProfile);

        // ✅ Check for coupon linked to this phone number
        const userPhone = formatDisplayPhone(profileData.phone); // 10-digit
        const { data: couponData } = await supabase
          .from("coupons")
          .select("id, coupon_code, discount_percentage")
          .eq("phone_number", userPhone)
          .eq("is_used", false)
          .maybeSingle();

        if (couponData) {
          setCoupon(couponData);
        }

        setPincode(profileData.pincode || "");

        if (profileData.address) {
          const addressWithoutPincode = profileData.address
            .replace(/\s*-\s*\d{6}\s*$/, "")
            .trim();

          setManualAddress(addressWithoutPincode);
          setIsAddressSummaryMode(true);
          setHasUsedLocationFetch(true);

          // ✅ Automatically geocode the saved profile address on load
          handleManualGeocode(`${addressWithoutPincode}, ${profileData.pincode || ""}`);
        }
      } else {
        setAlertConfig({
          title: 'Profile Not Found',
          message: 'Please complete your profile before booking',
          type: 'warning'
        });
        setShowAlertModal(true);
        navigation.navigate("MainTabs", { screen: "ProfileTab" });
      }

      setLoadingProfile(false);
    };

    loadProfile();
  }, []);

  /* ================= SCREEN FOCUS EFFECT ================= */

  useFocusEffect(
    React.useCallback(() => {
      Location.requestForegroundPermissionsAsync().catch((err) => {
        console.log("Location permission pre-request failed:", err);
      });
      return () => { };
    }, [])
  );

  /* ================= LOCATION ================= */

  const fetchCurrentLocation = async () => {
    if (!userId) return;

    const { status } = await Location.requestForegroundPermissionsAsync();

    if (status !== "granted") {
      setAlertConfig({
        title: 'Permission Denied',
        message: 'Location access is required to use this feature',
        type: 'warning'
      });
      setShowAlertModal(true);
      return;
    }

    setFetchingLocation(true);

    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const { latitude, longitude } = location.coords;

      // Store coordinates for booking
      setBookingLatitude(latitude);
      setBookingLongitude(longitude);

      // Use Expo's native geocoder (uses Google on Android — most accurate for India)
      try {
        const addressList = await Location.reverseGeocodeAsync({ latitude, longitude });

        if (addressList[0]) {
          const addr: any = addressList[0];

          // Debug: log ALL fields to see what's available
          console.log("📍 Expo Geocoder raw response:", JSON.stringify(addr, null, 2));

          // Try to extract area from formattedAddress (Android returns full Google address)
          const fullAddr: string = addr.formattedAddress || "";
          console.log("📍 formattedAddress:", fullAddr);

          if (fullAddr) {
            // Parse the formatted address: "Premises, Street, Locality, City, State, PIN, Country"
            const parts = fullAddr.split(",").map((p: string) => p.trim()).filter((p: string) => p);

            // 1. Extract Pincode (any 6 digit number)
            let pinIdx = -1;
            for (let i = parts.length - 1; i >= 0; i--) {
              const pinMatch = parts[i].match(/\b(\d{6})\b/);
              if (pinMatch) {
                setPincode(pinMatch[1]);
                pinIdx = i;
                break;
              }
            }
            if (pinIdx === -1 && addr.postalCode) setPincode(addr.postalCode);

            // Try to extract a clean street address for the manual field
            setManualAddress(fullAddr || "");

            setIsAddressSummaryMode(true);
            setHasUsedLocationFetch(true);
          } else {
            setManualAddress(addr.street || addr.district || addr.subregion || "");
            if (addr.postalCode) setPincode(addr.postalCode);
            setIsAddressSummaryMode(false);
          }
        }
      } catch (geoErr) {
        console.log("Geocoding failed:", geoErr);
      }
    } catch (err) {
      console.error("Location fetch error:", err);
      setAlertConfig({
        title: 'Location Error',
        message: 'Could not fetch your location. Please try again or enter manually.',
        type: 'error'
      });
      setShowAlertModal(true);
    } finally {
      setFetchingLocation(false);
    }
  };

  /* ================= COUPON ================= */

  const applyCoupon = () => {
    if (!coupon) return;
    setCouponDiscount(coupon.discount_percentage);
    setCouponApplied(true);
  };

  const removeCoupon = () => {
    setCouponDiscount(0);
    setCouponApplied(false);
  };

  /* ================= TOTALS ================= */

  const totalPrice = useMemo(
    () => services.reduce((sum, s) => {
      const qty = s.quantity || 1;
      return sum + (parsePrice(s.price) * qty);
    }, 0),
    [services]
  );

  const totalOriginalPrice = useMemo(
    () => services.reduce((sum, s) => {
      const qty = s.quantity || 1;
      if (s.original_price && Number(String(s.original_price).replace(/[^\d.]/g, '')) > 0) {
        return sum + (Number(String(s.original_price).replace(/[^\d.]/g, '')) * qty);
      }
      return sum + (parsePrice(s.price) * qty);
    }, 0),
    [services]
  );

  const totalSavings = useMemo(
    () => totalOriginalPrice - totalPrice,
    [totalOriginalPrice, totalPrice]
  );

  const totalDuration = useMemo(
    () =>
      formatMinutes(
        services.reduce((sum, s) => {
          const qty = s.quantity || 1;
          return sum + (parseDurationToMinutes(s.duration) * qty);
        }, 0)
      ),
    [services]
  );

  const totalTax = useMemo(
    () => services.reduce((sum, s) => {
      const qty = s.quantity || 1;
      const servicePrice = parsePrice(s.price);
      // Parse tax_percent - handle text type with "%" symbol
      const taxPercentStr = String(s.tax_percent ?? '0').replace(/%/g, '').trim();
      const taxPercent = Number(taxPercentStr) || 0;
      return sum + ((servicePrice * taxPercent) / 100) * qty;
    }, 0),
    [services]
  );

  const grandTotal = useMemo(() => {
    const baseTotal = totalPrice + totalTax;
    if (couponApplied && couponDiscount > 0) {
      const discountAmount = (baseTotal * couponDiscount) / 100;
      return baseTotal - discountAmount;
    }
    return baseTotal;
  }, [totalPrice, totalTax, couponApplied, couponDiscount]);

  /* ================= PAYMENT ================= */

  const handlePlaceOrder = async () => {
    if (!userId || !profile) {
      setAlertConfig({ title: 'Error', message: 'Missing user profile', type: 'error' });
      setShowAlertModal(true);
      return;
    }

    if (isProcessing) return;

    // ✅ Validate Name and Phone
    if (!profile.full_name.trim()) {
      setAlertConfig({
        title: 'Missing Name',
        message: 'Please enter your name to proceed.',
        type: 'warning'
      });
      setShowAlertModal(true);
      return;
    }

    if (!profile.phone.trim()) {
      setAlertConfig({
        title: 'Missing Phone Number',
        message: 'Please enter your phone number to proceed.',
        type: 'warning'
      });
      setShowAlertModal(true);
      return;
    }

    // ✅ Validate Phone Number (Must be exactly 10 digits)
    const phoneDigits = profile.phone.replace(/\D/g, ''); // Remove non-digits
    if (phoneDigits.length !== 10) {
      setAlertConfig({
        title: 'Invalid Phone Number',
        message: 'Phone number must be exactly 10 digits.',
        type: 'warning'
      });
      setShowAlertModal(true);
      return;
    }

    // ✅ Validate Address
    if (!manualAddress.trim() || !pincode.trim()) {
      setAlertConfig({
        title: 'Missing Address',
        message: 'Please enter your full address and pincode.',
        type: 'warning'
      });
      setShowAlertModal(true);
      return;
    }

    if (pincode.trim().length !== 6) {
      setAlertConfig({
        title: 'Invalid Pincode',
        message: 'Please enter a valid 6-digit pincode.',
        type: 'warning'
      });
      setShowAlertModal(true);
      return;
    }

    // ✅ Validate Checkboxes
    if (!acceptedPolicies || !acceptedTerms) {
      setAlertConfig({
        title: 'Agreement Required',
        message: 'Please accept both User Policies and Terms & Conditions to proceed with payment.',
        type: 'info'
      });
      setShowAlertModal(true);
      return;
    }

    // ✅ Block payment if pincode not serviceable
    if (!isPincodeServiceable) {
      setAlertConfig({
        title: 'Service Not Available',
        message: 'Services will be available soon in your area.',
        type: 'info'
      });
      setShowAlertModal(true);
      return;
    }

    setIsProcessing(true);

    const fullAddress = `${manualAddress.trim()} - ${pincode.trim()}`;

    // ✅ Auto-save profile
    supabase
      .from("profile")
      .update({
        // full_name: profile.full_name, // Don't overwrite profile name with booking name
        // phone: profile.phone,         // Don't overwrite profile phone with booking phone
        address: fullAddress,
        pincode: pincode,
      })
      .eq("id", userId)
      .then(({ error }) => {
        if (error) console.log("Failed to auto-save profile", error);
      });

    const [datePart, timePart] = bookingDateText.split(" at ");

    let finalLat = bookingLatitude;
    let finalLng = bookingLongitude;

    // ✅ Silent Geocoding: If coordinates are missing (manual entry), try to geocode the address
    if (!finalLat || !finalLng) {
      try {
        console.log("📍 Missing coordinates. Attempting silent geocode for:", fullAddress);
        const geoResults = await Location.geocodeAsync(fullAddress);
        if (geoResults && geoResults.length > 0) {
          finalLat = geoResults[0].latitude;
          finalLng = geoResults[0].longitude;
          console.log("✅ Silent geocode success:", finalLat, finalLng);
          // Also update state so it's consistent
          setBookingLatitude(finalLat);
          setBookingLongitude(finalLng);
        }
      } catch (geoErr) {
        console.log("⚠️ Silent geocoding failed", geoErr);
      }
    }

    try {
      /* ================= 1️⃣ CREATE BOOKING (PENDING) ================= */

      const { data: bookingData, error: insertError } = await supabase
        .from("bookings")
        .insert([
          {
  user_id: userId,
  customer_name: profile.full_name,
  email: profile.email,
  phone_number: profile.phone,
  full_address: fullAddress,
  latitude: finalLat,
  longitude: finalLng,
  services: services,
  booking_date: datePart,
  booking_time: timePart,
  total_amount: Number(grandTotal.toFixed(2)),
  payment_status: "pending",
  payment_method: "razorpay",

  // ✅🔥 ADD THIS LINE (IMPORTANT)
  platform: Platform.OS === "ios" ? "ios" : "android",

  coupon_code: couponApplied && coupon ? coupon.coupon_code : null,
  coupon_discount_percentage: couponApplied && coupon ? couponDiscount : 0,
  coupon_discount_amount: couponApplied && coupon ? Number(((totalPrice + totalTax) * couponDiscount / 100).toFixed(2)) : 0,
}
        ])
        .select("id")
        .single();

      if (insertError || !bookingData) {
        throw new Error(insertError?.message || "Failed to create booking");
      }

      const bookingId = bookingData.id;
      console.log("✅ Booking created with ID:", bookingId);

      /* ================= 2️⃣ PROCESS PAYMENT ================= */

      const [firstName, ...rest] = profile.full_name.split(" ");
      const lastName = rest.join(" ");

      const payment = await processPayment(Number(grandTotal.toFixed(2)), {
        firstName,
        lastName,
        email: profile.email,
        phone: profile.phone,
        address: fullAddress,
        city: "", // Consolidated into fullAddress
        region: "",
        zip: pincode,
      }, bookingId);

      if (!payment?.success) {
        // ✅ Update booking to "failed" status
        await supabase
          .from("bookings")
          .update({ payment_status: "failed", work_status: "PAYMENT FAILED" })
          .eq("id", bookingId);

        setIsProcessing(false);
        setAlertConfig({ title: 'Payment Failed', message: 'Your booking has been saved. You can retry payment from My Bookings.', type: 'error' });
        setShowAlertModal(true);
        return;
      }

      /* ================= 3️⃣ SUCCESS ================= */
      // Note: verify-payment edge function already updates payment_status to "paid"
      // This is a client-side backup update in case the edge function had issues

      await supabase
        .from("bookings")
        .update({
          payment_status: "paid",
          razorpay_payment_id: payment.paymentId,
          razorpay_order_id: payment.orderId,
          razorpay_signature: payment.signature,
          payment_verified: true,
        })
        .eq("id", bookingId);

      // ✅ Mark coupon as used (if applied)
      if (couponApplied && coupon) {
        await supabase
          .from("coupons")
          .update({ is_used: true })
          .eq("id", coupon.id);
        console.log("✅ Coupon marked as used:", coupon.coupon_code);
      }

      // ✅ Send Booking Confirmation Email
      try {
        await supabase.functions.invoke("send-booking-confirmation", {
          body: { booking_id: bookingId },
        });
        console.log("✅ Booking confirmation email sent");
      } catch (emailError) {
        console.error("Email sending failed (non-critical):", emailError);
        // Don't fail the booking if email fails
      }

      // Clear cart
      await supabase.from("cart").delete().eq("user_id", userId);

      setIsProcessing(false);

      // ✅ SHOW SUCCESS MODAL + SMALL VIBRATION
      setShowSuccessModal(true);
      Vibration.vibrate(80);

      setTimeout(() => {
        setShowSuccessModal(false);
        navigation.reset({
          index: 1,
          routes: [{ name: "Home" }, { name: "MyBookings" }],
        });
      }, 2500);

    } catch (err: any) {
      console.error("❌ Order error:", err);
      setIsProcessing(false);
      setAlertConfig({
        title: 'Error',
        message: err?.message || 'Something went wrong. Please try again.',
        type: 'error'
      });
      setShowAlertModal(true);
    }
  };

  if (!profile && !loadingProfile) return null;

  /* ================= UI ================= */

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <Header />

      <View style={[styles.headerContainer, { backgroundColor: theme.background, borderBottomColor: theme.border }]}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>{t("checkout.title")}</Text>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: theme.background }}>
        <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.container}>
          {/* ORDER SUMMARY */}
          <View style={[styles.card, { backgroundColor: theme.background, borderColor: theme.border }]}>
            <View style={[styles.sectionHeader, { borderBottomColor: theme.border }]}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>{t("checkout.orderSummary")}</Text>
            </View>

            {services.map((s: SelectedService) => (
              <View key={s.id} style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.serviceTitle, { color: theme.text }]}>
                    {s.title}
                    {s.quantity && s.quantity > 1 ? ` (x${s.quantity})` : ""}
                  </Text>
                  <Text style={[styles.muted, { color: theme.textLight }]}>{s.duration}</Text>
                </View>

                {/* ✅ Pricing with discount - Calculate total based on quantity */}
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={[styles.price, { color: theme.text }]}>
                    ₹{(parseFloat(s.price.replace(/[^\d]/g, "")) * (s.quantity || 1)).toLocaleString("en-IN")}
                  </Text>
                  {(s.discount_label || (s.discount_percent && Number(s.discount_percent) > 0)) ? (
                    <Text style={{ fontSize: 10, color: "#1E7E34", fontWeight: "700" }}>
                      {s.discount_label || `${s.discount_percent}% off`}
                    </Text>
                  ) : null}
                </View>
              </View>
            ))}

            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            <Text style={[styles.muted, { color: theme.textLight }]}>{t("checkout.totalDuration")}: {totalDuration}</Text>

            {/* ✅ Original Total (strikethrough if there are savings) */}
            {totalSavings > 0 ? (
              <View style={{ marginTop: 8 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
                  <Text style={{ color: theme.textLight, fontSize: 14 }}>{t("checkout.originalTotal")}</Text>
                  <Text style={{ color: theme.textLight, fontSize: 14, textDecorationLine: "line-through" }}>
                    ₹{totalOriginalPrice.toLocaleString("en-IN")}
                  </Text>
                </View>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
                  <Text style={{ color: "#1E7E34", fontSize: 14, fontWeight: "600" }}>{t("checkout.youSave")}</Text>
                  <Text style={{ color: "#1E7E34", fontSize: 14, fontWeight: "600" }}>
                    ₹{totalSavings.toLocaleString("en-IN")}
                  </Text>
                </View>
              </View>
            ) : null}

            {/* ✅ Subtotal */}
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 8 }}>
              <Text style={{ fontSize: 15, fontWeight: "600", color: theme.text }}>Subtotal</Text>
              <Text style={{ fontSize: 15, fontWeight: "600", color: theme.text }}>₹{totalPrice.toLocaleString("en-IN")}</Text>
            </View>

            {/* ✅ Tax */}
            {totalTax > 0 && (
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
                <Text style={{ fontSize: 14, color: theme.textLight }}>Tax</Text>
                <Text style={{ fontSize: 14, color: theme.textLight }}>₹{parseFloat(totalTax.toFixed(2)).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
              </View>
            )}

            {/* ✅ Coupon Discount Row */}
            {couponApplied && couponDiscount > 0 && (
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
                <Text style={{ fontSize: 14, color: "#065F46", fontWeight: "600" }}>
                  Coupon ({coupon?.coupon_code})
                </Text>
                <Text style={{ fontSize: 14, color: "#065F46", fontWeight: "600" }}>
                  -{couponDiscount}%
                </Text>
              </View>
            )}

            {/* ✅ Grand Total */}
            <View style={styles.totalRow}>
              <Text style={[styles.totalLabel, { color: theme.text }]}>{t("checkout.totalAmount")}</Text>
              <Text style={styles.totalValue}>₹{parseFloat(grandTotal.toFixed(2)).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
            </View>
          </View>

          {/* ✅ COUPON CARD - Only shown if user has an active coupon */}
          {coupon && (
            <View style={styles.couponCard}>
              <Text style={styles.couponTitle}>🎉 You have a coupon!</Text>
              <View style={styles.couponRow}>
                <View style={styles.couponCodeBox}>
                  <Text style={styles.couponCode}>{coupon.coupon_code}</Text>
                </View>
                {couponApplied ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <View style={styles.couponAppliedBadge}>
                      <Text style={styles.couponAppliedText}>✅ {coupon.discount_percentage}% off</Text>
                    </View>
                    <Pressable onPress={removeCoupon}>
                      <Text style={{ color: "#EF4444", fontWeight: "700", fontSize: 13 }}>Remove</Text>
                    </Pressable>
                  </View>
                ) : (
                  <Pressable style={styles.couponApplyBtn} onPress={applyCoupon}>
                    <Text style={styles.couponApplyBtnText}>Apply</Text>
                  </Pressable>
                )}
              </View>
              {couponApplied && (
                <Text style={styles.couponSavingText}>
                  You save ₹{((totalPrice + totalTax) * coupon.discount_percentage / 100).toFixed(2)} with this coupon!
                </Text>
              )}
            </View>
          )}

          {/* ADDRESS */}
          <Text style={[styles.sectionHeading, { color: theme.text }]}>{t("checkout.serviceAddress")}</Text>

          <View style={[styles.card, { backgroundColor: theme.background, borderColor: theme.border }]}>
            {/* User Details */}
            <View style={{ marginBottom: 12 }}>
              <Text style={[styles.label, { color: theme.text }]}>{t("checkout.name")}</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.surfaceVariant, borderColor: theme.border, color: theme.text }]}
                value={profile?.full_name}
                placeholderTextColor={theme.textLight}
                onChangeText={(text) =>
                  setProfile((prev) => (prev ? { ...prev, full_name: text } : null))
                }
              />

              <Text style={[styles.label, { color: theme.text }]}>{t("checkout.phone")}</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.surfaceVariant, borderColor: theme.border, color: theme.text }]}
                value={profile?.phone}
                onChangeText={(text) => {
                  const onlyDigits = text.replace(/\D/g, "");
                  setProfile((prev) => (prev ? { ...prev, phone: onlyDigits } : null));
                }}
                keyboardType="phone-pad"
                maxLength={10}
                placeholder="10-digit mobile number"
                placeholderTextColor={theme.textLight}
              />
            </View>

            {/* Address Inputs */}
            <View style={{ marginTop: 8 }}>

              <View style={[styles.addressSection, { backgroundColor: theme.background, borderColor: theme.border }]}>
                {/* ✅ SMART ADDRESS CARD (Shown after Use Location) */}
                {isAddressSummaryMode && hasUsedLocationFetch ? (
                  <View style={[styles.summaryCard, { backgroundColor: theme.surfaceVariant }]}>
                    <View style={styles.summaryContent}>
                      <Pressable
                        style={[styles.locationIconCircle, { backgroundColor: theme.background, borderColor: theme.border }]}
                        onPress={handleViewOnMap}
                      >
                        <Ionicons name="location" size={20} color={theme.text} />
                      </Pressable>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.summaryTitle, { color: theme.textLight }]}>Selected Location</Text>
                        <Text style={[styles.summaryText, { color: theme.text }]}>
                          {`${manualAddress}${pincode ? " - " + pincode : ""}`}
                        </Text>
                      </View>
                      <Pressable
                        style={[styles.editButton, { backgroundColor: theme.background, borderColor: theme.border }]}
                        onPress={() => setIsAddressSummaryMode(false)}
                      >
                        <Ionicons name="create-outline" size={18} color={theme.text} />
                        <Text style={[styles.editButtonText, { color: theme.text }]}>Edit</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <View style={{ padding: 16 }}>
                    <Text style={[styles.label, { color: theme.text }]}>{t("checkout.fullAddress")}</Text>
                    <TextInput
                      style={[styles.input, { height: 100, textAlignVertical: 'top', paddingTop: 12, backgroundColor: theme.surfaceVariant, borderColor: theme.border, color: theme.text }]}
                      value={manualAddress}
                      onChangeText={setManualAddress}
                      placeholder="e.g. Plot no 1821, flat no 402, Sri sai nilayam, Pragathi nagar, Hyderabad"
                      placeholderTextColor={theme.textLight}
                      multiline
                      numberOfLines={4}
                    />

                    <Text style={[styles.label, { color: theme.text }]}>{t("checkout.pincode")}</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: theme.surfaceVariant, borderColor: theme.border, color: theme.text }]}
                      value={pincode}
                      onChangeText={(text) => {
                        const onlyDigits = text.replace(/\D/g, "");
                        setPincode(onlyDigits);
                      }}
                      keyboardType="numeric"
                      maxLength={6}
                      placeholder="500090"
                      placeholderTextColor={theme.textLight}
                    />

                    {/* ✅ DONE BUTTON (Return to summary) */}
                    {hasUsedLocationFetch && (
                      <Pressable
                        style={styles.doneButton}
                        onPress={async () => {
                          setIsAddressSummaryMode(true);
                          // ✅ Instantly geocode when finishing manual entry
                          handleManualGeocode(`${manualAddress}, ${pincode}`);
                        }}
                      >
                        <Ionicons name="checkmark-done" size={18} color="#fff" />
                        <Text style={styles.doneButtonText}>Done Editing</Text>
                      </Pressable>
                    )}
                  </View>
                )}
              </View>

              {/* ✅ FULL WIDTH PINCODE STATUS BADGE (Always visible or after pincode entered) */}
              {pincode.length === 6 && (
                <View
                  style={[
                    styles.serviceStatusBox,
                    checkingPincode
                      ? styles.serviceCheckingBox
                      : isPincodeServiceable
                        ? styles.serviceAvailableBox
                        : styles.serviceUnavailableBox,
                    { marginTop: 12 }
                  ]}
                >
                  <Ionicons
                    name={
                      checkingPincode
                        ? "time-outline"
                        : isPincodeServiceable
                          ? "checkmark-circle"
                          : "close-circle"
                    }
                    size={18}
                    color={
                      checkingPincode
                        ? "#64748b"
                        : isPincodeServiceable
                          ? "#10B981"
                          : "#EF4444"
                    }
                  />

                  <View style={{ flex: 1 }}>
                    <Text style={styles.serviceStatusText}>
                      {checkingPincode
                        ? t("checkout.checking")
                        : isPincodeServiceable
                          ? t("checkout.serviceAvailable")
                          : t("checkout.serviceNotAvailable")}
                    </Text>

                    {!checkingPincode && (
                      <Text style={styles.serviceSubText} numberOfLines={1}>
                        {isPincodeServiceable
                          ? "You can continue with booking."
                          : "We will be available soon in your area."}
                      </Text>
                    )}
                  </View>
                </View>
              )}

              <Pressable onPress={fetchCurrentLocation} style={[styles.secondaryBtn, { backgroundColor: theme.background, borderColor: theme.primary }]} disabled={fetchingLocation}>
                {fetchingLocation ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <ActivityIndicator size="small" color={theme.primary} />
                    <Text style={[styles.secondaryBtnText, { color: theme.primary }]}>Fetching Location...</Text>
                  </View>
                ) : (
                  <Text style={[styles.secondaryBtnText, { color: theme.primary }]}>{t("checkout.useLocation")}</Text>
                )}
              </Pressable>
            </View>
          </View>

          {/* CHECKBOXES */}
          <View style={styles.checkboxContainer}>
            <Pressable style={styles.checkboxRow} onPress={() => setAcceptedPolicies(!acceptedPolicies)}>
              <View style={[styles.checkbox, acceptedPolicies && { backgroundColor: theme.primary, borderColor: theme.primary }, !acceptedPolicies && { borderColor: theme.primary, backgroundColor: theme.background }]}>
                {acceptedPolicies && <Ionicons name="checkmark" size={16} color={theme.background} />}
              </View>
              <Text style={[styles.checkboxLabel, { flex: 0, color: theme.text }]}>
                {t("checkout.acceptPolicies")}{" "}
                <Text
                  style={[styles.linkText, { color: theme.primary }]}
                  onPress={(e) => {
                    e.stopPropagation();
                    setShowPoliciesModal(true);
                  }}
                >
                  {t("checkout.policies")}
                </Text>
              </Text>
            </Pressable>

            <Pressable style={styles.checkboxRow} onPress={() => setAcceptedTerms(!acceptedTerms)}>
              <View style={[styles.checkbox, acceptedTerms && { backgroundColor: theme.primary, borderColor: theme.primary }, !acceptedTerms && { borderColor: theme.primary, backgroundColor: theme.background }]}>
                {acceptedTerms && <Ionicons name="checkmark" size={16} color={theme.background} />}
              </View>
              <Text style={[styles.checkboxLabel, { flex: 0, color: theme.text }]}>
                {t("checkout.acceptTerms")}{" "}
                <Text
                  style={[styles.linkText, { color: theme.primary }]}
                  onPress={(e) => {
                    e.stopPropagation();
                    setShowTermsModal(true);
                  }}
                >
                  {t("checkout.terms")}
                </Text>
              </Text>
            </Pressable>
          </View>

          {/* PAY BUTTON */}
          <Pressable
            style={[
              styles.payBtn,
              { backgroundColor: theme.primary },
              (isProcessing ||
                checkingPincode ||
                !acceptedPolicies ||
                !acceptedTerms ||
                !isPincodeServiceable) &&
              styles.payBtnDisabled,
            ]}
            onPress={handlePlaceOrder}
            disabled={
              isProcessing ||
              checkingPincode ||
              !acceptedPolicies ||
              !acceptedTerms ||
              !isPincodeServiceable
            }
          >
            <Text style={[styles.payText, { color: theme.background }]}>
              {isProcessing
                ? t("checkout.processing")
                : checkingPincode
                  ? t("checkout.checking")
                  : !isPincodeServiceable && pincode.length === 6
                    ? t("checkout.serviceNotAvailable")
                    : t("checkout.placeOrder")}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Loading Overlay */}
      <LoadingOverlay visible={isProcessing} message="Processing your payment..." />

      {/* Policies Modal */}
      <Modal
        visible={showPoliciesModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPoliciesModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.background }]}>
            <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>{t("checkout.policies")}</Text>
              <Pressable onPress={() => setShowPoliciesModal(false)}>
                <Ionicons name="close" size={24} color={theme.text} />
              </Pressable>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <Text style={styles.modalHeading}>Privacy & Data Protection</Text>
              <Text style={[styles.modalText, { color: theme.textLight }]}>
                {policies?.user_policies
                  ? policies.user_policies.replace(/^- /gm, '• ')
                  : "Loading policies..."}
              </Text>
            </ScrollView>

            <Pressable style={[styles.modalCloseButton, { backgroundColor: theme.primary }]} onPress={() => setShowPoliciesModal(false)}>
              <Text style={[styles.modalCloseButtonText, { color: theme.background }]}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Terms Modal */}
      <Modal
        visible={showTermsModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowTermsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.background }]}>
            <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>{t("checkout.terms")}</Text>
              <Pressable onPress={() => setShowTermsModal(false)}>
                <Ionicons name="close" size={24} color={theme.text} />
              </Pressable>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <Text style={styles.modalHeading}>Agreement to Terms</Text>
              <Text style={[styles.modalText, { color: theme.textLight }]}>
                {policies?.terms_and_conditions
                  ? policies.terms_and_conditions.replace(/^- /gm, '• ')
                  : "Loading terms..."}
              </Text>
            </ScrollView>

            <Pressable style={[styles.modalCloseButton, { backgroundColor: theme.primary }]} onPress={() => setShowTermsModal(false)}>
              <Text style={[styles.modalCloseButtonText, { color: theme.background }]}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Success Modal */}
      <Modal
        visible={showSuccessModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSuccessModal(false)}
      >
        <View style={styles.successOverlay}>
          <AnimatedGradientBorder
            borderRadius={24}
            borderWidth={2}
            animationSpeed={3}
            style={{ width: "85%", maxWidth: 400 }}
          >
            <View style={[styles.successContent, { width: "100%", borderRadius: 24, margin: 0, backgroundColor: theme.background }]}>
              <View style={styles.successIconContainer}>
                <Ionicons name="checkmark-circle" size={80} color={theme.primary} />
              </View>

              <Text style={[styles.successTitle, { color: theme.text }]}>{t("checkout.bookingConfirmed")}</Text>
              <Text style={[styles.successMessage, { color: theme.textLight }]}>
                {t("notifications.bookingSuccessMessage")}
              </Text>

              <Text style={[styles.redirectText, { color: theme.primary }]}>{t("checkout.redirecting")}</Text>
            </View>
          </AnimatedGradientBorder>
        </View>
      </Modal>

      {/* Custom Alert Modal */}
      <Modal
        visible={showAlertModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAlertModal(false)}
      >
        <View style={styles.alertOverlay}>
          <AnimatedGradientBorder
            borderRadius={20}
            borderWidth={2}
            animationSpeed={3}
            style={{ width: "100%", maxWidth: 360 }}
          >
            <View style={[styles.alertContent, { width: "100%", borderRadius: 20, margin: 0, backgroundColor: theme.background }]}>
              {/* Icon based on type */}
              <View style={styles.alertIconContainer}>
                <Ionicons
                  name={
                    alertConfig.type === 'error'
                      ? 'close-circle'
                      : alertConfig.type === 'warning'
                        ? 'alert-circle'
                        : 'information-circle'
                  }
                  size={64}
                  color={
                    alertConfig.type === 'error'
                      ? '#EF4444'
                      : alertConfig.type === 'warning'
                        ? '#F59E0B'
                        : '#3B82F6'
                  }
                />
              </View>

              {/* Title and Message */}
              <Text style={[styles.alertTitle, { color: theme.text }]}>{alertConfig.title}</Text>
              <Text style={[styles.alertMessage, { color: theme.textLight }]}>{alertConfig.message}</Text>

              {/* OK Button */}
              <Pressable
                style={[
                  styles.alertButton,
                  { backgroundColor: theme.primary },
                  alertConfig.type === 'error' && styles.alertButtonError,
                  alertConfig.type === 'warning' && styles.alertButtonWarning,
                  alertConfig.type === 'info' && styles.alertButtonInfo,
                ]}
                onPress={() => setShowAlertModal(false)}
              >
                <Text style={styles.alertButtonText}>OK</Text>
              </Pressable>
            </View>
          </AnimatedGradientBorder>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/* ================= STYLES ================= */

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#fff",
  },
  headerContainer: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#333",
  },
  container: {
    padding: 20,
    paddingBottom: 100,
  },
  sectionHeading: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 10,
    marginTop: 20,
    color: "#333",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#f1f5f9",
  },
  sectionHeader: {
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    paddingBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#475569",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  serviceTitle: {
    fontWeight: "600",
    fontSize: 15,
    color: "#1e293b",
  },
  divider: {
    height: 1,
    backgroundColor: "#f1f5f9",
    marginVertical: 12,
  },
  muted: {
    color: "#64748b",
    fontSize: 13,
    marginTop: 2,
  },
  price: {
    fontWeight: "700",
    fontSize: 15,
    color: "#1e293b",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
    alignItems: "center",
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  totalValue: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.saffron,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#475569",
    marginBottom: 6,
    marginTop: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    backgroundColor: "#f8fafc",
    fontSize: 14,
    color: "#333",
  },
  rowInputs: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: COLORS.saffron,
    padding: 12,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 10,
    backgroundColor: "#fff",
  },
  secondaryBtnText: {
    color: COLORS.saffron,
    fontWeight: "600",
  },
  addressSection: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    overflow: "hidden",
  },
  summaryCard: {
    backgroundColor: "#F8FAFC",
    padding: 16,
  },
  summaryContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  locationIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  summaryTitle: {
    fontSize: 12,
    // fontFamily: "Outfit-Medium", // Assuming Outfit-Medium is defined elsewhere or removed
    color: "#64748b",
    marginBottom: 2,
    textTransform: "uppercase",
  },
  summaryText: {
    fontSize: 14,
    // fontFamily: "Outfit-Regular", // Assuming Outfit-Regular is defined elsewhere or removed
    color: "#1e293b",
    lineHeight: 20,
  },
  editButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 4,
  },
  editButtonText: {
    fontSize: 12,
    // fontFamily: "Outfit-Bold", // Assuming Outfit-Bold is defined elsewhere or removed
    color: "#1e293b",
  },
  doneButton: {
    backgroundColor: "#1e293b",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
    gap: 8,
  },
  doneButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  pincodeStatusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginTop: 12,
    gap: 8,
  },
  pincodeStatusAvailable: {
    backgroundColor: "#ECFDF5",
    borderColor: "#10B981",
    borderWidth: 1,
  },
  pincodeStatusUnavailable: {
    backgroundColor: "#FEF2F2",
    borderColor: "#EF4444",
    borderWidth: 1,
  },
  pincodeStatusText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1e293b",
  },
  useLocationButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: COLORS.saffron,
    borderRadius: 8,
    marginTop: 12,
    gap: 8,
  },
  useLocationButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.buttonText,
  },
  checkboxContainer: {
    marginTop: 20,
    gap: 12,
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 2,
    borderColor: COLORS.saffron,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  checkboxChecked: {
    backgroundColor: COLORS.saffron,
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 20,
  },
  linkText: {
    color: COLORS.saffron,
    fontWeight: "600",
    textDecorationLine: "underline",
  },
  payBtn: {
    backgroundColor: COLORS.saffron,
    padding: 18,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 10,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  payBtnDisabled: {
    opacity: 0.6,
  },
  payText: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.buttonText,
  },

  /* ✅ PROFESSIONAL SERVICE STATUS BADGE (FULL WIDTH) */
  serviceStatusBox: {
    marginTop: 2,
    width: "100%",
    alignSelf: "stretch",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
  },
  serviceAvailableBox: {
    backgroundColor: "#ECFDF5",
    borderColor: "#10B981",
  },
  serviceUnavailableBox: {
    backgroundColor: "#FEF2F2",
    borderColor: "#EF4444",
  },
  serviceCheckingBox: {
    backgroundColor: "#F1F5F9",
    borderColor: "#94A3B8",
  },
  serviceStatusText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
  },
  serviceSubText: {
    marginTop: 3,
    fontSize: 12,
    color: "#64748b",
    lineHeight: 16,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "85%",
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1e293b",
  },
  modalBody: {
    paddingHorizontal: 20,
    paddingTop: 16,
    maxHeight: "70%",
  },
  modalHeading: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.saffron,
    marginTop: 16,
    marginBottom: 8,
  },
  modalText: {
    fontSize: 14,
    lineHeight: 22,
    color: "#475569",
    marginBottom: 12,
    textAlign: "justify",
  },
  modalCloseButton: {
    backgroundColor: COLORS.saffron,
    marginHorizontal: 20,
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  modalCloseButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.buttonText,
  },
  successOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  successContent: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 32,
    alignItems: "center",
    width: "100%",
  },
  successIconContainer: {
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1e293b",
    marginBottom: 12,
    textAlign: "center",
  },
  successMessage: {
    fontSize: 16,
    lineHeight: 24,
    color: "#64748b",
    textAlign: "center",
    marginBottom: 20,
  },
  redirectText: {
    fontSize: 14,
    color: COLORS.saffron,
    fontStyle: "italic",
  },

  // Custom Alert Modal Styles
  alertOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  alertContent: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 28,
    alignItems: "center",
    width: "100%",
  },
  alertIconContainer: {
    marginBottom: 20,
  },
  alertTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1e293b",
    marginBottom: 12,
    textAlign: "center",
  },
  alertMessage: {
    fontSize: 15,
    lineHeight: 22,
    color: "#64748b",
    textAlign: "center",
    marginBottom: 24,
  },
  alertButton: {
    width: "100%",
    padding: 16,
    borderRadius: 14,
    alignItems: "center",
    backgroundColor: COLORS.saffron,
  },
  alertButtonError: {
    backgroundColor: "#EF4444",
  },
  alertButtonWarning: {
    backgroundColor: "#F59E0B",
  },
  alertButtonInfo: {
    backgroundColor: "#3B82F6",
  },
  alertButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
  },
  couponCard: {
    backgroundColor: "#FFFBEB",
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#FCD34D",
    borderStyle: "dashed" as any,
    padding: 16,
    marginBottom: 16,
  },
  couponTitle: {
    fontSize: 14,
    fontWeight: "700" as const,
    color: "#92400E",
    marginBottom: 10,
  },
  couponRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 10,
  },
  couponCodeBox: {
    flex: 1,
    backgroundColor: "#FEF3C7",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#FCD34D",
  },
  couponCode: {
    fontSize: 16,
    fontWeight: "800" as const,
    color: "#78350F",
    letterSpacing: 2,
  },
  couponApplyBtn: {
    backgroundColor: "#F59E0B",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  couponApplyBtnText: {
    color: "#fff",
    fontWeight: "700" as const,
    fontSize: 14,
  },
  couponAppliedBadge: {
    backgroundColor: "#D1FAE5",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  couponAppliedText: {
    color: "#065F46",
    fontWeight: "700" as const,
    fontSize: 13,
  },
  couponSavingText: {
    marginTop: 8,
    fontSize: 12,
    color: "#065F46",
    fontWeight: "600" as const,
  },
});
