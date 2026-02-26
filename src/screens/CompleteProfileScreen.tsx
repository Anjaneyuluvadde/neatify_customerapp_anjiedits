import { useNavigation, useRoute } from "@react-navigation/native";
import { ChevronLeft, Eye, EyeOff, Lock, Mail, Phone, User } from "lucide-react-native";
import React, { useEffect, useState } from "react";
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
import { useNotification } from "../hooks/useNotification";
import { supabase } from "../lib/supabase";
import { COLORS } from "../theme/colors";

export default function CompleteProfileScreen() {
    const navigation = useNavigation<any>();
    const route = useRoute<any>();
    const { initialData } = route.params || {};
    const { showAlert, showToast } = useNotification();

    const [fullName, setFullName] = useState(initialData?.fullName || "");
    const [email, setEmail] = useState(initialData?.email || "");
    const [phone, setPhone] = useState(() => {
        const raw = initialData?.phone || "";
        const digits = raw.replace(/\D/g, "");
        return digits.length > 10 ? digits.slice(-10) : digits;
    });
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Auth state flags
    const [needsEmail, setNeedsEmail] = useState(true);
    const [needsPhone, setNeedsPhone] = useState(true);
    const [needsPassword, setNeedsPassword] = useState(false);
    // Track whether this user had NO email in Auth at the time they opened this screen
    const [startedWithoutEmail, setStartedWithoutEmail] = useState(false);

    // OTP states
    const [otpSent, setOtpSent] = useState(false);
    const [otpCode, setOtpCode] = useState("");
    const [isPhoneVerified, setIsPhoneVerified] = useState(false);
    const [otpLoading, setOtpLoading] = useState(false);

    useEffect(() => {
        loadCurrentData();
    }, []);

    const loadCurrentData = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) {
                navigation.replace("Login");
                return;
            }

            const providers = user.app_metadata?.providers || [];
            if (!providers.includes('email')) {
                setNeedsPassword(true);
            }

            // Helper to clean phone to 10 digits
            const cleanPhone = (raw?: string | null) => {
                if (!raw) return "";
                // Strip all non-digits and keep only last 10
                const digits = raw.replace(/\D/g, "");
                return digits.slice(-10);
            };

            // Pre-fill from Auth
            setFullName(user.user_metadata?.full_name || "");
            setEmail(user.email || "");

            // Check if they have a verified phone identity
            // We consider the phone verified ONLY if phone_confirmed_at exists.
            const hasPhoneIdentity = !!user.phone_confirmed_at;
            setPhone(cleanPhone(user.user_metadata?.phone_number) || cleanPhone(user.user_metadata?.phone) || cleanPhone(user.phone));
            setIsPhoneVerified(hasPhoneIdentity);
            setNeedsPhone(!hasPhoneIdentity);

            setNeedsEmail(!user.email);
            // If user had no email when they opened this screen, remember that
            setStartedWithoutEmail(!user.email);

            // Pre-fill from Profile table
            const { data: profile } = await supabase
                .from("profile")
                .select("*")
                .eq("id", user.id)
                .maybeSingle();

            if (profile) {
                if (profile.full_name) setFullName(profile.full_name);
                if (profile.email) setEmail(profile.email);
                if (profile.phone) {
                    setPhone(cleanPhone(profile.phone));
                }
            }
        } catch (error) {
            console.log("Error loading user data:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleBack = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                // If authenticated but here, they are incomplete. 
                // Sign out to prevent stuck state on next open
                await supabase.auth.signOut();
            }

            navigation.replace("Login");
        } catch (error) {
            navigation.replace("Login");
        }
    };

    const handleSendOtp = async () => {
        if (!phone.trim() || phone.length < 10) {
            showAlert({ type: "warning", title: "Invalid Phone", message: "Please enter a valid 10-digit phone number." });
            return;
        }

        setOtpLoading(true);
        try {
            const formattedPhone = `+91${phone}`;

            // Existing user (Google/phone/email) — use updateUser to link phone
            const { error } = await supabase.auth.updateUser({
                phone: formattedPhone
            });
            if (error) throw error;

            setOtpSent(true);
            showToast("Verification code sent!", "info");
        } catch (error: any) {
            console.error("Error sending OTP:", error);
            showAlert({
                type: "error",
                title: "OTP Failed",
                message: error.message
            });
        } finally {
            setOtpLoading(false);
        }
    };

    const handleVerifyOtp = async () => {
        if (!otpCode || otpCode.length !== 6) {
            showAlert({ type: "warning", title: "Invalid Code", message: "Please enter the 6-digit verification code." });
            return;
        }

        setOtpLoading(true);
        try {
            const formattedPhone = `+91${phone}`;

            // Linking phone to a session that was triggered by updateUser
            const { error } = await supabase.auth.verifyOtp({
                phone: formattedPhone,
                token: otpCode,
                type: 'phone_change'
            });
            if (error) throw error;

            setIsPhoneVerified(true);
            setOtpSent(false);
            setNeedsPhone(false);

            // Show final success alert
            showAlert({
                type: "success",
                title: "Phone Verified!",
                message: "Your phone number has been successfully verified.",
            });
        } catch (error: any) {
            console.error("Error verifying OTP:", error);
            showAlert({
                type: "error",
                title: "Verification Failed",
                message: error.message
            });
        } finally {
            setOtpLoading(false);
        }
    };

    const handleSubmit = async () => {
        if (!fullName.trim()) {
            showAlert({ type: "warning", title: "Missing Information", message: "Please enter your full name." });
            return;
        }

        if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
            showAlert({ type: "warning", title: "Invalid Email", message: "Please enter a valid email address." });
            return;
        }

        if (!phone.trim() || phone.length < 10) {
            showAlert({ type: "warning", title: "Invalid Phone", message: "Please enter a valid 10-digit phone number." });
            return;
        }

        // Check if phone verified
        if (!isPhoneVerified) {
            showAlert({ type: "warning", title: "Phone Unverified", message: "Please verify your phone number first." });
            return;
        }

        if (needsPassword) {
            if (!password || password.length < 6) {
                showAlert({ type: "warning", title: "Weak Password", message: "Password must be at least 6 characters long." });
                return;
            }

            if (password !== confirmPassword) {
                showAlert({ type: "warning", title: "Password Mismatch", message: "Passwords do not match." });
                return;
            }
        }

        setSaving(true);

        try {
            // Always store phone as clean 10-digit number in DB
            const cleanDigits = phone.replace(/\D/g, "").slice(-10);
            const formattedPhone = `+91${cleanDigits}`;
            let currentUser = null;

            // Existing user: Update
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("No authenticated user found.");
            currentUser = user;

            const updatePayload: any = {
                data: {
                    full_name: fullName.trim(),
                    phone_number: formattedPhone
                }
            };

            if (email !== user.email) {
                updatePayload.email = email.trim();
            }

            if (needsPassword && password) {
                updatePayload.password = password;
            }

            const { error: updateError } = await supabase.auth.updateUser(
                updatePayload,
                { emailRedirectTo: 'theneatifyteam://home' }
            );
            if (updateError) throw updateError;

            if (!currentUser) throw new Error("User operation failed.");

            // Sync with local tables
            await Promise.all([
                supabase.from("profile").upsert({
                    id: currentUser?.id,
                    full_name: fullName.trim(),
                    email: email.trim(),
                    phone: cleanDigits,
                }),
                supabase.from("signup").upsert({
                    id: currentUser?.id,
                    full_name: fullName.trim(),
                    email: email.trim(),
                    phone: cleanDigits,
                })
            ]);

            if (startedWithoutEmail) {
                // Phone user who just added email via updateUser — needs to confirm it
                showAlert({
                    type: "info",
                    title: "Confirm Your Email",
                    message: `A verification link has been sent to ${email.trim()}. You can click it later to enable Email/Google login for this account.`,
                    onConfirm: () => {
                        navigation.reset({
                            index: 0,
                            routes: [{ name: "Home" }],
                        });
                    }
                });
            } else {
                // Everything done (e.g. Google user update)
                showToast("Profile updated!", "success");
                navigation.reset({
                    index: 0,
                    routes: [{ name: "Home" }],
                });
            }

        } catch (error: any) {
            console.log("Error handling profile:", error);

            let errorMessage = error.message;
            if (errorMessage.includes("already been registered")) {
                errorMessage = "This email is already linked to another account. Please use a different email or log in with that email account.";
            }

            showAlert({
                type: "error",
                title: "Update Failed",
                message: errorMessage
            });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#fff" }}>
                <ActivityIndicator size="large" color={COLORS.saffron} />
            </View>
        );
    }

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
            <StatusBar barStyle="dark-content" backgroundColor="#fff" />

            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={{ flex: 1 }}
            >
                <ScrollView contentContainerStyle={styles.container}>
                    <View style={styles.header}>
                        <TouchableOpacity
                            onPress={handleBack}
                            style={styles.backButton}
                        >
                            <ChevronLeft size={28} color={COLORS.text} />
                        </TouchableOpacity>
                        <Text style={styles.title}>Complete Your Profile</Text>
                        <Text style={styles.subtitle}>
                            Just a few details to get you started.
                        </Text>
                    </View>

                    <View style={styles.form}>
                        {/* FULL NAME */}
                        <View style={styles.inputContainer}>
                            <User size={20} color={COLORS.textLight} />
                            <TextInput
                                style={styles.input}
                                placeholder="Full Name"
                                placeholderTextColor={COLORS.placeholder}
                                value={fullName}
                                onChangeText={setFullName}
                            />
                        </View>

                        {/* EMAIL */}
                        <View style={styles.inputContainer}>
                            <Mail size={20} color={COLORS.textLight} />
                            <TextInput
                                style={styles.input}
                                placeholder="Email Address"
                                placeholderTextColor={COLORS.placeholder}
                                value={email}
                                onChangeText={setEmail}
                                keyboardType="email-address"
                                autoCapitalize="none"
                            />
                        </View>

                        {/* PHONE NUMBER - Critical for Google/Email users */}
                        <View>
                            <View style={styles.inputContainer}>
                                <Phone size={20} color={COLORS.textLight} />
                                <Text style={{ marginLeft: 10, fontSize: 16, color: COLORS.text, fontWeight: '600' }}>+91</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Phone Number"
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
                                        if (isPhoneVerified) setIsPhoneVerified(false);
                                    }}
                                    keyboardType="phone-pad"
                                    maxLength={10}
                                    editable={!otpSent && !isPhoneVerified}
                                />
                                {isPhoneVerified ? (
                                    <View style={styles.verifiedBadge}>
                                        <Text style={styles.verifiedText}>Verified</Text>
                                    </View>
                                ) : (
                                    <TouchableOpacity
                                        onPress={handleSendOtp}
                                        disabled={otpLoading || phone.length < 10 || otpSent || isPhoneVerified}
                                        style={{ padding: 5 }}
                                    >
                                        <Text style={{
                                            color: (phone.length === 10 && !otpSent && !isPhoneVerified)
                                                ? COLORS.saffron
                                                : COLORS.textLight,
                                            fontWeight: '700'
                                        }}>
                                            {otpLoading ? "..." : otpSent ? "Sent" : "Verify"}
                                        </Text>
                                    </TouchableOpacity>
                                )}
                            </View>

                            {/* OTP INPUT */}
                            {otpSent && (
                                <View style={[styles.inputContainer, { marginTop: 10, borderColor: COLORS.saffron }]}>
                                    <Lock size={20} color={COLORS.saffron} />
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Enter 6-digit OTP"
                                        placeholderTextColor={COLORS.placeholder}
                                        value={otpCode}
                                        onChangeText={setOtpCode}
                                        keyboardType="number-pad"
                                        maxLength={6}
                                    />
                                    <TouchableOpacity
                                        onPress={handleVerifyOtp}
                                        disabled={otpLoading || otpCode.length < 6}
                                        style={styles.verifyBtn}
                                    >
                                        {otpLoading ? (
                                            <ActivityIndicator size="small" color="#fff" />
                                        ) : (
                                            <Text style={styles.verifyBtnText}>Confirm</Text>
                                        )}
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>

                        {/* PASSWORD (Only if needed) */}
                        {needsPassword && (
                            <>
                                <View style={styles.inputContainer}>
                                    <Lock size={20} color={COLORS.textLight} />
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Create Password"
                                        placeholderTextColor={COLORS.placeholder}
                                        secureTextEntry={!showPassword}
                                        value={password}
                                        onChangeText={setPassword}
                                    />
                                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                                        {showPassword ? <EyeOff size={20} color={COLORS.textLight} /> : <Eye size={20} color={COLORS.textLight} />}
                                    </TouchableOpacity>
                                </View>

                                <View style={styles.inputContainer}>
                                    <Lock size={20} color={COLORS.textLight} />
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Confirm Password"
                                        placeholderTextColor={COLORS.placeholder}
                                        secureTextEntry={!showConfirmPassword}
                                        value={confirmPassword}
                                        onChangeText={setConfirmPassword}
                                    />
                                    <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                                        {showConfirmPassword ? <EyeOff size={20} color={COLORS.textLight} /> : <Eye size={20} color={COLORS.textLight} />}
                                    </TouchableOpacity>
                                </View>
                            </>
                        )}

                        <TouchableOpacity
                            style={[styles.primaryBtn, (saving || otpSent || !isPhoneVerified) && styles.disabledBtn]}
                            onPress={handleSubmit}
                            disabled={saving || otpSent || !isPhoneVerified}
                        >
                            {saving ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.primaryText}>
                                    Save & Continue
                                </Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flexGrow: 1, padding: 25 },
    header: { marginBottom: 30, marginTop: 10 },
    backButton: {
        marginLeft: -10,
        marginBottom: 15,
        width: 40,
        height: 40,
        justifyContent: 'center',
    },
    title: { fontSize: 24, fontWeight: "800", color: COLORS.text, marginBottom: 8 },
    subtitle: { fontSize: 16, color: COLORS.textLight },
    form: { gap: 16 },
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
        marginTop: 20,
    },
    disabledBtn: {
        backgroundColor: COLORS.inputBorder,
        opacity: 0.7,
    },
    primaryText: { color: COLORS.text, fontWeight: "700", fontSize: 16 },
    verifiedBadge: {
        backgroundColor: "#e8f5e9",
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    verifiedText: {
        color: "#2e7d32",
        fontSize: 12,
        fontWeight: "700",
    },
    verifyBtn: {
        backgroundColor: COLORS.saffron,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
    },
    verifyBtnText: {
        color: COLORS.text,
        fontSize: 14,
        fontWeight: "700",
    },
});
