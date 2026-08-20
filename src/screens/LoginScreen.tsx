import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { Image } from "expo-image";
import { ChevronDown, Eye, EyeOff, Gift, Lock, Mail, Phone, Sparkles, User } from "lucide-react-native";
import React, { useState, useEffect, useRef } from "react";
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
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
  interpolateColor
} from "react-native-reanimated";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import DarkThemeLogo from "../../assets/images/Dark Theme logo.png";
import NeatifyLogo from "../../assets/images/neatifylogo.png";
import { signInWithGoogle } from "../auth/useGoogleAuth";
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
  const inputRef = useRef<TextInput>(null);
  
  return (
    <View style={{ width: '100%', alignItems: 'center', marginVertical: 10 }}>
      <Pressable 
        style={{ flexDirection: 'row', gap: 10 }} 
        onPress={() => inputRef.current?.focus()}
      >
        {Array(length).fill(0).map((_, index) => (
          <View 
            key={index} 
            style={[
              styles.animatedInputContainer, 
              { 
                width: 45, 
                height: 55, 
                justifyContent: 'center', 
                alignItems: 'center', 
                paddingHorizontal: 0,
                borderColor: value.length === index ? COLORS.saffron : (value[index] ? COLORS.saffron + '80' : '#F0F0F0'),
                borderWidth: value.length === index ? 2 : 1.5,
              }
            ]}
          >
            <Text style={{ fontSize: 24, fontWeight: '700', color: '#111' }}>
              {value[index] || ''}
            </Text>
          </View>
        ))}
      </Pressable>
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={(text) => onChangeText(text.replace(/[^0-9]/g, '').slice(0, length))}
        keyboardType="number-pad"
        maxLength={length}
        style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }}
      />
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

