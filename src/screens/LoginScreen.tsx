import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { Image } from "expo-image";
import { ChevronDown, Gift, Phone, Sparkles, User } from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import Animated, {
  FadeInDown,
  FadeInUp,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming
} from "react-native-reanimated";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import NeatifyLogo from "../../assets/images/neatifylogo.png";
import { useLanguage } from "../context/LanguageContext";
import { useTheme } from "../context/ThemeContext";
import { useNotification } from "../hooks/useNotification";
import { supabase } from "../lib/supabase";
import { COLORS } from "../theme/colors";
import { setClaimedOffer } from "../utils/priceUtils";
import { generateReferralCode, validateReferralCode } from "../utils/referralUtils";

// Animated Input Component
function AnimatedInput({ icon, placeholder, value, onChange, secureTextEntry, rightElement, keyboardType, maxLength, autoCapitalize }: any) {
  const [isFocused, setIsFocused] = useState(false);
  const focusAnim = useSharedValue(0);

  useEffect(() => {
    focusAnim.value = withTiming(isFocused ? 1 : 0, { duration: 250 });
  }, [isFocused]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      borderColor: interpolateColor(focusAnim.value, [0, 1], ["#F0F0F0", COLORS.saffron]),
      shadowOpacity: focusAnim.value * 0.1,
      shadowRadius: focusAnim.value * 6,
      shadowColor: COLORS.saffron,
      shadowOffset: { width: 0, height: 3 },
      elevation: focusAnim.value * 3,
      transform: [{ scale: 1 + focusAnim.value * 0.01 }]
    };
  });

  return (
    <Animated.View style={[styles.animatedInputContainer, animatedStyle]}>
      {icon}
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor="#888"
        value={value}
        onChangeText={onChange}
        secureTextEntry={secureTextEntry}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        keyboardType={keyboardType}
        maxLength={maxLength}
        autoCapitalize={autoCapitalize}
      />
      {rightElement}
    </Animated.View>
  );
}

// Custom Phone Input Component
function AnimatedPhoneInput({ value, onChangeText, theme }: any) {
  const [isFocused, setIsFocused] = useState(false);
  const focusAnim = useSharedValue(0);

  useEffect(() => {
    focusAnim.value = withTiming(isFocused ? 1 : 0, { duration: 250 });
  }, [isFocused]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      borderColor: interpolateColor(focusAnim.value, [0, 1], ["#F0F0F0", COLORS.saffron]),
      shadowOpacity: focusAnim.value * 0.1,
      shadowRadius: focusAnim.value * 6,
      shadowColor: COLORS.saffron,
      shadowOffset: { width: 0, height: 3 },
      elevation: focusAnim.value * 3,
      transform: [{ scale: 1 + focusAnim.value * 0.01 }]
    };
  });

  return (
    <Animated.View style={[styles.animatedInputContainer, animatedStyle]}>
      <Phone size={20} color="#888" />
      <Text style={{ marginLeft: 10, fontSize: 16, color: "#111", fontWeight: '600' }}>+91</Text>
      <View style={{ width: 1, height: 20, backgroundColor: "#F0F0F0", marginHorizontal: 10 }} />
      <TextInput
        style={styles.input}
        placeholder="Phone Number"
        placeholderTextColor="#888"
        value={value}
        onChangeText={(text) => {
          let cleaned = text.replace(/\D/g, '');
          if (cleaned.startsWith('91') && cleaned.length > 10) {
            cleaned = cleaned.slice(2);
          }
          onChangeText(cleaned.slice(0, 10));
        }}
        keyboardType="phone-pad"
        maxLength={10}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
      />
    </Animated.View>
  );
}


