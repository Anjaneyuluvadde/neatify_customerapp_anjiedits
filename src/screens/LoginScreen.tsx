import { useNavigation } from "@react-navigation/native";
import { Image } from "expo-image";
import { Eye, EyeOff, Lock, Mail, Phone, User } from "lucide-react-native";
import React, { useState } from "react";

import {
  ActivityIndicator,
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
import { signInWithGoogle } from "../auth/useGoogleAuth";
import { useLanguage } from "../context/LanguageContext";
import { useNotification } from "../hooks/useNotification";
import { supabase } from "../lib/supabase";
import { COLORS } from "../theme/colors";


export default function LoginScreen(props: any) {
  const navigation = useNavigation<any>();
  const { showAlert, showToast } = useNotification();
  const { t } = useLanguage();

  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");

  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

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
          routes: [{ name: "Home" }],
        });
      }
    } catch (err) {
      console.error("Profile check failed:", err);
      // Fallback to Home if DB check fails
      navigation.reset({ index: 0, routes: [{ name: "Home" }] });
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
          await Promise.all([
            supabase.from("profile").upsert({
              id: authUser.id,
              full_name: fullName.trim(),
              email: email.trim(),
              phone: cleanPhone,
            }),
            supabase.from("signup").upsert({
              id: authUser.id,
              full_name: fullName.trim(),
              email: email.trim(),
              phone: cleanPhone,
            })
          ]);
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
            <Image
              source={NeatifyLogo}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.subtitle}>{t("login.title")}</Text>
          </View>

          {/* FORM */}
          <View style={styles.form}>

            {/* SIGNUP: Full Name */}
            {!isLogin && (
              <Input
                icon={<User size={20} />}
                placeholder={t("login.fullName")}
                value={fullName}
                onChange={setFullName}
              />
            )}

            {/* Email */}
            <Input
              icon={<Mail size={20} />}
              placeholder={t("login.email")}
              value={email}
              onChange={setEmail}
            />

            {/* SIGNUP: Phone Number (no verification) */}
            {!isLogin && (
              <View style={styles.inputContainer}>
                <Phone size={20} color={COLORS.textLight} />
                <Text style={{ marginLeft: 10, fontSize: 16, color: COLORS.text, fontWeight: '600' }}>+91</Text>
                <View style={{ width: 1, height: 20, backgroundColor: COLORS.inputBorder, marginHorizontal: 10 }} />
                <TextInput
                  style={styles.input}
                  placeholder={t("login.phone")}
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
                />
              </View>
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

            {/* GOOGLE */}
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