function PolicyRow({ label, isMet }: { label: string, isMet: boolean }) {
  return (
    <View style={styles.policyRow}>
      <Ionicons
        name={isMet ? "checkmark-circle" : "close-circle"}
        size={16}
        color={isMet ? "#111" : "#999"}
      />
      <Text style={[styles.policyText, { color: isMet ? "#111" : "#999" }]}>
        {label}
      </Text>
    </View>
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

  const [isLogin, setIsLogin] = useState(!props.route?.params?.isRegister);
  const [authStep, setAuthStep] = useState<'phone' | 'otp' | 'profile'>('phone');
  const [otp, setOtp] = useState('');
  const [resendTimer, setResendTimer] = useState(0);

  useEffect(() => {
    let interval: any;
    if (resendTimer > 0) {
      interval = setInterval(() => setResendTimer(prev => prev - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (props.route?.params?.isRegister) {
      setIsLogin(false);
    }
  }, [props.route?.params]);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
  const [googleLoading, setGoogleLoading] = useState(false);

  const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
  const isValidPassword = (p: string) => /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/.test(p);

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

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      showAlert({ type: "error", title: "Google Sign-In Failed", message: err.message });
    } finally {
      setGoogleLoading(false);
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
      if (error || data?.error) {
        throw new Error(error?.message || data?.error || 'Failed to send OTP');
      }
      setAuthStep('otp');
      setResendTimer(30);
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
      const cleanPhone = phone.replace(/\D/g, "").slice(-10);
      const { data, error } = await supabase.functions.invoke('msg91-verify-otp', {
        body: { phone: cleanPhone, otp }
      });
      if (error || data?.error) {
        throw new Error(error?.message || data?.error || 'Failed to verify OTP');
      }

      if (data.isNewUser) {
        if (isLogin) {
          setIsLogin(false);
        }
        setAuthStep('profile');
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: data.email,
          password: data.tempPassword
        });
        if (signInError) throw signInError;
        await checkProfileAndNavigate((await supabase.auth.getUser()).data.user?.id!);
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
      if (!fullName || !email) {
        showAlert({ type: "warning", title: t("notifications.missingInfo"), message: "Name and Email are required." });
        setLoading(false); return;
      }
      if (eligibleServices.length > 0 && !selectedService) {
        showAlert({ type: "warning", title: "Select Service", message: "Please select a service for your 40% OFF discount." });
        setLoading(false); return;
      }
      if (!isValidEmail(email)) {
        showAlert({ type: "warning", title: "Invalid Email", message: "Please enter a valid email address." });
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
      const securePassword = crypto.randomUUID();

      const { data, error } = await supabase.auth.signUp({
        email, password: securePassword, options: { data: { full_name: fullName.trim(), phone_number: formattedPhone, } }
      });

      if (error) throw error;
      const authUser = data.user;

      if (!authUser?.identities?.length) {
        throw new Error("This email is already registered. Please login instead.");
      }

      if (authUser) {
        await supabase.auth.updateUser({ data: { full_name: fullName.trim(), phone_number: formattedPhone, } });
        const myReferralCode = generateReferralCode(fullName.trim());
        const selectedServiceTitle = selectedService?.title || null;
        const selectedServiceId = selectedService?.id || null;

        await Promise.all([
          supabase.from("profile").upsert({ id: authUser.id, full_name: fullName.trim(), email: email.trim(), phone: cleanPhone, referral_code: myReferralCode, referred_by_id: referrerId, service_selected: selectedServiceTitle }),
          supabase.from("signup").upsert({ id: authUser.id, full_name: fullName.trim(), email: email.trim(), phone: cleanPhone, service_selected: selectedServiceTitle }),
          supabase.from("wallet").upsert({ user_id: authUser.id, balance: 0 })
        ]);

        await setClaimedOffer({ serviceId: selectedServiceId, serviceTitle: selectedServiceTitle, offerPercentage: 40, claimedAt: new Date().toISOString() });

        const userMetadataUpdate: any = {};
        if (selectedServiceTitle) {
          userMetadataUpdate.show_signup_offer_popup = true;
          userMetadataUpdate.signup_service_title = selectedServiceTitle;
          userMetadataUpdate.signup_service_id = selectedServiceId;
        }

        if (referrerId) {
          await supabase.from("referrals").insert({ referrer_id: referrerId, referred_user_id: authUser.id, status: 'pending', reward_amount: 50 });
          const welcomeCouponCode = `WELCOME50_${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
          await supabase.from("coupons").insert({ coupon_code: welcomeCouponCode, discount_amount: 50, is_used: false, phone_number: cleanPhone });
          userMetadataUpdate.show_welcome_reward = true;
          userMetadataUpdate.welcome_coupon_code = welcomeCouponCode;
        }

        if (Object.keys(userMetadataUpdate).length > 0) {
          await supabase.auth.updateUser({ data: userMetadataUpdate });
        }
        await checkProfileAndNavigate(authUser.id);
      }
    } catch (err: any) {
      showAlert({ type: "error", title: t("notifications.authFailed"), message: err.message });
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // LEGACY EMAIL/PASSWORD AUTHENTICATION
  // KEPT FOR FUTURE USE — DO NOT DELETE
  // ==========================================
  const handleSubmit = async () => {
    setLoading(true);

    try {
      let authUser = null;

      if (isLogin) {
        if (!email || !password) {
          showAlert({ type: "warning", title: t("notifications.missingInfo"), message: t("notifications.emailPasswordRequired") });
          setLoading(false); return;
        }
        if (!isValidEmail(email)) {
          showAlert({ type: "warning", title: "Invalid Email", message: "Please enter a valid email address." });
          setLoading(false); return;
        }
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        authUser = data.user;
      } else {
        if (!fullName || !email || !phone || !password) {
          showAlert({ type: "warning", title: t("notifications.missingInfo"), message: "All fields are required for signup (Name, Email, Phone, Password)." });
          setLoading(false); return;
        }
        if (eligibleServices.length > 0 && !selectedService) {
          showAlert({ type: "warning", title: "Select Service", message: "Please select a service for your 40% OFF discount." });
          setLoading(false); return;
        }
        if (!isValidPassword(password)) {
          showAlert({ type: "error", title: "Invalid Password", message: "Password must contain at least 8 characters, uppercase, lowercase, number, and special character." });
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
        if (!isValidEmail(email)) {
          showAlert({ type: "warning", title: "Invalid Email", message: "Please enter a valid email address." });
          setLoading(false); return;
        }

        const cleanPhone = phone.replace(/\D/g, "").slice(-10);
        if (cleanPhone.length < 10) {
          showAlert({ type: "warning", title: "Invalid Phone", message: "Please enter a valid 10-digit phone number." });
          setLoading(false); return;
        }

        const formattedPhone = `+91${cleanPhone}`;

        const { data, error } = await supabase.auth.signUp({
          email, password, options: { data: { full_name: fullName.trim(), phone_number: formattedPhone, } }
        });

        if (error) throw error;
        authUser = data.user;

        if (!authUser?.identities?.length) {
          throw new Error("This email is already registered. Please login instead.");
        }

        if (authUser) {
          await supabase.auth.updateUser({ data: { full_name: fullName.trim(), phone_number: formattedPhone, } });
          const myReferralCode = generateReferralCode(fullName.trim());
          const selectedServiceTitle = selectedService?.title || null;
          const selectedServiceId = selectedService?.id || null;

          await Promise.all([
            supabase.from("profile").upsert({ id: authUser.id, full_name: fullName.trim(), email: email.trim(), phone: cleanPhone, referral_code: myReferralCode, referred_by_id: referrerId, service_selected: selectedServiceTitle }),
            supabase.from("signup").upsert({ id: authUser.id, full_name: fullName.trim(), email: email.trim(), phone: cleanPhone, service_selected: selectedServiceTitle }),
            supabase.from("wallet").upsert({ user_id: authUser.id, balance: 0 })
          ]);

          await setClaimedOffer({ serviceId: selectedServiceId, serviceTitle: selectedServiceTitle, offerPercentage: 40, claimedAt: new Date().toISOString() });

          const userMetadataUpdate: any = {};
          if (selectedServiceTitle) {
            userMetadataUpdate.show_signup_offer_popup = true;
            userMetadataUpdate.signup_service_title = selectedServiceTitle;
            userMetadataUpdate.signup_service_id = selectedServiceId;
          }

          if (referrerId) {
            await supabase.from("referrals").insert({ referrer_id: referrerId, referred_user_id: authUser.id, status: 'pending', reward_amount: 50 });
            const welcomeCouponCode = `WELCOME50_${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
            await supabase.from("coupons").insert({ coupon_code: welcomeCouponCode, discount_amount: 50, is_used: false, phone_number: cleanPhone });
            userMetadataUpdate.show_welcome_reward = true;
            userMetadataUpdate.welcome_coupon_code = welcomeCouponCode;
          }

          if (Object.keys(userMetadataUpdate).length > 0) {
            await supabase.auth.updateUser({ data: userMetadataUpdate });
          }
        }
      }

      if (authUser) {
        await checkProfileAndNavigate(authUser.id);
      }
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
            {/* HEADER */}
            <View style={styles.header}>
              <Image source={NeatifyLogo} style={styles.logo} contentFit="contain" />
              <Text style={styles.subtitle}>
                 {isLogin ? "Welcome back! Ready for a clean home?" : "Join Neatify for a sparkling home."}
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
                  <Text style={{ textAlign: 'center', marginBottom: 10, color: '#555', fontSize: 14 }}>
                    OTP sent to +91 {phone}
                  </Text>
                  <OtpInput value={otp} onChangeText={setOtp} length={6} />
                  
                  <Pressable onPressIn={handlePressIn} onPressOut={handlePressOut} onPress={handleVerifyOtp} disabled={loading} style={{ marginTop: 20 }}>
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

              {authStep === 'profile' && !isLogin && (
                <Animated.View entering={FadeInDown.duration(400).delay(200)} style={{ gap: 12 }}>
                  <AnimatedInput
                    icon={<User size={20} color="#888" />}
                    placeholder={t("login.fullName")}
                    value={fullName}
                    onChange={setFullName}
                    autoCapitalize="words"
                  />
                  <AnimatedInput
                    icon={<Mail size={20} color="#888" />}
                    placeholder={t("login.email")}
                    value={email}
                    onChange={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
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

              {/* 
                ==========================================
                LEGACY EMAIL/PASSWORD UI
                KEPT FOR FUTURE USE — DO NOT DELETE
                ==========================================
              */}
              {/* FULL NAME */}
              {!isLogin && (
                <Animated.View entering={FadeInDown.duration(400).delay(200)}>
                  <AnimatedInput
                    icon={<User size={20} color="#888" />}
                    placeholder={t("login.fullName")}
                    value={fullName}
                    onChange={setFullName}
                    autoCapitalize="words"
                  />
                </Animated.View>
              )}

              {/* EMAIL */}
              <Animated.View entering={FadeInDown.duration(400).delay(250)}>
                <AnimatedInput
                  icon={<Mail size={20} color="#888" />}
                  placeholder={t("login.email")}
                  value={email}
                  onChange={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </Animated.View>

              {/* PHONE */}
              {!isLogin && (
                <Animated.View entering={FadeInDown.duration(400).delay(300)}>
                  <AnimatedPhoneInput value={phone} onChangeText={setPhone} />
                </Animated.View>
              )}

              {/* REFERRAL CODE */}
              {!isLogin && (
                <Animated.View entering={FadeInDown.duration(400).delay(350)}>
                  <AnimatedInput
                    icon={<Gift size={20} color="#888" />}
                    placeholder="Referral/Discount Code (Optional)"
                    value={referralCode}
                    onChange={(text: string) => setReferralCode(text.toUpperCase())}
                    autoCapitalize="characters"
                  />
                </Animated.View>
              )}

              {/* 40% OFF SERVICE DROPDOWN */}
              {!isLogin && (
                <Animated.View entering={FadeInDown.duration(400).delay(400)} style={{ marginBottom: 4 }}>
                  {eligibleServices.length > 0 ? (
                    <>
                      <Text style={styles.dropdownLabel}>🎁 Select Service for 40% OFF:</Text>
                      <AnimatedServiceDropdown 
                        selectedService={selectedService} 
                        setShowServiceDropdown={setShowServiceDropdown} 
                      />
                    </>
                  ) : (
                    <View style={styles.expiredOfferContainer}>
                      <Sparkles size={16} color="#888" />
                      <Text style={styles.expiredOfferText}>40% Welcome Offer is currently expired / inactive.</Text>
                    </View>
                  )}
                </Animated.View>
              )}

              {/* PASSWORD */}
              <Animated.View entering={FadeInDown.duration(400).delay(isLogin ? 300 : 450)}>
                <AnimatedInput
                  icon={<Lock size={20} color="#888" />}
                  placeholder={t("login.password")}
                  secureTextEntry={!showPassword}
                  value={password}
                  onChange={setPassword}
                  rightElement={
                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={{ padding: 4 }}>
                      {showPassword ? <EyeOff size={20} color="#888" /> : <Eye size={20} color="#888" />}
                    </TouchableOpacity>
                  }
                />
              </Animated.View>

              {/* PASSWORD POLICY */}
              {!isLogin && password.length > 0 && (
                <Animated.View entering={FadeInDown.duration(300)} style={styles.policyContainer}>
                  <Text style={styles.policyHeader}>Password should contain:</Text>
                  <PolicyRow label="At least 8 characters" isMet={password.length >= 8} />
                  <PolicyRow label="Lowercase letter" isMet={/[a-z]/.test(password)} />
                  <PolicyRow label="Uppercase letter" isMet={/[A-Z]/.test(password)} />
                  <PolicyRow label="Number" isMet={/\d/.test(password)} />
                  <PolicyRow label="Special character (@$!%*?&)" isMet={/[@$!%*?&]/.test(password)} />
                </Animated.View>
              )}

              {/* FORGOT PASSWORD */}
              {isLogin && (
                <Animated.View entering={FadeInDown.duration(400).delay(350)}>
                  <TouchableOpacity
                    style={{ alignSelf: "flex-end", marginTop: -4 }}
                    onPress={() => navigation.navigate("ResetPassword" as never)}
                  >
                    <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
                  </TouchableOpacity>
                </Animated.View>
              )}

              {/* SUBMIT BUTTON */}
              <Animated.View entering={FadeInDown.duration(400).delay(isLogin ? 400 : 500)}>
                <Pressable onPressIn={handlePressIn} onPressOut={handlePressOut} onPress={handleSubmit} disabled={loading}>
                  <Animated.View style={[styles.primaryBtn, buttonAnimatedStyle]}>
                    {loading ? (
                      <ActivityIndicator color="#111" />
                    ) : (
                      <Text style={styles.primaryText}>{isLogin ? t("login.loginBtn") : t("login.signupBtn")}</Text>
                    )}
                  </Animated.View>
                </Pressable>
              </Animated.View>

              {/* DIVIDER */}
              <Animated.View entering={FadeInDown.duration(400).delay(isLogin ? 450 : 550)} style={styles.dividerContainer}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>OR</Text>
                <View style={styles.dividerLine} />
              </Animated.View>

              {/* GOOGLE BUTTON */}
              <Animated.View entering={FadeInDown.duration(400).delay(isLogin ? 500 : 600)}>
                <TouchableOpacity style={styles.googleBtn} onPress={handleGoogleSignIn} disabled={googleLoading}>
                  {googleLoading ? (
                    <ActivityIndicator color="#111" />
                  ) : (
                    <>
                      <Image source={{ uri: "https://cdn-icons-png.flaticon.com/512/2991/2991148.png" }} style={styles.googleIcon} />
                      <Text style={styles.googleText}>Continue with Google</Text>
                    </>
                  )}
                </TouchableOpacity>
              </Animated.View>

              {/* FOOTER */}
              <Animated.View entering={FadeInDown.duration(400).delay(isLogin ? 550 : 650)} style={styles.footer}>
                <Text style={{ color: "#555", fontSize: 14, fontWeight: "500" }}>
                  {isLogin ? t("login.noAccount") : t("login.hasAccount")}
                </Text>
                <TouchableOpacity onPress={() => setIsLogin(!isLogin)}>
                  <Text style={styles.linkText}>
                    {isLogin ? ` ${t("login.switchSignup")}` : ` ${t("login.switchLogin")}`}
                  </Text>
                </TouchableOpacity>
              </Animated.View>

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

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
    fontSize: 14, // more compact
    fontWeight: "600",
    lineHeight: 20,
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
