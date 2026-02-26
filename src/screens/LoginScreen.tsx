import { useNavigation } from "@react-navigation/native";
import { Eye, EyeOff, Lock, Mail, Phone, User } from "lucide-react-native";
import React, { useState } from "react";

import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import NeatifyLogo from "../../assets/images/neatifylogo.png";
// import LanguageSelector from "../components/LanguageSelector"; // REMOVED
import { signInWithGoogle } from "../auth/useGoogleAuth";
import { useLanguage } from "../context/LanguageContext";
import { useNotification } from "../hooks/useNotification";
import { supabase } from "../lib/supabase";
import { COLORS } from "../theme/colors";


export default function LoginScreen(props: any) {
  const navigation = useNavigation<any>();
  const { showAlert, showToast } = useNotification();
  const { t } = useLanguage();

  /* ================= OLD STATE (Restored) ================= */
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");

  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  /* ================= NEW: PHONE LOGIN STATE ================= */
  const [loginMethod, setLoginMethod] = useState<"email" | "phone">("email");
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [phoneLoading, setPhoneLoading] = useState(false);

  const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

  // =====================================================
  // PHONE LOGIN HANDLERS
  // =====================================================

  const handleSendOtp = async () => {
    if (!phone || phone.length < 10) {
      showAlert({
        type: "warning",
        title: "Invalid Phone Number",
        message: "Please enter a valid 10-digit phone number."
      });
      return;
    }

    setPhoneLoading(true);
    try {
      // phone is guaranteed to be 10 digits from text cleaning
      const formattedPhone = `+91${phone}`;

      const { error } = await supabase.auth.signInWithOtp({
        phone: formattedPhone,
      });

      if (error) throw error;

      setOtpSent(true);
      showToast("OTP sent successfully!", "success");
    } catch (err: any) {
      showAlert({
        type: "error",
        title: "OTP Failed",
        message: err.message
      });
    } finally {
      setPhoneLoading(false);
    }
  };

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

      // Auth: at least one confirmed identity
      //   - email_confirmed_at → email or Google users
      //   - phone_confirmed_at or user.phone → phone OTP users
      const hasConfirmedIdentity = !!(user?.email_confirmed_at || user?.phone_confirmed_at || user?.phone);

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
          routes: [{ name: "Home" }],
        });
      }
    } catch (err) {
      console.error("Profile check failed:", err);
      // Fallback to Home if DB check fails
      navigation.reset({ index: 0, routes: [{ name: "Home" }] });
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp || otp.length !== 6) {
      showAlert({
        type: "warning",
        title: "Invalid OTP",
        message: "Please enter the 6-digit OTP."
      });
      return;
    }

    setPhoneLoading(true);
    try {
      // phone is now strictly 10 digits from onChangeText
      const formattedPhone = `+91${phone}`;

      const {
        data: { user },
        error,
      } = await supabase.auth.verifyOtp({
        phone: formattedPhone,
        token: otp,
        type: "sms",
      });

      if (error) throw error;

      if (user) {
        await checkProfileAndNavigate(user.id);
      }
    } catch (err: any) {
      showAlert({
        type: "error",
        title: "Verification Failed",
        message: err.message
      });
    } finally {
      setPhoneLoading(false);
    }
  };

  // =====================================================
  // EMAIL LOGIN / SIGNUP
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
        if (!isValidEmail(email)) {
          showAlert({ type: "warning", title: "Invalid Email", message: "Please enter a valid email address." });
          setLoading(false);
          return;
        }

        // Strip any leading +91/91 and non-digits, keep only last 10
        const cleanPhone = phone.replace(/\D/g, "").slice(-10);
        const formattedPhone = `+91${cleanPhone}`;

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName.trim(),
              phone_number: formattedPhone,
              phone_verified: false
            }
          }
        });

        if (error) throw error;
        authUser = data.user;
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
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

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
            {/* Language Selector Removed */}
            <Image
              source={NeatifyLogo}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.subtitle}>{t("login.title")}</Text>
          </View>

          {/* METHOD TOGGLE (Email vs Phone) */}
          <View style={styles.methodToggleContainer}>
            <TouchableOpacity
              style={[styles.methodToggle, loginMethod === "email" && styles.methodToggleActive]}
              onPress={() => setLoginMethod("email")}
            >
              <Mail size={18} color={loginMethod === "email" ? COLORS.text : COLORS.textLight} />
              <Text style={[styles.methodText, loginMethod === "email" && styles.methodTextActive]}>Email</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.methodToggle, loginMethod === "phone" && styles.methodToggleActive]}
              onPress={() => setLoginMethod("phone")}
            >
              <Phone size={18} color={loginMethod === "phone" ? COLORS.text : COLORS.textLight} />
              <Text style={[styles.methodText, loginMethod === "phone" && styles.methodTextActive]}>Phone OTP</Text>
            </TouchableOpacity>
          </View>

          {/* FORM */}
          <View style={styles.form}>

            {/* ================= PHONE LOGIN UI ================= */}
            {loginMethod === "phone" ? (
              <>
                <View style={styles.inputContainer}>
                  <Phone size={20} color={COLORS.textLight} />
                  <Text style={{ marginLeft: 10, fontSize: 16, color: COLORS.text, fontWeight: '600' }}>+91</Text>
                  <View style={{ width: 1, height: 20, backgroundColor: COLORS.inputBorder, marginHorizontal: 10 }} />
                  <TextInput
                    style={styles.input}
                    placeholder="Enter Phone Number"
                    placeholderTextColor={COLORS.placeholder}
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
                    editable={!otpSent} // Lock if OTP sent
                  />
                  {otpSent && (
                    <TouchableOpacity onPress={() => { setOtpSent(false); setOtp(""); }}>
                      <Text style={{ color: COLORS.saffron, fontWeight: "700", fontSize: 12 }}>Change</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {otpSent && (
                  <View style={styles.inputContainer}>
                    <Lock size={20} color={COLORS.textLight} />
                    <TextInput
                      style={styles.input}
                      placeholder="Enter 6-digit OTP"
                      placeholderTextColor={COLORS.placeholder}
                      value={otp}
                      onChangeText={(text) => setOtp(text.replace(/\D/g, '').slice(0, 6))}
                      keyboardType="number-pad"
                    />
                  </View>
                )}

                <TouchableOpacity
                  style={styles.primaryBtn}
                  onPress={otpSent ? handleVerifyOtp : handleSendOtp}
                  disabled={phoneLoading}
                >
                  {phoneLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.primaryText}>
                      {otpSent ? "Verify OTP" : "Get OTP"}
                    </Text>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              /* ================= EMAIL LOGIN UI ================= */
              <>
                {!isLogin && (
                  <Input
                    icon={<User size={20} />}
                    placeholder={t("login.fullName")}
                    value={fullName}
                    onChange={setFullName}
                  />
                )}

                <Input
                  icon={<Mail size={20} />}
                  placeholder={t("login.email")}
                  value={email}
                  onChange={setEmail}
                />

                {!isLogin && (
                  <Input
                    icon={<Phone size={20} />}
                    placeholder={t("login.phone")}
                    value={phone}
                    onChange={setPhone}
                  />
                )}

                {/* PASSWORD */}
                <View style={styles.inputContainer}>
                  <Lock size={20} />
                  <TextInput
                    style={styles.input}
                    placeholder={t("login.password")}
                    placeholderTextColor={COLORS.placeholder}
                    secureTextEntry={!showPassword}
                    value={password}
                    onChangeText={setPassword}
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </TouchableOpacity>
                </View>

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
                  style={styles.primaryBtn}
                  onPress={handleSubmit}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.primaryText}>
                      {isLogin ? t("login.loginBtn") : t("login.signupBtn")}
                    </Text>
                  )}
                </TouchableOpacity>
              </>
            )}

            {/* GOOGLE - Available for both methods logic or just separate? Keep it here */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 10 }}>
              <View style={{ flex: 1, height: 1, backgroundColor: COLORS.inputBorder }} />
              <Text style={{ marginHorizontal: 10, color: COLORS.textLight, fontSize: 12 }}>OR</Text>
              <View style={{ flex: 1, height: 1, backgroundColor: COLORS.inputBorder }} />
            </View>

            <TouchableOpacity
              style={styles.googleBtn}
              onPress={handleGoogleSignIn}
              disabled={googleLoading}
            >
              {googleLoading ? (
                <ActivityIndicator color={COLORS.text} />
              ) : (
                <>
                  <Image
                    source={{
                      uri: "https://cdn-icons-png.flaticon.com/512/2991/2991148.png",
                    }}
                    style={styles.googleIcon}
                  />
                  <Text style={styles.googleText}>Continue with Google</Text>
                </>
              )}
            </TouchableOpacity>

            {/* FOOTER */}
            {loginMethod === "email" && (
              <View style={styles.footer}>
                <Text>
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
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Input({ icon, placeholder, value, onChange }: any) {
  return (
    <View style={styles.inputContainer}>
      {icon}
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={COLORS.placeholder}
        value={value}
        onChangeText={onChange}
      />
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

  // Method Toggle
  methodToggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  methodToggle: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 8,
  },
  methodToggleActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  methodText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textLight,
  },
  methodTextActive: {
    color: COLORS.text,
    fontWeight: '700',
  },

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
});