import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { Image } from "expo-image";
import { ChevronDown, Eye, EyeOff, Gift, Lock, Mail, Phone, Sparkles, User } from "lucide-react-native";
import React, { useState } from "react";

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
} from "react-native";
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


export default function LoginScreen(props: any) {
  const navigation = useNavigation<any>();
  const { showAlert, showToast } = useNotification();
  const { t } = useLanguage();
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const [isLogin, setIsLogin] = useState(!props.route?.params?.isRegister);
  const [showPassword, setShowPassword] = useState(false);

  React.useEffect(() => {
    if (props.route?.params?.isRegister) {
      setIsLogin(false);
    }
  }, [props.route?.params]);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [referralCode, setReferralCode] = useState("");

  // Eligible Services for 40% OFF Dropdown
  const [eligibleServices, setEligibleServices] = useState<any[]>([]);
  const [selectedService, setSelectedService] = useState<any | null>(null);
  const [showServiceDropdown, setShowServiceDropdown] = useState(false);

  React.useEffect(() => {
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
        // Fallback: fetch all active services if no specific welcome offer flag is set
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


  // =====================================================
  // SHARED: CHECK PROFILE & NAVIGATE
  // =====================================================
  const checkProfileAndNavigate = async (userId: string) => {
    try {
      const { data: profile } = await supabase
        .from("profile")
        .select("full_name, email, phone")
        .eq("id", userId)
        .maybeSingle();

      const { data: { user } } = await supabase.auth.getUser();

      // Profile DB: all 3 fields must exist
      const hasFullProfile = !!(profile?.full_name && profile?.email && profile?.phone);

      // Auth: email must be confirmed (covers both email and Google users)
      const hasConfirmedIdentity = !!user?.email_confirmed_at;

      if (!hasFullProfile || !hasConfirmedIdentity) {
        // Incomplete profile → Go to CompleteProfile
        navigation.reset({
          index: 0,
          routes: [{ name: "CompleteProfile" }],
        });
      } else {
        // All good → Go Home
        navigation.reset({
          index: 0,
          routes: [{ name: "HomeDrawer" }],
        });
      }
    } catch (err) {
      console.error("Profile check failed:", err);
      // Fallback to Home if DB check fails
      navigation.reset({ index: 0, routes: [{ name: "HomeDrawer" }] });
    }
  };

  // =====================================================
  // GOOGLE SIGN-IN
  // =====================================================
  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
      // Note: Success navigation is usually handled by App.tsx/Auth listener
    } catch (err: any) {
      showAlert({
        type: "error",
        title: "Google Sign-In Failed",
        message: err.message,
      });
    } finally {
      setGoogleLoading(false);
    }
  };

  // =====================================================
  // EMAIL LOGIN / SIGNUP
  // =====================================================
  const handleSubmit = async () => {
    setLoading(true);

    try {
      let authUser = null;

      if (isLogin) {
        // LOGIN MODE: Email + Password required
        if (!email || !password) {
          showAlert({
            type: "warning",
            title: t("notifications.missingInfo"),
            message: t("notifications.emailPasswordRequired")
          });
          setLoading(false);
          return;
        }
        if (!isValidEmail(email)) {
          showAlert({ type: "warning", title: "Invalid Email", message: "Please enter a valid email address." });
          setLoading(false);
          return;
        }
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        authUser = data.user;
      } else {
        // SIGNUP MODE: Create account immediately
        if (!fullName || !email || !phone || !password) {
          showAlert({
            type: "warning",
            title: t("notifications.missingInfo"),
            message: "All fields are required for signup (Name, Email, Phone, Password)."
          });
          setLoading(false);
          return;
        }

        if (eligibleServices.length > 0 && !selectedService) {
          showAlert({
            type: "warning",
            title: "Select Service",
            message: "Please select a service for your 40% OFF discount."
          });
          setLoading(false);
          return;
        }

        if (!isValidPassword(password)) {
          showAlert({
            type: "error",
            title: "Invalid Password",
            message: "Password must contain at least 8 characters, uppercase, lowercase, number, and special character."
          });
          setLoading(false);
          return;
        }


        // Validate Referral Code if provided
        let referrerId = null;
        if (referralCode.trim()) {
          referrerId = await validateReferralCode(referralCode.trim());
          if (!referrerId) {
            showAlert({ type: "warning", title: "Invalid Referral", message: "The referral code you entered is invalid. You can continue without it." });
            setLoading(false);
            return;
          }
        }
        if (!isValidEmail(email)) {
          showAlert({ type: "warning", title: "Invalid Email", message: "Please enter a valid email address." });
          setLoading(false);
          return;
        }

        // Strip any leading +91/91 and non-digits, keep only last 10
        const cleanPhone = phone.replace(/\D/g, "").slice(-10);

        if (cleanPhone.length < 10) {
          showAlert({ type: "warning", title: "Invalid Phone", message: "Please enter a valid 10-digit phone number." });
          setLoading(false);
          return;
        }

        const formattedPhone = `+91${cleanPhone}`;

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName.trim(),
              phone_number: formattedPhone,
            }
          }
        });

        if (error) throw error;
        authUser = data.user;

        // If identities is empty, the email was already registered
        if (!authUser?.identities?.length) {
          throw new Error("This email is already registered. Please login instead.");
        }

        // Explicitly update Auth user_metadata to ensure it persists
        if (authUser) {
          await supabase.auth.updateUser({
            data: {
              full_name: fullName.trim(),
              phone_number: formattedPhone,
            }
          });
        }

        // Upsert profile and signup tables immediately so completeness check passes
        if (authUser) {
          const myReferralCode = generateReferralCode(fullName.trim());
          const selectedServiceTitle = selectedService?.title || null;
          const selectedServiceId = selectedService?.id || null;

          await Promise.all([
            supabase.from("profile").upsert({
              id: authUser.id,
              full_name: fullName.trim(),
              email: email.trim(),
              phone: cleanPhone,
              referral_code: myReferralCode,
              referred_by_id: referrerId,
              service_selected: selectedServiceTitle,
            }),
            supabase.from("signup").upsert({
              id: authUser.id,
              full_name: fullName.trim(),
              email: email.trim(),
              phone: cleanPhone,
              service_selected: selectedServiceTitle,
            }),
            // Initialize Wallet
            supabase.from("wallet").upsert({
              user_id: authUser.id,
              balance: 0
            })
          ]);

          // Save 40% OFF claimed offer for new user registration
          await setClaimedOffer({
            serviceId: selectedServiceId,
            serviceTitle: selectedServiceTitle,
            offerPercentage: 40,
            claimedAt: new Date().toISOString(),
          });

          const userMetadataUpdate: any = {};
          if (selectedServiceTitle) {
            userMetadataUpdate.show_signup_offer_popup = true;
            userMetadataUpdate.signup_service_title = selectedServiceTitle;
            userMetadataUpdate.signup_service_id = selectedServiceId;
          }

          // If referred, create the tracking record AND the ₹50 coupon
          if (referrerId) {
            // 1. Referral tracking
            await supabase.from("referrals").insert({
              referrer_id: referrerId,
              referred_user_id: authUser.id,
              status: 'pending',
              reward_amount: 50
            });

            // 2. Create the ₹50 Welcome Coupon for the new user
            const welcomeCouponCode = `WELCOME50_${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
            await supabase.from("coupons").insert({
              coupon_code: welcomeCouponCode,
              discount_amount: 50,
              is_used: false,
              phone_number: cleanPhone // Link to user's phone
            });

            userMetadataUpdate.show_welcome_reward = true;
            userMetadataUpdate.welcome_coupon_code = welcomeCouponCode;
          }

          if (Object.keys(userMetadataUpdate).length > 0) {
            await supabase.auth.updateUser({
              data: userMetadataUpdate
            });
          }
        }
      }

      if (authUser) {
        await checkProfileAndNavigate(authUser.id);
      }
    } catch (err: any) {
      showAlert({
        type: "error",
        title: t("notifications.authFailed"),
        message: err.message
      });
    } finally {
      setLoading(false);
    }
  };



  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={theme.background} />

      {/* BACK BUTTON */}
      <TouchableOpacity
        onPress={() => {
          if (navigation.canGoBack()) {
            navigation.goBack();
          } else {
            navigation.replace("HomeDrawer");
          }
        }}
        style={{
          position: "absolute",
          top: Math.max(insets.top, 20), // Use safe inset or at least 20px
          left: 15,
          zIndex: 100,
          padding: 8,
          borderRadius: 25,
          backgroundColor: isDark ? "rgba(255, 255, 255, 0.15)" : "rgba(0,0,0,0.08)",
        }}
      >
        <Ionicons name="arrow-back" size={26} color={theme.text} />
      </TouchableOpacity>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* HEADER */}
          <View style={styles.header}>
            <Image
              source={isDark ? DarkThemeLogo : NeatifyLogo}
              style={styles.logo}
              contentFit="contain"
            />
            <Text style={[styles.subtitle, { color: theme.textLight }]}>{t("login.title")}</Text>
          </View>

          {/* FORM */}
          <View style={styles.form}>

            {/* SIGNUP: Full Name */}
            {!isLogin && (
              <Input
                icon={<User size={20} color={theme.textLight} />}
                placeholder={t("login.fullName")}
                value={fullName}
                onChange={setFullName}
                theme={theme}
              />
            )}

            {/* Email */}
            <Input
              icon={<Mail size={20} color={theme.textLight} />}
              placeholder={t("login.email")}
              value={email}
              onChange={setEmail}
              theme={theme}
            />

            {/* SIGNUP: Phone Number (no verification) */}
            {!isLogin && (
              <View style={[styles.inputContainer, { backgroundColor: theme.background, borderColor: theme.border }]}>
                <Phone size={20} color={theme.textLight} />
                <Text style={{ marginLeft: 10, fontSize: 16, color: theme.text, fontWeight: '600' }}>+91</Text>
                <View style={{ width: 1, height: 20, backgroundColor: theme.border, marginHorizontal: 10 }} />
                <TextInput
                  style={[styles.input, { color: theme.text }]}
                  placeholder={t("login.phone")}
                  placeholderTextColor={theme.textLight}
                  value={phone}
                  onChangeText={(text) => {
                    // Strip all non-digits
                    let cleaned = text.replace(/\D/g, '');
                    // If it starts with 91 and is longer than 10 digits, strip the 91
                    if (cleaned.startsWith('91') && cleaned.length > 10) {
                      cleaned = cleaned.slice(2);
                    }
                    setPhone(cleaned.slice(0, 10));
                  }}
                  keyboardType="phone-pad"
                  maxLength={10}
                />
              </View>
            )}

            {/* SIGNUP: Referral Code (Optional) */}
            {!isLogin && (
              <View style={[styles.inputContainer, { backgroundColor: theme.background, borderColor: theme.border }]}>
                <Gift size={20} color={theme.textLight} />
                <TextInput
                  style={[styles.input, { color: theme.text }]}
                  placeholder="Referral/Discount Code (Optional)"
                  placeholderTextColor={theme.textLight}
                  value={referralCode}
                  onChangeText={(text) => setReferralCode(text.toUpperCase())}
                  autoCapitalize="characters"
                />
              </View>
            )}

            {/* SIGNUP: Select Service for 40% OFF */}
            {!isLogin && (
              eligibleServices.length > 0 ? (
                <View style={{ marginBottom: 12 }}>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: COLORS.saffron, marginBottom: 6, marginLeft: 2 }}>
                    🎁 Select Service for 40% OFF:
                  </Text>
                  <TouchableOpacity
                    style={[
                      styles.inputContainer,
                      { backgroundColor: theme.background, borderColor: selectedService ? COLORS.saffron : theme.border }
                    ]}
                    onPress={() => setShowServiceDropdown(true)}
                    activeOpacity={0.8}
                  >
                    <Sparkles size={20} color={COLORS.saffron} />
                    <Text
                      style={[
                        styles.input,
                        { color: selectedService ? theme.text : theme.textLight, textAlignVertical: "center" }
                      ]}
                      numberOfLines={1}
                    >
                      {selectedService ? selectedService.title : "Select a service for 40% OFF"}
                    </Text>
                    <ChevronDown size={20} color={theme.textLight} />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={{ marginBottom: 12, padding: 10, backgroundColor: theme.surfaceVariant, borderRadius: 8, flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Sparkles size={16} color={theme.textLight} />
                  <Text style={{ fontSize: 12, color: theme.textLight, fontWeight: "600" }}>
                    40% Welcome Offer is currently expired / inactive.
                  </Text>
                </View>
              )
            )}

            {/* PASSWORD */}
            <View style={[styles.inputContainer, { backgroundColor: theme.background, borderColor: theme.border }]}>
              <Lock size={20} color={theme.textLight} />
              <TextInput
                style={[styles.input, { color: theme.text }]}
                placeholder={t("login.password")}
                placeholderTextColor={theme.textLight}
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                {showPassword ? <EyeOff size={20} color={theme.textLight} /> : <Eye size={20} color={theme.textLight} />}
              </TouchableOpacity>
            </View>

            {/* PASSWORD POLICY (SIGNUP ONLY) */}
            {!isLogin && password.length > 0 && (
              <View style={styles.policyContainer}>
                <Text style={[styles.policyHeader, { color: theme.text }]}>Should contain:</Text>
                <PolicyRow label="At least 8 characters in length" isMet={password.length >= 8} theme={theme} />
                <PolicyRow label="Lowercase letters (a-z)" isMet={/[a-z]/.test(password)} theme={theme} />
                <PolicyRow label="Uppercase letters (A-Z)" isMet={/[A-Z]/.test(password)} theme={theme} />
                <PolicyRow label="Numbers (0-9)" isMet={/\d/.test(password)} theme={theme} />
                <PolicyRow label="Special characters (@$!%*?&)" isMet={/[@$!%*?&]/.test(password)} theme={theme} />
              </View>
            )}



            {/* FORGOT PASSWORD */}
            {isLogin && (
              <TouchableOpacity
                style={{ alignSelf: "flex-end" }}
                onPress={() => navigation.navigate("ResetPassword" as never)}
              >
                <Text style={styles.link}>Forgot Password?</Text>
              </TouchableOpacity>
            )}

            {/* SUBMIT */}
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: theme.primary }]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={theme.background} />
              ) : (
                <Text style={[styles.primaryText, { color: theme.background }]}>
                  {isLogin ? t("login.loginBtn") : t("login.signupBtn")}
                </Text>
              )}
            </TouchableOpacity>

            {/* DIVIDER */}
            <View style={{ flexDirection: "row", alignItems: "center", marginVertical: 20 }}>
              <View style={{ flex: 1, height: 1, backgroundColor: theme.border }} />
              <Text style={{ marginHorizontal: 10, color: theme.textLight, fontSize: 12 }}>OR</Text>
              <View style={{ flex: 1, height: 1, backgroundColor: theme.border }} />
            </View>

            <TouchableOpacity
              style={[styles.googleBtn, { backgroundColor: theme.background, borderColor: theme.border }]}
              onPress={handleGoogleSignIn}
              disabled={googleLoading}
            >
              {googleLoading ? (
                <ActivityIndicator color={theme.text} />
              ) : (
                <>
                  <Image
                    source={{
                      uri: "https://cdn-icons-png.flaticon.com/512/2991/2991148.png",
                    }}
                    style={styles.googleIcon}
                  />
                  <Text style={[styles.googleText, { color: theme.text }]}>Continue with Google</Text>
                </>
              )}
            </TouchableOpacity>

            {/* FOOTER */}
            <View style={styles.footer}>
              <Text style={{ color: theme.text }}>
                {isLogin
                  ? t("login.noAccount")
                  : t("login.hasAccount")}
              </Text>
              <TouchableOpacity onPress={() => setIsLogin(!isLogin)}>
                <Text style={styles.link}>
                  {isLogin ? ` ${t("login.switchSignup")}` : ` ${t("login.switchLogin")}`}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Service Selection Dropdown Modal */}
      <Modal
        visible={showServiceDropdown}
        transparent
        animationType="fade"
        statusBarTranslucent={true}
        onRequestClose={() => setShowServiceDropdown(false)}
      >
        <Pressable style={dropdownStyles.overlay} onPress={() => setShowServiceDropdown(false)}>
          <Pressable
            style={[
              dropdownStyles.container,
              {
                backgroundColor: theme.surface || theme.background,
                borderColor: theme.border,
                borderWidth: 1,
              }
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={[dropdownStyles.header, { borderBottomColor: theme.border }]}>
              <Text style={[dropdownStyles.title, { color: theme.text }]}>Choose Service for 40% OFF 🎉</Text>
              <TouchableOpacity
                onPress={() => setShowServiceDropdown(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
              {eligibleServices.map((svc) => {
                const isSelected = selectedService?.id === svc.id;
                return (
                  <TouchableOpacity
                    key={svc.id}
                    style={[
                      dropdownStyles.item,
                      { borderBottomColor: theme.border },
                      isSelected && { backgroundColor: COLORS.saffron + "20" }
                    ]}
                    onPress={() => {
                      setSelectedService(svc);
                      setShowServiceDropdown(false);
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[dropdownStyles.itemTitle, { color: theme.text, fontWeight: isSelected ? "800" : "600" }]}>{svc.title}</Text>
                      {svc.service_type && (
                        <Text style={{ fontSize: 12, color: theme.textLight, marginTop: 2 }}>{svc.service_type}</Text>
                      )}
                    </View>
                    <View style={[dropdownStyles.badge, { backgroundColor: COLORS.saffron + "25" }]}>
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

function Input({ icon, placeholder, value, onChange, theme }: any) {
  return (
    <View style={[styles.inputContainer, { backgroundColor: theme.background, borderColor: theme.border }]}>
      {icon}
      <TextInput
        style={[styles.input, { color: theme.text }]}
        placeholder={placeholder}
        placeholderTextColor={theme.textLight}
        value={value}
        onChangeText={onChange}
      />
    </View>
  );
}

function PolicyRow({ label, isMet, theme }: { label: string, isMet: boolean, theme: any }) {
  return (
    <View style={styles.policyRow}>
      <Ionicons
        name={isMet ? "checkmark-circle" : "close-circle"}
        size={16}
        color={isMet ? "#4CAF50" : "#F44336"}
      />
      <Text style={[styles.policyText, { color: isMet ? "#4CAF50" : theme.textLight }]}>
        {label}
      </Text>
    </View>
  );
}


const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 25, paddingBottom: 70 },
  header: { alignItems: "center", marginBottom: 20, marginTop: 40 },
  iconCircle: {
    width: 65,
    height: 65,
    backgroundColor: "#000",
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 15,
  },
  logo: {
    width: 220,
    height: 80,
    marginBottom: 5,
    marginLeft: "-5%",
  },

  title: { fontSize: 28, fontWeight: "800", color: COLORS.text },
  subtitle: { color: COLORS.textLight },

  form: { gap: 12 },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: COLORS.inputBorder,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  input: { flex: 1, fontSize: 16, marginLeft: 10, color: COLORS.text },
  primaryBtn: {
    backgroundColor: COLORS.saffron,
    height: 56,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: { color: COLORS.text, fontWeight: "700" },

  googleBtn: {
    height: 56,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.inputBorder,
    backgroundColor: COLORS.white,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
  },
  googleIcon: { width: 20, height: 20 },
  googleText: { fontSize: 16, fontWeight: "700", color: COLORS.text },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: 20 },
  link: { fontWeight: "800", color: COLORS.saffron },

  // PASSWORD POLICY
  policyContainer: {
    paddingHorizontal: 5,
    marginTop: -4,
    marginBottom: 8,
    gap: 4,
  },
  policyHeader: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 2,
  },
  policyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  policyText: {
    fontSize: 12,
    fontWeight: "500",
  },
});

const dropdownStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    zIndex: 9999,
  },
  container: {
    width: "100%",
    borderRadius: 16,
    padding: 20,
    maxHeight: 450,
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    zIndex: 10000,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 12,
    borderBottomWidth: 1,
    marginBottom: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
  },
  item: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderBottomWidth: 0.5,
    borderRadius: 8,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
});
