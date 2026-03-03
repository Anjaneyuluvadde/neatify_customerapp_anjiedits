import { useNavigation, useRoute } from "@react-navigation/native";
import { Lock, Mail } from "lucide-react-native";
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
import { useNotification } from "../hooks/useNotification";
import { supabase } from "../lib/supabase";
import { COLORS } from "../theme/colors";

export default function ResetPasswordScreen() {
    const navigation = useNavigation<any>();
    const route = useRoute<any>();

    // If accessToken is passed via deep link, we're in "set new password" mode
    const accessToken = route.params?.access_token;
    const refreshToken = route.params?.refresh_token;
    const isSettingPassword = !!(accessToken && refreshToken);

    const { showAlert, showToast } = useNotification();

    const [email, setEmail] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [loading, setLoading] = useState(false);

    // ── STEP 1: Send reset email ──────────────────────────────────────────────
    const handleSendResetEmail = async () => {
        if (!email.trim()) {
            showAlert({ type: "warning", title: "Email Required", message: "Please enter your email." });
            return;
        }
        setLoading(true);
        try {
            const redirectTo = "theneatifyteam://reset-password";
            const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
            if (error) throw error;
            showAlert({ type: "success", title: "Reset Link Sent 📧", message: "Check your inbox for the reset link!" });
        } catch (err: any) {
            showAlert({ type: "error", title: "Error", message: err.message });
        } finally {
            setLoading(false);
        }
    };

    // ── STEP 2: Update to new password ───────────────────────────────────────
    const handleUpdatePassword = async () => {
        if (!newPassword || newPassword.length < 6) {
            showAlert({ type: "warning", title: "Weak Password", message: "Password must be at least 6 characters." });
            return;
        }
        if (newPassword !== confirmPassword) {
            showAlert({ type: "error", title: "Mismatch", message: "Passwords do not match." });
            return;
        }
        setLoading(true);
        try {
            // Set session first using tokens from the deep link
            const { error: sessionError } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
            if (sessionError) throw sessionError;

            const { error } = await supabase.auth.updateUser({ password: newPassword });
            if (error) throw error;

            // Success — sign out first so user logs in fresh with new password
            await supabase.auth.signOut();
            showAlert({
                type: "success",
                title: "Password Updated 🎉",
                message: "Your password has been updated. Please login with your new password.",
                onConfirm: () => {
                    navigation.reset({ index: 0, routes: [{ name: "Login" }] });
                }
            });
        } catch (err: any) {
            showAlert({ type: "error", title: "Error", message: err.message });
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
            <StatusBar barStyle="dark-content" backgroundColor="#fff" />
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">

                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
                        <Text style={styles.backText}>← Back to Login</Text>
                    </TouchableOpacity>

                    <Text style={styles.title}>
                        {isSettingPassword ? "Set New Password" : "Forgot Password?"}
                    </Text>
                    <Text style={styles.subtitle}>
                        {isSettingPassword
                            ? "Enter and confirm your new password."
                            : "Enter your email and we'll send you a reset link."}
                    </Text>

                    {isSettingPassword ? (
                        /* ── SET NEW PASSWORD ─────────────── */
                        <>
                            <View style={styles.inputContainer}>
                                <Lock size={20} color={COLORS.textLight} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="New Password"
                                    placeholderTextColor={COLORS.placeholder}
                                    secureTextEntry
                                    value={newPassword}
                                    onChangeText={setNewPassword}
                                />
                            </View>
                            <View style={styles.inputContainer}>
                                <Lock size={20} color={COLORS.textLight} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="Confirm New Password"
                                    placeholderTextColor={COLORS.placeholder}
                                    secureTextEntry
                                    value={confirmPassword}
                                    onChangeText={setConfirmPassword}
                                />
                            </View>
                            <TouchableOpacity style={styles.btn} onPress={handleUpdatePassword} disabled={loading}>
                                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Update Password</Text>}
                            </TouchableOpacity>
                        </>
                    ) : (
                        /* ── SEND RESET EMAIL ─────────────── */
                        <>
                            <View style={styles.inputContainer}>
                                <Mail size={20} color={COLORS.textLight} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="Your email address"
                                    placeholderTextColor={COLORS.placeholder}
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                    value={email}
                                    onChangeText={setEmail}
                                />
                            </View>
                            <TouchableOpacity style={styles.btn} onPress={handleSendResetEmail} disabled={loading}>
                                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Send Reset Link</Text>}
                            </TouchableOpacity>
                        </>
                    )}

                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flexGrow: 1, padding: 25, paddingTop: 20 },
    back: { marginBottom: 30 },
    backText: { color: COLORS.saffron, fontWeight: "700", fontSize: 15 },
    title: { fontSize: 28, fontWeight: "800", color: COLORS.text, marginBottom: 8 },
    subtitle: { color: COLORS.textLight, fontSize: 15, marginBottom: 30, lineHeight: 22 },
    inputContainer: {
        flexDirection: "row",
        alignItems: "center",
        borderWidth: 1.5,
        borderColor: COLORS.inputBorder,
        backgroundColor: COLORS.white,
        borderRadius: 12,
        paddingVertical: 12,
        paddingHorizontal: 14,
        marginBottom: 14,
    },
    input: { flex: 1, fontSize: 16, marginLeft: 10, color: COLORS.text },
    btn: {
        backgroundColor: COLORS.saffron,
        height: 56,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
        marginTop: 6,
    },
    btnText: { color: COLORS.text, fontWeight: "700", fontSize: 16 },
});
