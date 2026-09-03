import { useNavigation, useRoute } from "@react-navigation/native";
import { ChevronLeft, Eye, EyeOff, Gift, Lock, Mail, Phone, User } from "lucide-react-native";
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
import { useTheme } from "../context/ThemeContext";
import { useNotification } from "../hooks/useNotification";
import { supabase } from "../lib/supabase";
import { COLORS } from "../theme/colors";
import { generateReferralCode, validateReferralCode } from "../utils/referralUtils";
import { isTempEmail } from "../utils/authUtils";

export default function CompleteProfileScreen() {
    const navigation = useNavigation<any>();
    const route = useRoute<any>();
    const { initialData } = route.params || {};
    const { showAlert, showToast } = useNotification();
    const { theme, isDark } = useTheme();

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
    const [referralCode, setReferralCode] = useState("");

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Auth state flags
    const [needsEmail, setNeedsEmail] = useState(true);
    const [needsPassword, setNeedsPassword] = useState(false);

    useEffect(() => {
        loadCurrentData();
    }, []);

    const loadCurrentData = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const user = session?.user;

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
                const digits = raw.replace(/\D/g, "");
                return digits.slice(-10);
            };

            // Pre-fill from Auth
            setFullName(user.user_metadata?.full_name || "");
            
            const authEmail = user.email || "";
            if (isTempEmail(authEmail)) {
                setEmail("");
                setNeedsEmail(true);
            } else {
                setEmail(authEmail);
                setNeedsEmail(!authEmail);
            }
            
            let extractedPhone = cleanPhone(user.user_metadata?.phone_number) || cleanPhone(user.user_metadata?.phone) || cleanPhone(user.phone);
            
            if (!extractedPhone && isTempEmail(authEmail)) {
                extractedPhone = cleanPhone(authEmail.split("@")[0]);
            }
            
            setPhone(extractedPhone);

            // Pre-fill from Profile table
            const { data: profile } = await supabase
                .from("profile")
                .select("*")
                .eq("id", user.id)
                .maybeSingle();

            if (profile) {
                if (profile.full_name) setFullName(profile.full_name);
                if (profile.email && !isTempEmail(profile.email)) setEmail(profile.email);
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

    const handleSubmit = async () => {
        setSaving(true);
        
        try {
            // Existing user: Update
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("No authenticated user found.");
            
            // Re-verify the phone number straight from auth to avoid React state race condition
            const cleanPhoneHelper = (raw?: string | null) => {
                if (!raw) return "";
                return raw.replace(/\D/g, "").slice(-10);
            };

            let verifiedPhone = cleanPhoneHelper(user.user_metadata?.phone_number) || cleanPhoneHelper(user.user_metadata?.phone) || cleanPhoneHelper(user.phone);
            const authEmail = user.email || "";
            if (!verifiedPhone && isTempEmail(authEmail)) {
                verifiedPhone = cleanPhoneHelper(authEmail.split("@")[0]);
            }
            if (!verifiedPhone) {
                verifiedPhone = cleanPhoneHelper(phone);
            }

            let finalEmailToSave = email.trim();

            // If the user left it blank, but they have a temp email, preserve it
            if (!finalEmailToSave && isTempEmail(authEmail)) {
                finalEmailToSave = authEmail;
            }

            // Perform validations using the accurately computed local variables
            if (!fullName.trim()) {
                showAlert({ type: "warning", title: "Missing Information", message: "Please enter your full name." });
                setSaving(false);
                return;
            }

            if (!finalEmailToSave || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(finalEmailToSave)) {
                showAlert({ type: "warning", title: "Invalid Email", message: "Please enter a valid email address." });
                setSaving(false);
                return;
            }

            if (!verifiedPhone || verifiedPhone.length < 10) {
                showAlert({ type: "warning", title: "Invalid Phone", message: "Please enter a valid 10-digit phone number." });
                setSaving(false);
                return;
            }

            if (needsPassword) {
                if (!password || password.length < 6) {
                    showAlert({ type: "warning", title: "Weak Password", message: "Password must be at least 6 characters long." });
                    setSaving(false);
                    return;
                }

                if (password !== confirmPassword) {
                    showAlert({ type: "warning", title: "Password Mismatch", message: "Passwords do not match." });
                    setSaving(false);
                    return;
                }
            }

            const formattedPhone = `+91${verifiedPhone}`;
            let currentUser = user;

            const updatePayload: any = {
                data: {
                    full_name: fullName.trim(),
                    phone_number: formattedPhone
                }
            };

            // Only update email in auth if it is different from the current auth email
            if (finalEmailToSave !== authEmail) {
                updatePayload.email = finalEmailToSave;
            }

            if (needsPassword && password) {
                updatePayload.password = password;
            }

            const { error: updateError } = await supabase.auth.updateUser(
                updatePayload
            );
            if (updateError) throw updateError;

            // Handle Referral Logic
            let referrerId = null;
            if (referralCode.trim()) {
                referrerId = await validateReferralCode(referralCode.trim());
                if (!referrerId) {
                    showAlert({ type: "warning", title: "Invalid Referral", message: "The referral code you entered is invalid. You can continue without it." });
                    setSaving(false);
                    return;
                }
            }

            const myReferralCode = generateReferralCode(fullName.trim());

            // Sync with local tables
            const { error: profileError } = await supabase
                .from("profile")
                .upsert({
                    id: currentUser.id,
                    full_name: fullName.trim(),
                    email: finalEmailToSave,
                    phone: verifiedPhone,
                    referral_code: myReferralCode,
                    referred_by_id: referrerId,
                });

            if (profileError) {
                console.error("PROFILE SAVE FAILED", {
                    code: profileError.code,
                    message: profileError.message,
                    details: profileError.details,
                    hint: profileError.hint,
                });
                throw profileError;
            }

            // Initialize Wallet
            await supabase.from("wallet").upsert({
                user_id: currentUser?.id,
                balance: 0
            });

            // If referred, create the tracking record AND the ₹50 coupon
            if (referrerId) {
                // 1. Referral tracking
                await supabase.from("referrals").insert({
                    referrer_id: referrerId,
                    referred_user_id: currentUser?.id,
                    status: 'pending'
                });

                // 2. Create the ₹50 Welcome Coupon for the new user
                const welcomeCouponCode = `WELCOME50_${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
                await supabase.from("coupons").insert({
                    coupon_code: welcomeCouponCode,
                    discount_amount: 50,
                    is_used: false,
                    phone_number: verifiedPhone // Link to user's phone
                });
                
                // Store in user metadata so Home Screen knows to show the popup
                await supabase.auth.updateUser({
                    data: { 
                        show_welcome_reward: true,
                        welcome_coupon_code: welcomeCouponCode
                    }
                });
            }

            // Verify that the profile row was actually saved with correct data
            const { data: verifyData, error: verifyError } = await supabase
                .from("profile")
                .select("id,full_name,email,phone")
                .eq("id", currentUser.id)
                .maybeSingle();
                
            if (verifyError || !verifyData) {
                console.error("VERIFICATION FAILED: Row not found or error", verifyError);
                throw new Error("Profile was not saved correctly to the database. Row not found.");
            } else {
                let diffs = [];
                if (verifyData.id !== currentUser.id) diffs.push(`ID mismatch: expected ${currentUser.id}, got ${verifyData.id}`);
                if (verifyData.full_name !== fullName.trim()) diffs.push(`Name mismatch: expected ${fullName.trim()}, got ${verifyData.full_name}`);
                if (verifyData.email !== finalEmailToSave) diffs.push(`Email mismatch: expected ${finalEmailToSave}, got ${verifyData.email}`);
                if (verifyData.phone !== verifiedPhone) diffs.push(`Phone mismatch: expected ${verifiedPhone}, got ${verifyData.phone}`);

                if (diffs.length > 0) {
                    throw new Error(`Profile save conflict detected by DB verification:\n${diffs.join("\n")}`);
                }
            }

            // Everything done — go to Home
            showToast("Profile updated!", "success");
            navigation.reset({
                index: 0,
                routes: [{ name: "HomeDrawer" }],
            });

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



    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
            <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={theme.background} />

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
                            <ChevronLeft size={28} color={theme.text} />
                        </TouchableOpacity>
                        <Text style={[styles.title, { color: theme.text }]}>Complete Your Profile</Text>
                        <Text style={[styles.subtitle, { color: theme.textLight }]}>
                            Just a few details to get you started.
                        </Text>
                    </View>

                    <View style={styles.form}>
                        {/* FULL NAME */}
                        <View style={[styles.inputContainer, { backgroundColor: theme.background, borderColor: theme.border }]}>
                            <User size={20} color={theme.textLight} />
                            <TextInput
                                style={[styles.input, { color: theme.text }]}
                                placeholder="Full Name"
                                placeholderTextColor={theme.textLight}
                                value={fullName}
                                onChangeText={setFullName}
                            />
                        </View>


                        {/* PHONE NUMBER - Simple input, no OTP verification */}
                        <View style={[styles.inputContainer, { backgroundColor: theme.background, borderColor: theme.border }]}>
                            <Phone size={20} color={theme.textLight} />
                            <Text style={{ marginLeft: 10, fontSize: 16, color: theme.text, fontWeight: '600' }}>+91</Text>
                            <TextInput
                                style={[styles.input, { color: theme.textLight }]}
                                placeholder="Phone Number"
                                placeholderTextColor={theme.textLight}
                                value={phone}
                                editable={false}
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

                        {/* PASSWORD (Only if needed — e.g. Google users) */}
                        {needsPassword && (
                            <>
                                <View style={[styles.inputContainer, { backgroundColor: theme.background, borderColor: theme.border }]}>
                                    <Lock size={20} color={theme.textLight} />
                                    <TextInput
                                        style={[styles.input, { color: theme.text }]}
                                        placeholder="Create Password"
                                        placeholderTextColor={theme.textLight}
                                        secureTextEntry={!showPassword}
                                        value={password}
                                        onChangeText={setPassword}
                                    />
                                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                                        {showPassword ? <EyeOff size={20} color={theme.textLight} /> : <Eye size={20} color={theme.textLight} />}
                                    </TouchableOpacity>
                                </View>

                                <View style={[styles.inputContainer, { backgroundColor: theme.background, borderColor: theme.border }]}>
                                    <Lock size={20} color={theme.textLight} />
                                    <TextInput
                                        style={[styles.input, { color: theme.text }]}
                                        placeholder="Confirm Password"
                                        placeholderTextColor={theme.textLight}
                                        secureTextEntry={!showConfirmPassword}
                                        value={confirmPassword}
                                        onChangeText={setConfirmPassword}
                                    />
                                    <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                                        {showConfirmPassword ? <EyeOff size={20} color={theme.textLight} /> : <Eye size={20} color={theme.textLight} />}
                                    </TouchableOpacity>
                                </View>
                            </>
                        )}

                        {/* REFERRAL CODE (Optional) */}
                        <View style={[styles.inputContainer, { backgroundColor: theme.background, borderColor: theme.border }]}>
                            <Gift size={20} color={theme.textLight} />
                            <TextInput
                                style={[styles.input, { color: theme.text }]}
                                placeholder="Referral Code (Optional)"
                                placeholderTextColor={theme.textLight}
                                value={referralCode}
                                onChangeText={setReferralCode}
                                autoCapitalize="characters"
                            />
                        </View>

                        <TouchableOpacity
                            style={[styles.primaryBtn, { backgroundColor: theme.primary }, saving && styles.disabledBtn]}
                            onPress={handleSubmit}
                            disabled={saving}
                        >
                            {saving ? (
                                <ActivityIndicator color={theme.background} />
                            ) : (
                                <Text style={[styles.primaryText, { color: theme.background }]}>
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
});
