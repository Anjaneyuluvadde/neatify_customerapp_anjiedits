import { useNavigation } from "@react-navigation/native";
import { Edit2, Phone, Save, X } from "lucide-react-native";
import React, { memo, useEffect, useState } from "react";


import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// import LanguageSelector from "../components/LanguageSelector"; // REMOVED
import { useLanguage } from "../context/LanguageContext";
import { useNotification } from "../hooks/useNotification";
import { supabase } from "../lib/supabase";
import { COLORS } from "../theme/colors";

/* ======================================================
   FIELD CARD (MOVED OUTSIDE – FIXES KEYBOARD ISSUE)
====================================================== */

type FieldCardProps = {
  label: string;
  value: string;
  isEditing: boolean;
  editable?: boolean;
  multiline?: boolean;
  keyboardType?: any;
  maxLength?: number;
  onChangeText?: (t: string) => void;
  placeholder?: string;
};

const FieldCard = memo(
  ({
    label,
    value,
    isEditing,
    editable,
    multiline,
    keyboardType,
    maxLength,
    onChangeText,
    placeholder,
    fallback,
  }: FieldCardProps & { fallback?: string }) => {
    return (
      <View style={styles.fieldCard}>
        <Text style={styles.label}>{label}</Text>

        {isEditing && editable ? (
          <TextInput
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor="#94a3b8"
            style={[
              styles.input,
              multiline ? styles.inputMultiline : null,
            ]}
            multiline={multiline}
            keyboardType={keyboardType}
            maxLength={maxLength}
            blurOnSubmit={false}
          />
        ) : (
          <Text style={styles.value}>
            {value?.trim() ? value : fallback || "--"}
          </Text>
        )}
      </View>
    );
  }
);

/* ======================================================
   PROFILE SCREEN
====================================================== */

