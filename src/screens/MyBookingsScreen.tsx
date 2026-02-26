import { useNavigation } from "@react-navigation/native";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Header from "../components/Header";
import { useLanguage } from "../context/LanguageContext";
import { supabase } from "../lib/supabase";

type TabType = "current" | "completed";

export default function MyBookingsScreen() {
  const navigation = useNavigation<any>();
  const { t } = useLanguage();

  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("current");

  useEffect(() => {
    fetchMyBookings();
  }, []);

  const fetchMyBookings = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("bookings")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setBookings(data);
    }

    setLoading(false);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchMyBookings();
    setRefreshing(false);
  };

  /* ================= FILTERS ================= */

  const currentBookings = useMemo(
    () => bookings.filter((b) => b.work_status !== "COMPLETED"),
    [bookings],
  );

  const completedBookings = useMemo(
    () => bookings.filter((b) => b.work_status === "COMPLETED"),
    [bookings],
  );

  const visibleBookings =
    activeTab === "current" ? currentBookings : completedBookings;

  /* ================= LOADING ================= */

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  /* ================= UI ================= */

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>

      {/* ── APP HEADER (logo + icons) ── */}
      <Header />

      {/* ── FIXED TITLE + TABS ── */}
      <View style={styles.header}>
        <Text style={styles.title}>{t("bookings.title")}</Text>

        <View style={styles.tabs}>
          <Pressable
            style={[styles.tab, activeTab === "current" && styles.activeTab]}
            onPress={() => setActiveTab("current")}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === "current" && styles.activeTabText,
              ]}
            >
              {t("bookings.current")} ({currentBookings.length})
            </Text>
          </Pressable>

          <Pressable
            style={[styles.tab, activeTab === "completed" && styles.activeTab]}
            onPress={() => setActiveTab("completed")}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === "completed" && styles.activeTabText,
              ]}
            >
              {t("bookings.completed")} ({completedBookings.length})
            </Text>
          </Pressable>
        </View>
      </View>

      {/* ── SCROLLABLE LIST ── */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {visibleBookings.length === 0 ? (
          <Text style={styles.empty}>
            {activeTab === "current"
              ? t("bookings.noCurrent")
              : t("bookings.noCompleted")}
          </Text>
        ) : (
          visibleBookings.map((b) => (
            <View key={b.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.name}>{b.customer_name}</Text>

                <View
                  style={[
                    styles.statusBadge,
                    b.work_status === "COMPLETED"
                      ? styles.completed
                      : b.work_status === "CANCELLED"
                        ? styles.cancelled
                        : b.assigned_staff_email
                          ? styles.assigned
                          : styles.pending,
                  ]}
                >
                  <Text style={styles.statusText}>
                    {b.work_status === "COMPLETED"
                      ? t("bookings.status.completed")
                      : b.work_status === "CANCELLED"
                        ? t("bookings.status.cancelled")
                        : b.assigned_staff_email
                          ? t("bookings.status.assigned")
                          : t("bookings.status.pending")}
                  </Text>
                </View>
              </View>

              <Text style={styles.meta}>
                {b.booking_date} {t("bookings.at")} {b.booking_time}
              </Text>
              <Text style={styles.meta}>{t("bookings.total")}: ₹{b.total_amount}</Text>

              <Pressable
                style={styles.viewBtn}
                onPress={() =>
                  navigation.navigate("BookingDetails", { booking: b })
                }
              >
                <Text style={styles.viewText}>{t("bookings.view")}</Text>
              </Pressable>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/* ================= STYLES ================= */

const styles = StyleSheet.create({
  container: { padding: 20, paddingBottom: 40 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  /* FIXED HEADER */
  header: {
    backgroundColor: "#fff",
    paddingHorizontal: 20,
    paddingTop: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  title: { fontSize: 26, fontWeight: "800", marginBottom: 12 },

  /* TABS */
  tabs: {
    flexDirection: "row",
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  activeTab: {
    borderBottomColor: "#000",
  },
  tabText: {
    fontSize: 14,
    color: "#6b7280",
    fontWeight: "600",
    textAlign: "center",
  },
  activeTabText: {
    color: "#000",
  },

  /* CARD */
  card: {
    borderWidth: 1,
    borderColor: "#ddd",
    padding: 16,
    marginBottom: 16,
    borderRadius: 12,
    backgroundColor: "#fff",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  name: { fontWeight: "700", fontSize: 16 },
  meta: { marginTop: 6, color: "#374151" },

  /* STATUS */
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  pending: { backgroundColor: "#FEF3C7" },
  assigned: { backgroundColor: "#DBEAFE" },
  cancelled: { backgroundColor: "#FEE2E2" },
  completed: { backgroundColor: "#DCFCE7" },
  statusText: { fontSize: 12, fontWeight: "700" },

  /* VIEW BTN */
  viewBtn: {
    marginTop: 14,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#fbbf24",
    alignItems: "center",
  },
  viewText: { color: "#000", fontWeight: "700", fontSize: 15 },

  empty: {
    textAlign: "center",
    marginTop: 40,
    color: "#6b7280",
    fontSize: 15,
  },
});
