import { Ionicons } from "@expo/vector-icons";
import { RouteProp, useFocusEffect, useNavigation } from "@react-navigation/native";
import * as Location from "expo-location";
import React, { useEffect, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
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

import { useLanguage } from "../context/LanguageContext";
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
  const [houseNo, setHouseNo] = useState("");
  const [area, setArea] = useState("");
  const [landmark, setLandmark] = useState("");
  const [city, setCity] = useState("");
  const [pincode, setPincode] = useState("");

  // ✅ Pincode verification state
  const [isPincodeServiceable, setIsPincodeServiceable] = useState<boolean>(false);
  const [checkingPincode, setCheckingPincode] = useState<boolean>(false);

  // ✅ Dynamic Policies State
  const [policies, setPolicies] = useState<Policies | null>(null);

  // ✅ Coupon state
  const [coupon, setCoupon] = useState<{ id: string; coupon_code: string; discount_percentage: number } | null>(null);
  const [couponApplied, setCouponApplied] = useState(false);
  const [couponDiscount, setCouponDiscount] = useState(0);

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

          const parts = addressWithoutPincode
            .split(",")
            .map((p: string) => p.trim())
            .filter((p: string) => p);

          if (parts.length >= 3) {
            setHouseNo(parts[0] || "");
            setArea(parts[1] || "");

            const lastPart = parts[parts.length - 1];

            if (parts.length === 4) {
              setLandmark(parts[2] || "");
              setCity(lastPart);
            } else if (parts.length === 3) {
              setLandmark("");
              setCity(lastPart);
            } else {
              const middleParts = parts.slice(2, -1).join(", ");
              setLandmark(middleParts);
              setCity(lastPart);
            }
          } else if (parts.length === 2) {
            setHouseNo(parts[0] || "");
            setArea("");
            setCity(parts[1] || "");
            setLandmark("");
          } else if (parts.length === 1) {
            setArea(parts[0] || "");
          }
        }
      } else {
        setAlertConfig({
          title: 'Profile Not Found',
          message: 'Please complete your profile before booking',
          type: 'warning'
        });
        setShowAlertModal(true);
        navigation.navigate("Profile");
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

    const location = await Location.getCurrentPositionAsync({});
    const addressList = await Location.reverseGeocodeAsync(location.coords);

    if (!addressList[0]) return;

    const addr = addressList[0];
    const street = addr.street || "";
    const locCity = addr.city || "";
    const locRegion = addr.region || "";
    const locPincode = addr.postalCode || "";

    setHouseNo(addr.name || "");
    setArea(`${street}`);
    setCity(`${locCity}, ${locRegion}`);
    setPincode(locPincode);
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
    if (!houseNo.trim() || !area.trim() || !landmark.trim() || !city.trim() || !pincode.trim()) {
      setAlertConfig({
        title: 'Missing Address',
        message: 'Please fill in all required address fields (House, Area, Landmark, City, Pincode).',
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

    const fullAddress = `${houseNo}, ${area}, ${landmark ? landmark + ", " : ""}${city} - ${pincode}`;

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
            services: services,
            booking_date: datePart,
            booking_time: timePart,
            total_amount: Number(grandTotal.toFixed(2)),
            payment_status: "pending",
            payment_method: "razorpay",
            coupon_code: couponApplied && coupon ? coupon.coupon_code : null,
            coupon_discount_percentage: couponApplied && coupon ? couponDiscount : 0,
            coupon_discount_amount: couponApplied && coupon ? Number(((totalPrice + totalTax) * couponDiscount / 100).toFixed(2)) : 0,
          },
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

      const { processPayment } = await import("../lib/paymentService");

      const payment = await processPayment(Number(grandTotal.toFixed(2)), {
        firstName,
        lastName,
        email: profile.email,
        phone: profile.phone,
        address: fullAddress,
        city: city,
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
    <SafeAreaView style={styles.safeArea}>
      <Header />

      <View style={styles.headerContainer}>
        <Text style={styles.headerTitle}>{t("checkout.title")}</Text>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.container}>
          {/* ORDER SUMMARY */}
          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t("checkout.orderSummary")}</Text>
            </View>

            {services.map((s: SelectedService) => (
              <View key={s.id} style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.serviceTitle}>
                    {s.title}
                    {s.quantity && s.quantity > 1 ? ` (x${s.quantity})` : ""}
                  </Text>
                  <Text style={styles.muted}>{s.duration}</Text>
                </View>

                {/* ✅ Pricing with discount - Calculate total based on quantity */}
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={styles.price}>
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

            <View style={styles.divider} />
            <Text style={styles.muted}>{t("checkout.totalDuration")}: {totalDuration}</Text>

            {/* ✅ Original Total (strikethrough if there are savings) */}
            {totalSavings > 0 ? (
              <View style={{ marginTop: 8 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
                  <Text style={{ color: "#777", fontSize: 14 }}>{t("checkout.originalTotal")}</Text>
                  <Text style={{ color: "#777", fontSize: 14, textDecorationLine: "line-through" }}>
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
              <Text style={{ fontSize: 15, fontWeight: "600" }}>Subtotal</Text>
              <Text style={{ fontSize: 15, fontWeight: "600" }}>₹{totalPrice.toLocaleString("en-IN")}</Text>
            </View>

            {/* ✅ Tax */}
            {totalTax > 0 && (
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
                <Text style={{ fontSize: 14, color: "#666" }}>Tax</Text>
                <Text style={{ fontSize: 14, color: "#666" }}>₹{parseFloat(totalTax.toFixed(2)).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
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
              <Text style={styles.totalLabel}>{t("checkout.totalAmount")}</Text>
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
          <Text style={styles.sectionHeading}>{t("checkout.serviceAddress")}</Text>

          <View style={styles.card}>
            {/* User Details */}
            <View style={{ marginBottom: 12 }}>
              <Text style={styles.label}>{t("checkout.name")}</Text>
              <TextInput
                style={styles.input}
                value={profile?.full_name}
                placeholderTextColor="#999"
                onChangeText={(text) =>
                  setProfile((prev) => (prev ? { ...prev, full_name: text } : null))
                }
              />

              <Text style={styles.label}>{t("checkout.phone")}</Text>
              <TextInput
                style={styles.input}
                value={profile?.phone}
                onChangeText={(text) => {
                  const onlyDigits = text.replace(/\D/g, "");
                  setProfile((prev) => (prev ? { ...prev, phone: onlyDigits } : null));
                }}
                keyboardType="phone-pad"
                maxLength={10}
                placeholder="10-digit mobile number"
                placeholderTextColor="#999"
              />
            </View>

            {/* Address Inputs */}
            <View>
              <Text style={styles.label}>{t("checkout.house")}</Text>
              <TextInput style={styles.input} value={houseNo} onChangeText={setHouseNo} placeholder="e.g. Flat 102" placeholderTextColor="#999" />

              <Text style={styles.label}>{t("checkout.area")}</Text>
              <TextInput style={styles.input} value={area} onChangeText={setArea} placeholder="e.g. Road No. 12" placeholderTextColor="#999" />

              <Text style={styles.label}>{t("checkout.landmark")}</Text>
              <TextInput style={styles.input} value={landmark} onChangeText={setLandmark} placeholder="e.g. Near Hospital" placeholderTextColor="#999" />

              {/* ✅ CITY + PINCODE ROW */}
              <View style={styles.rowInputs}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.label}>{t("checkout.city")}</Text>
                  <TextInput style={styles.input} value={city} onChangeText={setCity} placeholder="Hyderabad" placeholderTextColor="#999" />
                </View>

                <View style={{ flex: 0.8 }}>
                  <Text style={styles.label}>{t("checkout.pincode")}</Text>
                  <TextInput
                    style={styles.input}
                    value={pincode}
                    onChangeText={(text) => {
                      const onlyDigits = text.replace(/\D/g, "");
                      setPincode(onlyDigits);
                    }}
                    keyboardType="numeric"
                    maxLength={6}
                    placeholder="500033"
                    placeholderTextColor="#999"
                  />
                </View>
              </View>

              {/* ✅ FULL WIDTH PINCODE STATUS BADGE (Horizontal) */}
              {pincode.length === 6 && (
                <View
                  style={[
                    styles.serviceStatusBox,
                    checkingPincode
                      ? styles.serviceCheckingBox
                      : isPincodeServiceable
                        ? styles.serviceAvailableBox
                        : styles.serviceUnavailableBox,
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

              <Pressable onPress={fetchCurrentLocation} style={styles.secondaryBtn}>
                <Text style={styles.secondaryBtnText}>{t("checkout.useLocation")}</Text>
              </Pressable>
            </View>
          </View>

          {/* CHECKBOXES */}
          <View style={styles.checkboxContainer}>
            <Pressable style={styles.checkboxRow} onPress={() => setAcceptedPolicies(!acceptedPolicies)}>
              <View style={[styles.checkbox, acceptedPolicies && styles.checkboxChecked]}>
                {acceptedPolicies && <Ionicons name="checkmark" size={16} color={COLORS.buttonText} />}
              </View>
              <Text style={[styles.checkboxLabel, { flex: 0 }]}>
                {t("checkout.acceptPolicies")}{" "}
                <Text
                  style={styles.linkText}
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
              <View style={[styles.checkbox, acceptedTerms && styles.checkboxChecked]}>
                {acceptedTerms && <Ionicons name="checkmark" size={16} color={COLORS.buttonText} />}
              </View>
              <Text style={[styles.checkboxLabel, { flex: 0 }]}>
                {t("checkout.acceptTerms")}{" "}
                <Text
                  style={styles.linkText}
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
            <Text style={styles.payText}>
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
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t("checkout.policies")}</Text>
              <Pressable onPress={() => setShowPoliciesModal(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </Pressable>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <Text style={styles.modalHeading}>Privacy & Data Protection</Text>
              <Text style={styles.modalText}>
                {policies?.user_policies
                  ? policies.user_policies.replace(/^- /gm, '• ')
                  : "Loading policies..."}
              </Text>
            </ScrollView>

            <Pressable style={styles.modalCloseButton} onPress={() => setShowPoliciesModal(false)}>
              <Text style={styles.modalCloseButtonText}>Close</Text>
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
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t("checkout.terms")}</Text>
              <Pressable onPress={() => setShowTermsModal(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </Pressable>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <Text style={styles.modalHeading}>Agreement to Terms</Text>
              <Text style={styles.modalText}>
                {policies?.terms_and_conditions
                  ? policies.terms_and_conditions.replace(/^- /gm, '• ')
                  : "Loading terms..."}
              </Text>
            </ScrollView>

            <Pressable style={styles.modalCloseButton} onPress={() => setShowTermsModal(false)}>
              <Text style={styles.modalCloseButtonText}>Close</Text>
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
          <View style={styles.successContent}>
            <View style={styles.successIconContainer}>
              <Ionicons name="checkmark-circle" size={80} color={COLORS.saffron} />
            </View>

            <Text style={styles.successTitle}>{t("checkout.bookingConfirmed")}</Text>
            <Text style={styles.successMessage}>
              {t("notifications.bookingSuccessMessage")}
            </Text>

            <Text style={styles.redirectText}>{t("checkout.redirecting")}</Text>
          </View>
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
          <View style={styles.alertContent}>
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
            <Text style={styles.alertTitle}>{alertConfig.title}</Text>
            <Text style={styles.alertMessage}>{alertConfig.message}</Text>

            {/* OK Button */}
            <Pressable
              style={[
                styles.alertButton,
                alertConfig.type === 'error' && styles.alertButtonError,
                alertConfig.type === 'warning' && styles.alertButtonWarning,
                alertConfig.type === 'info' && styles.alertButtonInfo,
              ]}
              onPress={() => setShowAlertModal(false)}
            >
              <Text style={styles.alertButtonText}>OK</Text>
            </Pressable>
          </View>
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
    fontSize: 14,
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
    width: "85%",
    maxWidth: 400,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
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
    maxWidth: 360,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 12,
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