export default function ProfileScreen() {
  const navigation = useNavigation<any>();
  const { showAlert, showToast } = useNotification();
  const { t } = useLanguage();

  const formatDisplayPhone = (phone: string | undefined | null) => {
    if (!phone) return "";
    // Remove all non-digits
    const digits = phone.replace(/\D/g, "");
    // If it starts with 91 and has 12 digits total, strip 91
    if (digits.length === 12 && digits.startsWith("91")) {
      return digits.slice(2);
    }
    // Return last 10 digits if possible, otherwise return cleaned string
    return digits.length > 10 ? digits.slice(-10) : digits;
  };

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    phone: "",
    address: "",
    pincode: "",
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  /* ================= FETCH PROFILE ================= */

  const fetchProfile = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      setUserId(user.id);

      const { data, error } = await supabase
        .from("profile")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (data) {
        setFormData({
          full_name: data.full_name || "",
          email: data.email || user.email || "",
          phone: data.phone || "",
          address: data.address || "",
          pincode: data.pincode || "",
        });
      } else {
        setFormData((p) => ({
          ...p,
          email: user.email || "",
        }));
      }
    } catch {
      showAlert({
        type: "error",
        title: t("common.error"),
        message: t("notifications.profileLoadError")
      });
    } finally {
      setLoading(false);
    }
  };

  /* ================= UPDATE PROFILE ================= */

  const handleUpdate = async () => {
    if (!userId) return;

    if (formData.pincode && formData.pincode.length !== 6) {
      showAlert({
        type: "warning",
        title: t("notifications.invalidPin"),
        message: t("notifications.pinCodeError")
      });
      return;
    }

    setSaving(true);

    try {
      const { error } = await supabase
        .from("profile")
        .update({
          full_name: formData.full_name.trim(),
          phone: formData.phone.trim(),
          address: formData.address.trim(),
          pincode: formData.pincode.trim(),
        })
        .eq("id", userId);

      if (error) throw error;

      showToast(t("notifications.profileUpdated"), "success");
      setIsEditing(false);
    } catch (err: any) {
      showAlert({
        type: "error",
        title: t("notifications.updateFailed"),
        message: err.message
      });
    } finally {
      setSaving(false);
    }
  };

  /* ================= CUSTOMER CARE ================= */

  const handleCallCustomerCare = () => {
    const phoneNumber = "tel:7617618567";
    Linking.canOpenURL(phoneNumber)
      .then((supported: boolean) => {
        if (supported) {
          Linking.openURL(phoneNumber);
        } else {
          showAlert({
            type: "error",
            title: t("common.error"),
            message: t("notifications.callError")
          });
        }
      })
      .catch(() => showAlert({
        type: "error",
        title: t("common.error"),
        message: t("notifications.dialerError")
      }));
  };

  /* ================= LOGOUT ================= */

  const handleLogout = async () => {
    showAlert({
      type: "warning",
      title: t("notifications.logoutTitle"),
      message: t("notifications.logoutMessage"),
      showCancel: true,
      confirmText: t("notifications.logoutConfirm"),
      onConfirm: async () => {
        await supabase.auth.signOut();
        navigation.reset({
          index: 0,
          routes: [{ name: "Login" }],
        });
      }
    });
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchProfile();
    setRefreshing(false);
  };

  /* ================= LOADING ================= */

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.saffron} />
      </View>
    );
  }

  /* ================= UI ================= */

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }} edges={["top"]}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {/* HEADER */}
          <View style={styles.headerCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{t("profile.title")}</Text>
              <Text style={styles.subtitle}>
                {t("profile.manageDetails")}
              </Text>
            </View>

            {!isEditing && (
              <TouchableOpacity
                style={styles.editBtn}
                onPress={() => setIsEditing(true)}
              >
                <Edit2 size={18} color="#2563eb" />
                <Text style={styles.editText}>{t("profile.edit")}</Text>
              </TouchableOpacity>
            )}
          </View>

          {!isEditing && (
            <TouchableOpacity
              style={[styles.primaryBtn, { marginBottom: 16, marginTop: 0 }]}
              onPress={() => navigation.navigate("MyBookings")}
            >
              <Text style={styles.primaryBtnText}>{t("profile.myBookings")}</Text>
            </TouchableOpacity>
          )}

          <FieldCard
            label={t("profile.fullName")}
            value={formData.full_name}
            isEditing={isEditing}
            editable
            onChangeText={(t) =>
              setFormData((p) => ({ ...p, full_name: t }))
            }
            placeholder={t("profile.fullNamePlaceholder")}
            fallback={t("profile.notProvided")}
          />

          <View style={styles.fieldCard}>
            <Text style={styles.label}>{t("profile.email")}</Text>
            <Text style={styles.valueMuted}>{formData.email}</Text>
            <Text style={styles.hintText}>{t("profile.emailHint")}</Text>
          </View>

          <FieldCard
            label={t("profile.phone")}
            value={formatDisplayPhone(formData.phone)}
            isEditing={isEditing}
            editable={false} // Make read-only
            keyboardType="phone-pad"
            onChangeText={(t) => { }} // No-op
            placeholder={t("profile.phonePlaceholder")}
            fallback={t("profile.notProvided")}
          />

          <FieldCard
            label={t("profile.address")}
            value={formData.address}
            isEditing={isEditing}
            editable
            multiline
            onChangeText={(t) =>
              setFormData((p) => ({ ...p, address: t }))
            }
            placeholder={t("profile.addressPlaceholder")}
            fallback={t("profile.noAddress")}
          />

          <FieldCard
            label={t("profile.pincode")}
            value={formData.pincode}
            isEditing={isEditing}
            editable
            keyboardType="numeric"
            maxLength={6}
            onChangeText={(t) =>
              setFormData((p) => ({ ...p, pincode: t }))
            }
            placeholder={t("profile.pincodePlaceholder")}
            fallback="--"
          />

          {/* Customer Care */}
          {!isEditing && (
            <TouchableOpacity
              style={styles.customerCareCard}
              onPress={handleCallCustomerCare}
              activeOpacity={0.7}
            >
              <View style={styles.customerCareContent}>
                <View style={styles.iconContainer}>
                  <Phone size={20} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.customerCareLabel}>{t("profile.customerCare")}</Text>
                  <Text style={styles.customerCareNumber}>7617618567</Text>
                </View>
              </View>
            </TouchableOpacity>
          )}

          {isEditing ? (
            <View style={styles.rowActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setIsEditing(false)}
              >
                <X size={18} color="#0f172a" />
                <Text style={styles.cancelText}>{t("profile.cancel")}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleUpdate}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <>
                    <Save size={18} color="#000" />
                    <Text style={styles.saveText}>{t("profile.save")}</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {/* Language Selector */}
              {/* Language Selector Removed */}
              {/* <View style={styles.fieldCard}>
              <Text style={styles.label}>{t("profile.language")}</Text>
              <View style={{ alignItems: 'flex-start', marginTop: 10 }}>
                <LanguageSelector />
              </View>
            </View> */}

              <TouchableOpacity
                style={styles.logoutBtn}
                onPress={handleLogout}
              >
                <Text style={styles.logoutText}>{t("profile.logout")}</Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/* ================= STYLES (UNCHANGED) ================= */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  scrollContent: { padding: 18, paddingBottom: 40 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  headerCard: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },

  title: { fontSize: 26, fontWeight: "800", color: "#0f172a" },
  subtitle: { marginTop: 4, fontSize: 13, color: "#64748b" },

  editBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
  },

  editText: { color: "#2563eb", fontWeight: "700" },

  fieldCard: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },

  label: {
    fontSize: 12,
    fontWeight: "800",
    color: "#64748b",
    letterSpacing: 1,
  },

  value: {
    marginTop: 10,
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
  },

  valueMuted: {
    marginTop: 10,
    fontSize: 16,
    fontWeight: "700",
    color: "#94a3b8",
  },

  hintText: { marginTop: 8, fontSize: 12, color: "#94a3b8" },

  input: {
    marginTop: 10,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#0f172a",
    fontWeight: "600",
  },

  inputMultiline: { height: 90, textAlignVertical: "top" },

  rowActions: { flexDirection: "row", gap: 12, marginTop: 6 },

  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  cancelText: { color: "#0f172a", fontWeight: "800", fontSize: 15 },

  saveBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: COLORS.saffron ?? "#F4C430",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  saveText: { color: "#000", fontWeight: "900", fontSize: 15 },

  primaryBtn: {
    marginTop: 8,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: COLORS.saffron ?? "#F4C430",
    alignItems: "center",
    justifyContent: "center",
  },

  primaryBtnText: { color: "#000", fontSize: 16, fontWeight: "900" },

  logoutBtn: {
    marginTop: 12,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: "#0f172a",
    alignItems: "center",
    justifyContent: "center",
  },

  logoutText: { color: "#fff", fontSize: 16, fontWeight: "900" },

  customerCareCard: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },

  customerCareContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },

  iconContainer: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: COLORS.saffron ?? "#F4C430",
    alignItems: "center",
    justifyContent: "center",
  },

  customerCareLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: "#64748b",
    letterSpacing: 1,
    marginBottom: 6,
  },

  customerCareNumber: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
  },
});