// Custom OTP Input Component
function OtpInput({ value, onChangeText, length = 6 }: any) {
  const inputRefs = useRef<Array<TextInput | null>>([]);
  const { width } = useWindowDimensions();

  // Calculate exact cell width to prevent flex collapse on some Android devices
  // formContainer padding (24*2=48) + margin (16*2=32) = 80px total spacing
  const totalGapWidth = (length - 1) * 6;
  const availableWidth = width - 80 - totalGapWidth;
  const cellWidth = Math.max(32, Math.floor(Math.min(46, availableWidth / length)));

  const handleChange = (text: string, index: number) => {
    // Handle paste
    if (text.length > 1) {
      const pastedText = text.replace(/[^0-9]/g, '').slice(0, length);
      onChangeText(pastedText);
      if (pastedText.length > 0) {
        inputRefs.current[Math.min(pastedText.length, length - 1)]?.focus();
      }
      return;
    }

    const cleanText = text.replace(/[^0-9]/g, '');

    // If deleted via onChangeText
    if (cleanText === '') {
      const newValue = value.split('');
      newValue[index] = '';
      onChangeText(newValue.join(''));
      if (index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
      return;
    }

    const newValue = value.split('');
    newValue[index] = cleanText;
    onChangeText(newValue.join(''));

    // Auto focus next
    if (index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace') {
      // If input is ALREADY empty, onChangeText won't fire. We must handle it here.
      if (!value[index] && index > 0) {
        const newValue = value.split('');
        newValue[index - 1] = '';
        onChangeText(newValue.join(''));
        inputRefs.current[index - 1]?.focus();
      }
    }
  };

  return (
    <View style={{ width: '100%', alignItems: 'center', marginVertical: 10 }}>
      <View style={{ flexDirection: 'row', gap: 6, width: '100%', justifyContent: 'center' }}>
        {Array(length).fill(0).map((_, index) => (
          <View
            key={index}
            style={[
              styles.animatedInputContainer,
              {
                width: cellWidth,
                height: 48,
                justifyContent: 'center',
                alignItems: 'center',
                paddingHorizontal: 0,
                paddingVertical: 0,
                borderColor: value.length === index || (index === length - 1 && value.length === length) ? COLORS.saffron : (value[index] ? COLORS.saffron + '80' : '#F0F0F0'),
                borderWidth: value.length === index || (index === length - 1 && value.length === length) ? 2 : 1.5,
              }
            ]}
          >
            <TextInput
              ref={(ref) => {
                if (ref) inputRefs.current[index] = ref;
              }}
              value={value[index] || ''}
              onChangeText={(text) => handleChange(text, index)}
              onKeyPress={(e) => handleKeyPress(e, index)}
              keyboardType="number-pad"
              maxLength={length}
              selectTextOnFocus
              style={{ fontSize: 24, fontWeight: '700', color: '#111', textAlign: 'center', width: '100%', height: '100%' }}
            />
          </View>
        ))}
      </View>
    </View>
  );
}

// Custom Service Dropdown Component
function AnimatedServiceDropdown({ selectedService, setShowServiceDropdown }: any) {
  const [isFocused, setIsFocused] = useState(false);
  const focusAnim = useSharedValue(0);

  // Animate on press in/out instead of focus since it's a touchable
  const handlePressIn = () => { focusAnim.value = withTiming(1, { duration: 200 }); }
  const handlePressOut = () => { focusAnim.value = withTiming(0, { duration: 200 }); }

  const animatedStyle = useAnimatedStyle(() => {
    return {
      borderColor: selectedService ? COLORS.saffron : interpolateColor(focusAnim.value, [0, 1], ["#F0F0F0", COLORS.saffron]),
      transform: [{ scale: 1 - focusAnim.value * 0.02 }]
    };
  });

  return (
    <Animated.View style={[styles.animatedInputContainer, animatedStyle, { paddingVertical: 0 }]}>
      <TouchableOpacity
        style={{ flexDirection: "row", alignItems: "center", flex: 1, paddingVertical: 12 }}
        onPress={() => setShowServiceDropdown(true)}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={0.9}
      >
        <Sparkles size={20} color={COLORS.saffron} />
        <Text style={[styles.input, { color: selectedService ? "#111" : "#888" }]} numberOfLines={1}>
          {selectedService ? selectedService.title : "Select a service for 40% OFF"}
        </Text>
        <ChevronDown size={20} color="#888" />
      </TouchableOpacity>
    </Animated.View>
  );
}

// ----------------------------------------------------
// MAIN COMPONENT
// ----------------------------------------------------
export default function LoginScreen(props: any) {
  const navigation = useNavigation<any>();
  const { showAlert, showToast } = useNotification();
  const { t } = useLanguage();
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const [authStep, setAuthStep] = useState<'phone' | 'otp' | 'profile'>('phone');
  const [otp, setOtp] = useState('');
  const [resendTimer, setResendTimer] = useState(0);
  const [termsViewed, setTermsViewed] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);

  useEffect(() => {
    let interval: any;
    if (resendTimer > 0) {
      interval = setInterval(() => setResendTimer(prev => prev - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [referralCode, setReferralCode] = useState("");

  const [eligibleServices, setEligibleServices] = useState<any[]>([]);
  const [selectedService, setSelectedService] = useState<any | null>(null);
  const [showServiceDropdown, setShowServiceDropdown] = useState(false);

  useEffect(() => {
    fetchEligibleServices();
  }, []);

  const fetchEligibleServices = async () => {
    try {
      let { data, error } = await supabase
        .from("services")
        .select("id, title, service_type, price, is_welcome_offer_eligible")
        .eq("is_welcome_offer_eligible", true)
        .order("sort_order", { ascending: true });

      if (error || !data || data.length === 0) {
        const { data: allServices } = await supabase
          .from("services")
          .select("id, title, service_type, price, is_welcome_offer_eligible")
          .order("sort_order", { ascending: true })
          .limit(30);
        data = allServices;
      }
      setEligibleServices(data || []);
    } catch (err) {
      console.log("Error fetching eligible services:", err);
      setEligibleServices([]);
    }
  };

  const [loading, setLoading] = useState(false);

  const checkProfileAndNavigate = async (userId: string) => {
    try {
      const { data: profile } = await supabase
        .from("profile")
        .select("full_name, email, phone")
        .eq("id", userId)
        .maybeSingle();

      const { data: { user } } = await supabase.auth.getUser();
      const hasFullProfile = !!(profile?.full_name && profile?.email && profile?.phone);
      const hasConfirmedIdentity = !!user?.email_confirmed_at;

      if (!hasFullProfile || !hasConfirmedIdentity) {
        navigation.reset({ index: 0, routes: [{ name: "CompleteProfile" }] });
      } else {
        navigation.reset({ index: 0, routes: [{ name: "HomeDrawer" }] });
      }
    } catch (err) {
      console.error("Profile check failed:", err);
      navigation.reset({ index: 0, routes: [{ name: "HomeDrawer" }] });
    }
  };


  const handleSendOtp = async () => {
    const cleanPhone = phone.replace(/\D/g, "").slice(-10);
    if (cleanPhone.length < 10) {
      showAlert({ type: "warning", title: "Invalid Phone", message: "Please enter a valid 10-digit phone number." });
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('msg91-send-otp', {
        body: { phone: cleanPhone }
      });
      if (error || !data?.success) {
        throw new Error(error?.message || data?.message || data?.error || 'Failed to send OTP');
      }
      setAuthStep('otp');
      setResendTimer(60);
      showToast("OTP sent successfully");
    } catch (err: any) {
      showAlert({ type: "error", title: "Error", message: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.length < 4) {
      showAlert({ type: "warning", title: "Invalid OTP", message: "Please enter the complete OTP." });
      return;
    }
    setLoading(true);
    try {
      const cleanPhone = "91" + phone.replace(/\D/g, "").slice(-10);
      const { data, error } = await supabase.functions.invoke('verify-otp', {
        body: { phone: cleanPhone, otp }
      });
      if (error || !data?.success) {
        throw new Error(error?.message || data?.message || data?.error || 'Failed to verify OTP');
      }

      if (data.session) {
        await supabase.auth.setSession(data.session);
      }

      if (data.isNewUser) {
        setAuthStep('profile');
      } else {
        await checkProfileAndNavigate(data.user?.id || (await supabase.auth.getUser()).data.user?.id!);
      }
    } catch (err: any) {
      showAlert({ type: "error", title: "Verification Failed", message: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleSignupSubmit = async () => {
    setLoading(true);
    try {
      if (!fullName) {
        showAlert({ type: "warning", title: t("notifications.missingInfo"), message: "Name is required." });
        setLoading(false); return;
      }
      if (eligibleServices.length > 0 && !selectedService) {
        showAlert({ type: "warning", title: "Select Service", message: "Please select a service for your 40% OFF discount." });
        setLoading(false); return;
      }

      let referrerId = null;
      if (referralCode.trim()) {
        referrerId = await validateReferralCode(referralCode.trim());
        if (!referrerId) {
          showAlert({ type: "warning", title: "Invalid Referral", message: "The referral code you entered is invalid. You can continue without it." });
          setLoading(false); return;
        }
      }

      const cleanPhone = phone.replace(/\D/g, "").slice(-10);
      const formattedPhone = `+91${cleanPhone}`;

      // Since OTP verification created the user and set the session, retrieve the current user
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
      if (authError || !authUser) throw new Error("Authentication error. Please try again.");

      const myReferralCode = generateReferralCode(fullName.trim());
      const selectedServiceTitle = selectedService?.title || null;
      const selectedServiceId = selectedService?.id || null;

      await Promise.all([
        supabase.from("profile").upsert({ id: authUser.id, full_name: fullName.trim(), phone: cleanPhone, referral_code: myReferralCode, referred_by_id: referrerId, service_selected: selectedServiceTitle }),
        supabase.from("signup").upsert({ id: authUser.id, full_name: fullName.trim(), phone: cleanPhone, service_selected: selectedServiceTitle }),
        supabase.from("wallet").upsert({ user_id: authUser.id, balance: 0 })
      ]);

      await setClaimedOffer({ serviceId: selectedServiceId, serviceTitle: selectedServiceTitle, offerPercentage: 40, claimedAt: new Date().toISOString() });

      if (referrerId) {
        await supabase.from("referrals").insert({ referrer_id: referrerId, referred_user_id: authUser.id, status: 'pending', reward_amount: 50 });
        const welcomeCouponCode = `WELCOME50_${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
        await supabase.from("coupons").insert({ coupon_code: welcomeCouponCode, discount_amount: 50, is_used: false, phone_number: cleanPhone });
      }

      await checkProfileAndNavigate(authUser.id);
    } catch (err: any) {
      showAlert({ type: "error", title: t("notifications.authFailed"), message: err.message });
    } finally {
      setLoading(false);
    }
  };

  // -------------------------------------
  // Animations
  // -------------------------------------
  const characterBob = useSharedValue(0);
  const buttonScale = useSharedValue(1);

  useEffect(() => {
    characterBob.value = withRepeat(
      withSequence(
        withTiming(-10, { duration: 1800 }),
        withTiming(0, { duration: 1800 })
      ),
      -1,
      true
    );
  }, []);

  const characterAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: characterBob.value }],
    };
  });

  const buttonAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: buttonScale.value }],
    };
  });

  const handlePressIn = () => { buttonScale.value = withSpring(0.96); };
  const handlePressOut = () => { buttonScale.value = withSpring(1); };

  // -------------------------------------
  // Render
  // -------------------------------------
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#FDFDFD" }}>
      <StatusBar barStyle="dark-content" backgroundColor="#FDFDFD" />

      {/* Subtle Background Elements */}
      <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
        <View style={styles.bgCircleTop} />
        <View style={styles.bgCircleBottom} />
      </View>

      {/* BACK BUTTON */}
      <TouchableOpacity
        onPress={() => { navigation.canGoBack() ? navigation.goBack() : navigation.replace("HomeDrawer"); }}
        style={[styles.backBtn, { top: Math.max(insets.top, 10) }]}
      >
        <Ionicons name="arrow-back" size={24} color="#111" />
      </TouchableOpacity>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContainer,
            isDesktop && { flexDirection: "row", alignItems: "center", justifyContent: "center" }
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >

          {/* DESKTOP RIGHT SIDE / MOBILE TOP: 3D Character */}
          <View style={[isDesktop ? styles.desktopCharacterContainer : styles.mobileCharacterContainer]}>
            <Animated.View style={characterAnimatedStyle}>
              <Image
                source={require("../../assets/images/heroimg.png")}
                style={isDesktop ? styles.desktopCharacterImage : styles.mobileCharacterImage}
                contentFit="contain"
              />
            </Animated.View>
          </View>

          {/* FORM CONTAINER */}
          <Animated.View
            entering={FadeInUp.duration(600).delay(100)}
            style={[styles.formContainer, isDesktop && styles.desktopFormContainer]}
          >
            <View style={styles.header}>
              <Image source={NeatifyLogo} style={styles.logo} contentFit="contain" />
              <Text style={styles.subtitle}>
                Welcome to Neatify! Ready for a sparkling clean home?
              </Text>
            </View>

            <View style={styles.form}>

              {authStep === 'phone' && (
                <Animated.View entering={FadeInDown.duration(400).delay(300)}>
                  <AnimatedPhoneInput value={phone} onChangeText={setPhone} />
                  <Pressable onPressIn={handlePressIn} onPressOut={handlePressOut} onPress={handleSendOtp} disabled={loading} style={{ marginTop: 20 }}>
                    <Animated.View style={[styles.primaryBtn, buttonAnimatedStyle]}>
                      {loading ? (
                        <ActivityIndicator color="#111" />
                      ) : (
                        <Text style={styles.primaryText}>Send OTP</Text>
                      )}
                    </Animated.View>
                  </Pressable>
                </Animated.View>
              )}

              {authStep === 'otp' && (
                <Animated.View entering={FadeInDown.duration(400).delay(200)}>
                  <View style={styles.whatsappMessageContainer}>
                    <Ionicons name="logo-whatsapp" size={24} color="#25D366" style={styles.whatsappIcon} />
                    <View style={styles.whatsappTextContainer}>
                      <Text style={styles.whatsappText}>
                        OTP sent to <Text style={styles.whatsappHighlight}>WhatsApp</Text> this number
                      </Text>
                      <Text style={styles.whatsappPhone}>+91 {phone}</Text>
                    </View>
                  </View>
                  <OtpInput value={otp} onChangeText={setOtp} length={6} />

                  {/* Terms & Conditions Row (UI Only) */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, marginBottom: 8, paddingHorizontal: 4 }}>
                    <TouchableOpacity 
                      onPress={() => {
                        if (!termsViewed) {
                          setShowTermsModal(true);
                        } else {
                          setTermsAccepted(!termsAccepted);
                        }
                      }}
                      style={{ marginRight: 8, padding: 4 }}
                    >
                      <Ionicons 
                        name={termsAccepted ? "checkbox" : "square-outline"} 
                        size={24} 
                        color={termsAccepted ? COLORS.saffron : "#888"} 
                      />
                    </TouchableOpacity>
                    <Text style={{ fontSize: 13, color: "#111", flex: 1 }}>
                      I agree to the{" "}
                      <Text 
                        style={{ color: COLORS.saffron, fontWeight: "700" }} 
                        onPress={() => setShowTermsModal(true)}
                      >
                        Privacy Policy
                      </Text>
                    </Text>
                  </View>

                  <Pressable onPressIn={handlePressIn} onPressOut={handlePressOut} onPress={handleVerifyOtp} disabled={loading} style={{ marginTop: 12 }}>
                    <Animated.View style={[styles.primaryBtn, buttonAnimatedStyle, otp.length < 4 && { opacity: 0.5 }]}>
                      {loading ? (
                        <ActivityIndicator color="#111" />
                      ) : (
                        <Text style={styles.primaryText}>Verify OTP</Text>
                      )}
                    </Animated.View>
                  </Pressable>

                  <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 20, gap: 20 }}>
                    <TouchableOpacity onPress={() => {
                      if (resendTimer === 0) handleSendOtp();
                    }} disabled={resendTimer > 0}>
                      <Text style={[styles.linkText, resendTimer > 0 && { color: '#999' }]}>
                        {resendTimer > 0 ? `Resend OTP in ${resendTimer}s` : 'Resend OTP'}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => {
                      setAuthStep('phone');
                      setOtp('');
                    }}>
                      <Text style={styles.linkText}>Change Mobile Number</Text>
                    </TouchableOpacity>
                  </View>
                </Animated.View>
              )}

              {authStep === 'profile' && (
                <Animated.View entering={FadeInDown.duration(400).delay(200)} style={{ gap: 12 }}>
                  <AnimatedInput
                    icon={<User size={20} color="#888" />}
                    placeholder={t("login.fullName")}
                    value={fullName}
                    onChange={setFullName}
                    autoCapitalize="words"
                  />

                  <AnimatedInput
                    icon={<Gift size={20} color="#888" />}
                    placeholder="Referral/Discount Code (Optional)"
                    value={referralCode}
                    onChange={(text: string) => setReferralCode(text.toUpperCase())}
                    autoCapitalize="characters"
                  />
                  {eligibleServices.length > 0 ? (
                    <View style={{ marginBottom: 4 }}>
                      <Text style={styles.dropdownLabel}>🎁 Select Service for 40% OFF:</Text>
                      <AnimatedServiceDropdown
                        selectedService={selectedService}
                        setShowServiceDropdown={setShowServiceDropdown}
                      />
                    </View>
                  ) : (
                    <View style={styles.expiredOfferContainer}>
                      <Sparkles size={16} color="#888" />
                      <Text style={styles.expiredOfferText}>40% Welcome Offer is currently expired / inactive.</Text>
                    </View>
                  )}

                  <Pressable onPressIn={handlePressIn} onPressOut={handlePressOut} onPress={handleSignupSubmit} disabled={loading} style={{ marginTop: 8 }}>
                    <Animated.View style={[styles.primaryBtn, buttonAnimatedStyle]}>
                      {loading ? (
                        <ActivityIndicator color="#111" />
                      ) : (
                        <Text style={styles.primaryText}>Complete Profile</Text>
                      )}
                    </Animated.View>
                  </Pressable>
                </Animated.View>
              )}



            </View>
          </Animated.View>

        </ScrollView>
      </KeyboardAvoidingView>

      {/* DROPDOWN MODAL */}
      <Modal visible={showServiceDropdown} transparent animationType="fade" statusBarTranslucent={true} onRequestClose={() => setShowServiceDropdown(false)}>
        <Pressable style={dropdownStyles.overlay} onPress={() => setShowServiceDropdown(false)}>
          <Pressable style={dropdownStyles.container} onPress={(e) => e.stopPropagation()}>
            <View style={dropdownStyles.header}>
              <Text style={dropdownStyles.title}>Choose Service for 40% OFF 🎉</Text>
              <TouchableOpacity onPress={() => setShowServiceDropdown(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={24} color="#111" />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
              {eligibleServices.map((svc) => {
                const isSelected = selectedService?.id === svc.id;
                return (
                  <TouchableOpacity
                    key={svc.id}
                    style={[dropdownStyles.item, isSelected && { backgroundColor: COLORS.saffron + "20" }]}
                    onPress={() => { setSelectedService(svc); setShowServiceDropdown(false); }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[dropdownStyles.itemTitle, isSelected && { fontWeight: "800", color: "#000" }]}>{svc.title}</Text>
                      {svc.service_type && <Text style={{ fontSize: 12, color: "#666", marginTop: 2 }}>{svc.service_type}</Text>}
                    </View>
                    <View style={dropdownStyles.badge}>
                      <Text style={{ color: COLORS.saffron, fontWeight: "800", fontSize: 12 }}>40% OFF</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* PRIVACY POLICY MODAL */}
      <Modal visible={showTermsModal} transparent animationType="slide" statusBarTranslucent={true} onRequestClose={() => setShowTermsModal(false)}>
        <View style={dropdownStyles.overlay}>
          <View style={[dropdownStyles.container, { padding: 0, overflow: 'hidden', maxHeight: '85%' }]}>
            <View style={[dropdownStyles.header, { padding: 20, borderBottomWidth: 1, borderBottomColor: '#F0F0F0', marginBottom: 0 }]}>
              <Text style={dropdownStyles.title}>Privacy Policy</Text>
              <TouchableOpacity onPress={() => setShowTermsModal(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={24} color="#111" />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ paddingHorizontal: 20 }} showsVerticalScrollIndicator={true}>
              
              <Text style={styles.termTitle}>1. About Us</Text>
              <Text style={styles.termText}>We welcome you to our mobile application / website / platform THE NEATIFY TEAM. THE NEATIFY TEAM is a service operated by The Neatify Services (OPC) Private Limited that has developed an on-demand cleaning service platform that connects users with professional cleaning service providers for residential and commercial cleaning services. THE NEATIFY TEAM enables businesses to effortlessly provide housekeeping services to the users including general cleaning of premises, laundry assistance, bathroom and kitchen assistance among others.{'\n\n'}• Website Booking Services:{'\n'}Purpose and Scope: This service is crafted for clients who prioritize simplicity, efficiency, and reliability in their cleaning services.{'\n\n'}Features and Offerings: The website facilitates individual services or a package/bundle of services designed to make cleaning services for users a pleasant and hassle-free services.{'\n\n'}Our Privacy Policy is incorporated as part of this Mobile Application / Website / Platform. Please register yourself in the platform and access or view the platform only if you are agreeable to be bound by this Privacy Policy. In case you are not agreeable to the terms of the privacy policy or do not wish to be bound / obligated by these policies and / or terms and conditions, we kindly request you not to register access / view the platform.{'\n\n'}Please read this Privacy Policy and our Terms of Use carefully before accessing / registering yourself. By continuing to access the platform, please note that you agree to be bound by the provisions of this Privacy Policy.{'\n'}Our services have to be used legally and as permitted by law. THE NEATIFY TEAM has the right to completely stop providing or suspend the services if you do not comply with our terms or privacy policies. The contents and any information provided in the platform may be changed at any time by us without notice by updating the privacy policy. You agree to review the Terms and conditions of the website / Privacy Policy regularly and your continued access or use of the platform will mean that you agree to and abide by the updated Terms & Conditions / Privacy Policy.</Text>

              <Text style={styles.termTitle}>2. Information:</Text>
              <Text style={styles.termText}>We collect the information of the user as provided by them such as the individual / business entity name, email address, Contact address, country, payment details, email id, IP address and the like. The nature of the services offered by THE NEATIFY TEAM requires them to collect information like contact details, browsing history, geographical location.{'\n\n'}We also collect and store certain information using cookies for ease of use by the customers.  As a user, you are first required to register yourselves prior to using our services. Note that the collected information during the user registration process is governed as per the privacy policy. Please read the privacy policy before divulging the above-mentioned personal information.{'\n\n'}On being prompted for Registration as a new user, you are required to provide basic information such as Name, age, phone number, email address, physical address, and geographical location.{'\n\n'}As a user willing to register and to use the services rendered by us you understand and agree that by availing the services we may directly or indirectly collect and store information regarding your access and use of our platform and your personal details. You agree that we may use such information for any purpose related to any use of the platform including but not limited to:{'\n\n'}i. Provide, troubleshoot and improving the performance of the platform;{'\n'}ii. verifying compliance with the terms and other conditions.{'\n'}iii. For internal purposes such as enhancing security of the Platform, auditing, testing, troubleshooting, data analysis and research conducted either indirectly/directly by Company;{'\n'}iv. To protect the users by preventing fraud and abuse and to protect the security of our merchants and the users.</Text>

              <Text style={styles.termTitle}>3. Reason for collection of Information:</Text>
              <Text style={styles.termText}>The Website / Platform is involved in rendering services relating to providing the required services by choosing from available cleaning persons THE NEATIFY TEAM vets carefully. The said cleaning persons may or may be on the regular rolls of THE NEATIFY TEAM. THE NEATIFY TEAM is not involved in any of the internal dealings between the users and any third party service links found on the website. The platform collects preferences of the users and provides personalized suggestions to the users based on their past service requests and browsing history. The site may track the IP address of a user’s computer and save certain information on their system in the form of cookies. A user has the option to accept or decline the cookies by modifying it on their browser.{'\n\n'}The information from users is collected for the following reasons:{'\n'}• Contact Number (One Time Password) to login securely, to deliver a customized experience and to maintain user sessions.{'\n'}• Country (To enhance the user experience by offering relevant information based on their geography){'\n'}• City (To enhance the user experience by offering relevant information based on their geography){'\n'}• To provide updates on the platform that suits the user’s needs{'\n'}• To enable compliance with appropriate laws- legal and regulatory{'\n'}• To maintain a database of our users and for our internal assessment.{'\n'}• To Create and manage user account{'\n'}• To Process service bookings{'\n'}• To Assign service professionals{'\n'}• To Provide customer support{'\n'}• To Improve app performance and service quality</Text>

              <Text style={styles.termTitle}>4. Applicability of this Privacy policy:</Text>
              <Text style={styles.termText}>The terms mentioned in this privacy policy herein shall apply to the users, who have visited the platform to browse with no intention of committing their information and the registered users who are willing to divulge their information to ensure continued support of a personalized nature from the platform. Clients may submit photos for promotional use (with consent), enhancing community engagement and the photos are governed by the Privacy policy and the users agree to the same before submitting such photos or videos for collaboration.</Text>

              <Text style={styles.termTitle}>5. Details of information is collected & shared:</Text>
              <Text style={styles.termText}>The personal details / information that are given by the users like name, email address, mobile number, age, city and country of current residence, location, IP addresses are collected. The platform however, is not liable for any information compromised as a result of interaction of the users with any third-party sites which has been advertised / found in our Website / Platform.{'\n\n'}In the event that the users do not want THE NEATIFY TEAM to collect any information or intend to remove their details from the database of THE NEATIFY TEAM, there is an option to opt out by sending an email to the email address provided on the website.{'\n'}Information: That is collected from Registered Users: If you create and register an account with us, you are required to give us certain information during creation of your account. We ask all registered users to provide a name, email address, mobile number, age, city and country of current residence and other details.{'\n'}Information entered once by the users is by default stored in the database of the website to ensure seamless logging in process by the users. The users may opt out of the same.{'\n\n'}We may collect information of the user based on the users’ requirement from THE NEATIFY TEAM.  We shall share all the information as and when needed to you. We undertake not to share the same with any third parties exceeding the scope of engaging such third parties.{'\n\n'}THE NEATIFY TEAM may require to send a One-Time Password to users and collects data relating to geographical location of the users.{'\n\n'}THE NEATIFY TEAM does not collect, store or use any data relating to payment information like credit card or debit card details, UPI or other bank details.{'\n\n'}THE NEATIFY TEAM shall not sell or rent data to third parties in any manner.{'\n\n'}The users agree and understand that the cleaning persons engaged by THE NEATIFY TEAM may not be on the permanent rolls of the Company and ad hoc cleaning persons may be arranged in the event of high demand. Hence, THE NEATIFY TEAM shall be constrained to reveal the geographical location and phone number details of the users. The persons however shall be instructed with the privacy requirements and THE NEATIFY TEAM shall take utmost care to reasonable ensure the information so divulged shall not be used by the cleaning staff for purposes beyond the scope of the Privacy Policy.{'\n'}You agree that user information or any other information relating to use of the services may contain confidential and personal information.  You agree and undertake that all the Confidential or personal Information will remain the sole property of THE NEATIFY TEAM and that we will not use such Information for purposes beyond the scope of providing the services within the scope of this Privacy Policy.{'\n'}Please note that the information provided by the users is shared to third parties only to the extent as required.</Text>

              <Text style={styles.termTitle}>6. Data Retention & Deletion</Text>
              <Text style={styles.termText}>The user data collected by THE NEATIFY TEAM  - User data is retained only as long as necessary. Users may opt out of collection of cookies by THE NEATIFY TEAM during any time of their interaction. The users may also request for deletion of their account and personal information by sending an email to THE NEATIFY TEAM. Upon deletion, personal data will be removed unless retention is legally required</Text>

              <Text style={styles.termTitle}>7. Security Issues:</Text>
              <Text style={styles.termText}>The Accuracy and Confidentiality of Your Account Information Is Your Responsibility: You are responsible for maintaining the secrecy and accuracy of your password, email address and other account information at all times. We recommend a strong password that you do not use with other services. We are not responsible for personal data transmitted to a third party as a result of incorrect details.{'\n'}THE NEATIFY TEAM shall take utmost precaution to ensure the data of the users is safe and implement reasonable administrative, technical, and physical safeguards to protect user data in compliance with applicable Indian data protection laws.</Text>

              <Text style={styles.termTitle}>8. Applicable Law & Jurisdiction</Text>
              <Text style={styles.termText}>Please note that in case of any dispute with THE NEATIFY TEAM generally or specifically related to the privacy policy or the terms and conditions, belongs to exclusive jurisdiction of Courts at Hyderabad, India and is governed exclusively by Indian Laws.</Text>
              
              <View style={{ height: 30 }} />
            </ScrollView>
            
            <View style={{ padding: 16, borderTopWidth: 1, borderTopColor: '#F0F0F0', backgroundColor: '#FFF' }}>
              <TouchableOpacity
                style={{
                  backgroundColor: COLORS.saffron,
                  paddingVertical: 14,
                  borderRadius: 12,
                  alignItems: 'center',
                }}
                onPress={() => {
                  setTermsViewed(true);
                  setTermsAccepted(true);
                  setShowTermsModal(false);
                }}
              >
                <Text style={{ fontSize: 16, fontWeight: '800', color: '#111' }}>✓ I Understand</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  termTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111',
    marginTop: 16,
    marginBottom: 4,
  },
  termText: {
    fontSize: 14,
    color: '#444',
    lineHeight: 20,
  },
  bgCircleTop: {
    position: "absolute",
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: COLORS.saffron + "15",
    top: -100,
    right: -100,
  },
  bgCircleBottom: {
    position: "absolute",
    width: 400,
    height: 400,
    borderRadius: 200,
    backgroundColor: COLORS.saffron + "10",
    bottom: -150,
    left: -150,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: "5%",
    paddingTop: 30,
    paddingBottom: 40
  },
  backBtn: {
    position: "absolute",
    left: 16,
    zIndex: 100,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  mobileCharacterContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: -45, // Deeper overlap to place character behind card
    marginTop: 10,
    zIndex: 1,
  },
  desktopCharacterContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
  },
  mobileCharacterImage: {
    width: 180, // Scaled down
    height: 160,
  },
  desktopCharacterImage: {
    width: "100%",
    height: 500,
    maxWidth: 450,
  },
  formContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24, // reduced corners slightly
    padding: 20, // reduced internal padding
    paddingTop: 24, // Card top spacing
    paddingBottom: 28,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 8,
    zIndex: 2,
  },
  desktopFormContainer: {
    flex: 1,
    maxWidth: 500,
    marginVertical: 40,
  },
  header: {
    marginBottom: 20,
    alignItems: "center", // Center horizontally
  },
  logo: {
    width: 130, // Smaller branding
    height: 38,
    marginBottom: 16, // Spacing between logo and heading
  },
  subtitle: {
    color: "#111", // Black/dark text
    fontSize: 16,
    fontFamily: Platform.OS === 'android' ? 'sans-serif-rounded' : 'Arial Rounded MT Bold',
    fontWeight: Platform.OS === 'android' ? 'normal' : '700',
    lineHeight: 22,
    textAlign: "center",
    paddingHorizontal: 8,
  },
  form: {
    gap: 12, // reduced gaps
  },
  animatedInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#F0F0F0", // subtle grey
    backgroundColor: "#FFFFFF",
    borderRadius: 14, // slightly rounder
    paddingVertical: 12, // shorter height
    paddingHorizontal: 14,
  },
  input: {
    flex: 1,
    fontSize: 16,
    marginLeft: 12,
    color: "#111",
    fontWeight: "500",
  },
  dropdownLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.saffron,
    marginBottom: 8,
    marginLeft: 4,
  },
  expiredOfferContainer: {
    padding: 12,
    backgroundColor: "#F8F8F8",
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "#F0F0F0"
  },
  expiredOfferText: {
    fontSize: 13,
    color: "#555",
    fontWeight: "600",
  },
  whatsappMessageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  whatsappIcon: {
    marginRight: 12,
  },
  whatsappTextContainer: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  whatsappText: {
    fontFamily: Platform.OS === 'android' ? 'sans-serif-rounded' : 'Arial Rounded MT Bold',
    color: '#333',
    fontSize: 14,
  },
  whatsappHighlight: {
    color: '#25D366',
    fontWeight: '700',
  },
  whatsappPhone: {
    fontFamily: Platform.OS === 'android' ? 'sans-serif-rounded' : 'Arial Rounded MT Bold',
    color: '#111',
    fontSize: 15,
    fontWeight: Platform.OS === 'android' ? 'normal' : '800',
    marginTop: 2,
  },
  primaryBtn: {
    backgroundColor: COLORS.saffron,
    height: 52, // Shorter height
    borderRadius: 14, // match input border radius
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
    shadowColor: COLORS.saffron,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2, // subtle shadow
    shadowRadius: 8,
    elevation: 4,
  },
  primaryText: {
    color: "#111",
    fontWeight: "800",
    fontSize: 15,
    letterSpacing: 0.5,
  },
  forgotPasswordText: {
    color: "#111",
    fontWeight: "700",
    fontSize: 13,
  },
  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 4,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#F0F0F0"
  },
  dividerText: {
    marginHorizontal: 12,
    color: "#888",
    fontSize: 13,
    fontWeight: "600",
  },
  googleBtn: {
    height: 52, // Shorter height
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#F0F0F0",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
  },
  googleIcon: {
    width: 22,
    height: 22
  },
  googleText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111"
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 12,
  },
  linkText: {
    fontWeight: "800",
    color: COLORS.saffron,
    fontSize: 14,
  },
  policyContainer: {
    paddingHorizontal: 6,
    marginTop: -2,
    marginBottom: 4,
    gap: 6,
    backgroundColor: "#F9F9F9",
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#EAEAEA",
  },
  policyHeader: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 4,
    color: "#333",
  },
  policyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  policyText: {
    fontSize: 12,
    fontWeight: "600",
  },
});

const dropdownStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  container: {
    backgroundColor: "#FFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingBottom: 30,
    maxHeight: "80%",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111",
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: "#F5F5F5",
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#333",
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: COLORS.saffron + "20",
  },
});
