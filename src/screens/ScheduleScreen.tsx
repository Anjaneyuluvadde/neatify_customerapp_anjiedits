import { Picker } from "@react-native-picker/picker";
import { RouteProp, useNavigation } from "@react-navigation/native";
import { Image } from "expo-image";
import React, { useEffect, useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import Header from "../components/Header";
import { useLanguage } from "../context/LanguageContext";
import { useNotification } from "../hooks/useNotification";
import { supabase } from "../lib/supabase";
import {
  RootStackParamList,
  SelectedService,
} from "../navigation/AppNavigator";
import { COLORS } from "../theme/colors";
import { Service } from "../types/service";

/* ================= ROUTE ================= */

type Props = {
  route: RouteProp<RootStackParamList, "Schedule">;
};

/* ================= ADD-ON TYPE ================= */

type AddOn = {
  id: string;
  title: string;
  duration: number;
  price: string; // text with ₹ symbol from db
  image?: string | null;
  service_type?: string;
  description?: string;
  sort_order?: number;
  original_price?: string | null; // text with ₹ symbol from db
  discount_percent?: number | null;
  work_includes?: string | null; // text (was text[], now text)
  work_not_included?: string | null; // text in db
  discount_label?: string | null;
  tax_percent?: number | null;
  max_quantity?: number | null; // max times this addon can be added (from db)
};

/**
 * Parse text that may be in PostgreSQL array format {"item1","item2"} or newline-separated text.
 */
const parseTextList = (text: string): string[] => {
  const trimmed = text.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return trimmed
      .slice(1, -1)
      .split(/",\s*"/)
      .map((s) => s.replace(/^"|"$/g, '').trim())
      .filter(Boolean);
  }
  return trimmed
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
};

/* ================= CONSTANTS ================= */

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const FULL_DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const YEARS = [2026, 2027, 2028];

const TIMES = [
  "9:00 am",
  "9:30 am",
  "10:00 am",
  "10:30 am",
  "11:00 am",
  "11:30 am",
  "12:00 pm",
  "1:00 pm",
  "1:30 pm",
  "2:00 pm",
  "2:30 pm",
  "3:00 pm",
  "3:30 pm",
  "4:00 pm",
  "4:30 pm",
];

const today = new Date();

/* ================= HELPERS ================= */

const isPastDate = (year: number, month: number, day: number) => {
  const d = new Date(year, month, day);
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return d < t;
};

const getCalendarMatrix = (year: number, month: number) => {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const matrix: (number | null)[][] = Array.from({ length: 7 }, () => []);

  for (let i = 0; i < firstDay; i++) matrix[i].push(null);

  for (let day = 1; day <= daysInMonth; day++) {
    const weekday = (firstDay + day - 1) % 7;
    matrix[weekday].push(day);
  }

  const maxRows = Math.max(...matrix.map((c) => c.length));
  matrix.forEach((c) => {
    while (c.length < maxRows) c.push(null);
  });

  return matrix;
};

const isTimeSlotValid = (
  year: number,
  month: number,
  day: number | null,
  timeString: string
) => {
  if (day === null) return false;

  const [time, modifier] = timeString.split(" ");
  let [hours, minutes] = time.split(":").map(Number);

  if (modifier === "pm" && hours < 12) hours += 12;
  if (modifier === "am" && hours === 12) hours = 0;

  const slotDate = new Date(year, month, day, hours, minutes);
  const now = new Date();
  const cutoff = new Date(now.getTime() + 90 * 60000); // Now + 1 hour 30 mins

  return slotDate > cutoff;
};

/* ================= COMPONENT ================= */

type ScheduleScreenProps = {
  route: RouteProp<RootStackParamList, "Schedule">;
};

export default function ScheduleScreen({ route }: ScheduleScreenProps) {
  const navigation = useNavigation<any>();
  const { showAlert } = useNotification();
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();

  const services = route.params?.services || [];

  const [selectedServices, setSelectedServices] =
    useState<SelectedService[]>(services);

  const [editServices, setEditServices] =
    useState<SelectedService[]>(services);

  const [allServices, setAllServices] = useState<Service[]>([]);

  const [selectedDate, setSelectedDate] = useState<number | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  const [month, setMonth] = useState(today.getMonth());
  const [year, setYear] = useState(today.getFullYear());

  const [showSummary, setShowSummary] = useState(false);
  const [showAddService, setShowAddService] = useState(false);

  // Addons-related state
  const [showAddonsModal, setShowAddonsModal] = useState(false);
  const [selectedAddonDetail, setSelectedAddonDetail] = useState<AddOn | null>(null);
  const [addons, setAddons] = useState<AddOn[]>([]);

  const calendar = useMemo(() => getCalendarMatrix(year, month), [year, month]);

  const selectedDayName =
    selectedDate !== null
      ? FULL_DAYS[new Date(year, month, selectedDate).getDay()]
      : "";

  /* ================= FETCH SERVICES & ADDONS ================= */

  useEffect(() => {
    // Fetch services
    supabase
      .from("services")
      .select("*")
      .then(({ data }) => {
        if (data) setAllServices(data);
      });

    // Fetch addons
    supabase
      .from("add_ons")
      .select("*")
      .order("sort_order", { ascending: true })
      .then(({ data, error }) => {
        if (error) console.error("Error fetching addons:", error);
        if (data) setAddons(data as AddOn[]);
      });
  }, []);

  /* ================= HELPERS ================= */

  const addAddonToCart = (addon: AddOn) => {
    // Check if already added
    const existingAddon = editServices.find((s) => s.id === addon.id);

    if (existingAddon) {
      // If already added, increment quantity (up to max_quantity)
      const maxQty = addons.find((a) => a.id === addon.id)?.max_quantity || 3;
      if ((existingAddon.quantity || 1) >= maxQty) {
        return;
      }

      setEditServices((prev) =>
        prev.map((s) =>
          s.id === addon.id
            ? { ...s, quantity: (s.quantity || 1) + 1 }
            : s
        )
      );
    } else {
      // Add new addon with quantity 1
      const newService: SelectedService = {
        id: addon.id,
        title: addon.title,
        duration: `${addon.duration} mins`,
        price: addon.price,
        original_price: addon.original_price,
        discount_percent: addon.discount_percent,
        discount_label: (addon as any)?.discount_label ?? null,
        tax_percent: (addon as any)?.tax_percent ?? null,
        image: addon.image ?? undefined,
        quantity: 1,
      };

      setEditServices((prev) => [...prev, newService]);
    }
  };

  const decrementAddon = (addonId: string) => {
    const existingAddon = editServices.find((s) => s.id === addonId);
    if (!existingAddon) return;

    if ((existingAddon.quantity || 1) <= 1) {
      // Remove the addon if quantity would go to 0
      setEditServices((prev) => prev.filter((s) => s.id !== addonId));
    } else {
      // Decrement quantity
      setEditServices((prev) =>
        prev.map((s) =>
          s.id === addonId
            ? { ...s, quantity: (s.quantity || 1) - 1 }
            : s
        )
      );
    }
  };

  /* ================= UI ================= */

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }} edges={["top"]}>
      <Header />
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.pageTitle}>{t("schedule.title")}</Text>

        {/* MONTH / YEAR */}
        <View style={styles.dropdownRow}>
          <Picker selectedValue={month} onValueChange={setMonth} style={styles.picker} dropdownIconColor="#000">
            {MONTHS.map((m, i) => (
              <Picker.Item key={m} label={m} value={i} color="#000" />
            ))}
          </Picker>

          <Picker selectedValue={year} onValueChange={setYear} style={styles.picker} dropdownIconColor="#000">
            {YEARS.map((y) => (
              <Picker.Item key={y} label={String(y)} value={y} color="#000" />
            ))}
          </Picker>
        </View>

        {/* CALENDAR */}
        <View style={styles.calendar}>
          <View style={{ flexDirection: "row" }}>
            {DAYS.map((d, i) => (
              <View key={d} style={styles.dayCol}>
                <Text style={styles.dayLabel}>{d}</Text>

                {calendar[i].map((date: number | null, idx: number) => {
                  if (!date) return <View key={`empty-${idx}`} style={styles.emptyDate} />;

                  const disabled = isPastDate(year, month, date);
                  const selected = selectedDate === date;

                  return (
                    <Pressable
                      key={date}
                      disabled={disabled}
                      onPress={() => setSelectedDate(date)}
                      style={[
                        styles.dateBox,
                        selected && styles.selectedDate,
                        disabled && styles.disabledDate,
                      ]}
                    >
                      <Text
                        style={[
                          selected && styles.selectedText,
                          disabled && styles.disabledText,
                        ]}
                      >
                        {date}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>
        </View>

        {/* TIME */}
        {selectedDate && (
          <>
            <Text style={styles.section}>{t("schedule.selectTime")}</Text>

            <View style={styles.timeGrid}>
              {TIMES.map((time) => {
                const valid = isTimeSlotValid(year, month, selectedDate, time);
                return (
                  <Pressable
                    key={time}
                    disabled={!valid}
                    onPress={() => setSelectedTime(time)}
                    style={[
                      styles.timeBox,
                      !valid && { backgroundColor: "#f0f0f0", borderColor: "#ddd" },
                      selectedTime === time && styles.selectedTime,
                    ]}
                  >
                    <Text
                      style={[
                        styles.timeText,
                        !valid && { color: "#ccc" },
                        selectedTime === time && styles.selectedText,
                      ]}
                    >
                      {time}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}

        {/* SERVICE DETAILS */}
        <View style={styles.headerRow}>
          <Text style={styles.section}>{t("schedule.serviceDetails")}</Text>
          <Pressable onPress={() => setShowSummary(true)}>
            <Text style={styles.edit}>{t("schedule.edit")}</Text>
          </Pressable>
        </View>

        {selectedServices.map((s: SelectedService) => (
          <View key={s.id} style={styles.serviceCard}>
            <Text style={styles.bold}>
              {s.title}
              {s.quantity && s.quantity > 1 ? ` (x${s.quantity})` : ""}
            </Text>

            {/* ✅ Pricing Display - Calculate total based on quantity */}
            <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
              <Text style={{ fontSize: 15, fontWeight: "600" }}>
                ₹{(parseFloat(s.price.replace(/[^\d]/g, "")) * (s.quantity || 1)).toLocaleString("en-IN")}
              </Text>

              {(s.discount_label || (s.discount_percent && Number(s.discount_percent) > 0)) ? (
                <View style={{ backgroundColor: "#E9F7EF", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 }}>
                  <Text style={{ color: "#1E7E34", fontWeight: "700", fontSize: 10 }}>
                    {s.discount_label || `${s.discount_percent}% off`}
                  </Text>
                </View>
              ) : null}
            </View>

            <Text style={styles.meta}>
              {selectedDate && selectedTime
                ? `${selectedDayName}, ${selectedDate} ${MONTHS[month]} ${year} at ${selectedTime}`
                : ""}
            </Text>
            <Text style={styles.meta}>{s.duration}</Text>
          </View>
        ))}

        {/* PROCEED */}
        <Pressable
          disabled={
            !selectedDate ||
            !selectedTime ||
            selectedServices.length === 0
          }
          style={[
            styles.primaryBtn,
            (!selectedDate ||
              !selectedTime ||
              selectedServices.length === 0) &&
            styles.disabledBtn,
          ]}
          // onPress={() =>
          //   navigation.navigate("Checkout", {
          //     services: selectedServices,
          //     date: selectedDate!,
          //     month,
          //     year,
          //     time: selectedTime!,
          //   })
          // }
          onPress={() => {
            const bookingDateText = `${selectedDayName}, ${selectedDate} ${MONTHS[month]} ${year} at ${selectedTime}`;

            navigation.navigate("Checkout", {
              services: selectedServices,
              bookingDateText,
            });
          }}

        >
          <Text style={styles.primaryText}>{t("schedule.proceed")}</Text>
        </Pressable>

        {/* ================= APPOINTMENT SUMMARY MODAL ================= */}
        <Modal visible={showSummary} transparent animationType="fade" statusBarTranslucent={true}>
          <Pressable
            style={{
              flex: 1,
              backgroundColor: "rgba(0,0,0,0.55)",
              justifyContent: "center",
            }}
            onPress={() => setShowSummary(false)}
          >
            <Pressable
              style={{
                backgroundColor: "#fff",
                margin: 20,
                borderRadius: 14,
                padding: 20,
                maxHeight: "80%",
              }}
              onPress={(e) => e.stopPropagation()}
            >
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <Text style={{ fontSize: 18, fontWeight: "800" }}>
                  Appointment Summary
                </Text>
                <Pressable onPress={() => setShowSummary(false)}>
                  <Text style={{ fontSize: 18 }}>✕</Text>
                </Pressable>
              </View>

              <ScrollView style={{ maxHeight: 300, marginTop: 14 }}>
                {editServices.map((s, index) => (
                  <View
                    key={s.id}
                    style={{
                      paddingVertical: 10,
                      borderBottomWidth: 0.5,
                      borderBottomColor: "#ddd",
                    }}
                  >
                    <Text style={{ fontWeight: "800", fontSize: 16 }}>
                      {s.title}
                      {s.quantity && s.quantity > 1 ? ` (x${s.quantity})` : ""}
                    </Text>
                    <Text style={{ marginTop: 4, color: "#6B7280" }}>
                      {s.duration}
                    </Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 }}>
                      <Text style={{ fontSize: 16, fontWeight: "800", color: "#000" }}>
                        ₹{(parseFloat(s.price.replace(/[^\d]/g, "")) * (s.quantity || 1)).toLocaleString("en-IN")}
                      </Text>
                      {/* ✅ Discount Badge */}
                      {(s.discount_label || (s.discount_percent && Number(s.discount_percent) > 0)) ? (
                        <View style={{ backgroundColor: "#E9F7EF", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 }}>
                          <Text style={{ color: "#1E7E34", fontWeight: "700", fontSize: 10 }}>
                            {s.discount_label || `${s.discount_percent}% off`}
                          </Text>
                        </View>
                      ) : null}
                    </View>

                    {/* Only show Remove for addons (not the first/main service) */}
                    {index !== 0 && (
                      <Pressable
                        onPress={() =>
                          setEditServices((prev) =>
                            prev.filter((x) => x.id !== s.id)
                          )
                        }
                      >
                        <Text style={{ marginTop: 8, color: "red", fontSize: 12 }}>
                          Remove
                        </Text>
                      </Pressable>
                    )}
                  </View>
                ))}
              </ScrollView>

              <Pressable
                onPress={() => {
                  setShowSummary(false);
                  setShowAddonsModal(true);
                }}
                style={{
                  borderWidth: 1,
                  borderColor: "#000",
                  paddingVertical: 12,
                  alignItems: "center",
                  marginTop: 16,
                  borderRadius: 10,
                }}
              >
                <Text style={{ fontWeight: "800" }}>+ Addons</Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  if (editServices.length === 0) {
                    showAlert({
                      type: "info",
                      title: t("notifications.addServiceTitle"),
                      message: t("notifications.addServiceMessage")
                    });
                    return;
                  }
                  setSelectedServices(editServices);
                  setShowSummary(false);
                }}
                style={{
                  backgroundColor: "#F4C430",
                  paddingVertical: 14,
                  alignItems: "center",
                  marginTop: 16,
                  borderRadius: 10,
                }}
              >
                <Text style={{ color: "#000", fontWeight: "800" }}>
                  {t("schedule.update")}
                </Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>

        {/* ================= ADD SERVICE MODAL ================= */}
        <Modal visible={showAddService} animationType="slide" statusBarTranslucent={true}>
          <View style={{ flex: 1, padding: 20 }}>
            <View style={styles.addHeader}>
              <Text style={styles.addTitle}>{t("schedule.addService")}</Text>
              <Pressable onPress={() => setShowAddService(false)}>
                <Text style={styles.close}>✕</Text>
              </Pressable>
            </View>

            <ScrollView style={{ marginTop: 20 }}>
              {allServices.map((s) => {
                const exists = editServices.some((x) => x.id === s.id);

                return (
                  <View key={s.id} style={styles.addRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.bold}>{s.title}</Text>
                      <Text>{s.duration}</Text>
                      <Text>{s.price}</Text>
                    </View>

                    <Pressable
                      disabled={exists}
                      onPress={() => {
                        setEditServices((prev) => [
                          ...prev,
                          {
                            id: s.id,
                            title: s.title,
                            duration: s.duration,
                            price: s.price,
                            original_price: s.original_price,
                            discount_percent: s.discount_percent,
                            discount_label: (s as any)?.discount_label ?? null,
                            tax_percent: (s as any)?.tax_percent ?? null,
                          },
                        ]);
                        setShowAddService(false);
                        setShowSummary(true);
                      }}
                      style={[
                        styles.addBtn,
                        exists && { backgroundColor: "#ccc" },
                      ]}
                    >
                      <Text style={{ color: "#fff", fontSize: 22 }}>＋</Text>
                    </Pressable>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </Modal>

        {/* ================= ADDONS LIST MODAL ================= */}
        <Modal visible={showAddonsModal} transparent animationType="slide" statusBarTranslucent={true}>
          <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }} edges={["top", "bottom"]}>
            <View style={{ flex: 1 }}>
              {/* Header */}
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  paddingHorizontal: 20,
                  paddingBottom: 10,
                  borderBottomWidth: 1,
                  borderBottomColor: "#eee",
                }}
              >
                <Text style={{ fontSize: 20, fontWeight: "800" }}>{t("schedule.addons")}</Text>
                <Pressable
                  onPress={() => {
                    setShowAddonsModal(false);
                    setShowSummary(true);
                  }}
                >
                  <Text style={{ fontSize: 20, padding: 5 }}>✕</Text>
                </Pressable>
              </View>

              <ScrollView contentContainerStyle={{ padding: 16 }}>
                {addons.length === 0 ? (
                  <Text style={{ textAlign: "center", marginTop: 20, color: "#888" }}>
                    No extra add-ons available.
                  </Text>
                ) : (
                  addons.map((addon) => {
                    const isAdded = editServices.some(
                      (s) => s.id === addon.id
                    );

                    return (
                      <Pressable
                        key={addon.id}
                        onPress={() => setSelectedAddonDetail(addon)}
                        style={({ pressed }) => ({
                          flexDirection: "row",
                          backgroundColor: "#fff",
                          borderRadius: 12,
                          marginBottom: 16,
                          borderWidth: 1,
                          borderColor: "#eee",
                          overflow: "hidden",
                          opacity: pressed ? 0.7 : 1,
                          transform: [{ scale: pressed ? 0.98 : 1 }],
                        })}
                      >
                        {/* Left Side: Image */}
                        {addon.image && addon.image.trim() !== '' ? (
                          <Image
                            source={{ uri: addon.image }}
                            style={{ width: 100, height: 120 }}
                            resizeMode="cover"
                          />
                        ) : (
                          <View
                            style={{
                              width: 100,
                              height: 120,
                              backgroundColor: "#f0f0f0",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <Text style={{ color: "#ccc" }}>No Image</Text>
                          </View>
                        )}

                        {/* Right Side: Details */}
                        <View
                          style={{
                            flex: 1,
                            padding: 12,
                            justifyContent: "space-between",
                          }}
                        >
                          <View>
                            <Text style={{ fontSize: 16, fontWeight: "700" }}>
                              {addon.title}
                            </Text>
                            <Text
                              style={{
                                fontSize: 13,
                                color: "#666",
                                marginTop: 2,
                              }}
                            >
                              {addon.duration} mins
                            </Text>

                            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 }}>
                              <Text style={{ fontSize: 16, fontWeight: "800" }}>
                                {addon.price}
                              </Text>

                              {/* ✅ Discount Badge */}
                              {(addon.discount_label || (addon.discount_percent && Number(addon.discount_percent) > 0)) ? (
                                <View style={{ backgroundColor: "#E9F7EF", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 }}>
                                  <Text style={{ color: "#1E7E34", fontWeight: "700", fontSize: 10 }}>
                                    {addon.discount_label || `${addon.discount_percent}% off`}
                                  </Text>
                                </View>
                              ) : null}
                            </View>
                          </View>

                          {/* Action Buttons */}
                          <View
                            style={{
                              flexDirection: "row",
                              gap: 8,
                              marginTop: 8,
                            }}
                          >
                            <Pressable
                              onPress={(e) => {
                                e.stopPropagation();
                                setSelectedAddonDetail(addon);
                              }}
                              style={{
                                flex: 1,
                                borderWidth: 1,
                                borderColor: "#ddd",
                                paddingVertical: 6,
                                borderRadius: 6,
                                alignItems: "center",
                              }}
                            >
                              <Text style={{ fontSize: 13, fontWeight: "600" }}>
                                View
                              </Text>
                            </Pressable>

                            {isAdded ? (
                              <View
                                style={{
                                  flex: 1,
                                  flexDirection: "row",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                  backgroundColor: "#f0f0f0",
                                  borderRadius: 6,
                                  paddingHorizontal: 4,
                                }}
                              >
                                <Pressable
                                  onPress={(e) => {
                                    e.stopPropagation();
                                    decrementAddon(addon.id);
                                  }}
                                  style={{
                                    paddingHorizontal: 12,
                                    paddingVertical: 6,
                                  }}
                                >
                                  <Text style={{ fontSize: 18, fontWeight: "700", color: "#000" }}>
                                    -
                                  </Text>
                                </Pressable>

                                <Text style={{ fontSize: 14, fontWeight: "700", color: "#000" }}>
                                  {editServices.find((s) => s.id === addon.id)?.quantity || 1}
                                </Text>

                                <Pressable
                                  onPress={(e) => {
                                    e.stopPropagation();
                                    addAddonToCart(addon);
                                  }}
                                  style={{
                                    paddingHorizontal: 12,
                                    paddingVertical: 6,
                                  }}
                                  disabled={(editServices.find((s) => s.id === addon.id)?.quantity || 1) >= (addon.max_quantity || 3)}
                                >
                                  <Text
                                    style={{
                                      fontSize: 18,
                                      fontWeight: "700",
                                      color: (editServices.find((s) => s.id === addon.id)?.quantity || 1) >= (addon.max_quantity || 3) ? "#ccc" : "#000"
                                    }}
                                  >
                                    +
                                  </Text>
                                </Pressable>
                              </View>
                            ) : (
                              <Pressable
                                onPress={(e) => {
                                  e.stopPropagation();
                                  addAddonToCart(addon);
                                }}
                                style={{
                                  flex: 1,
                                  backgroundColor: COLORS.saffron,
                                  paddingVertical: 6,
                                  borderRadius: 6,
                                  alignItems: "center",
                                }}
                              >
                                <Text
                                  style={{
                                    fontSize: 13,
                                    fontWeight: "700",
                                    color: "#000",
                                  }}
                                >
                                  + Add
                                </Text>
                              </Pressable>
                            )}
                          </View>
                        </View>
                      </Pressable>
                    );
                  })
                )}
              </ScrollView>
            </View>
          </SafeAreaView>
        </Modal>

        {/* ================= ADDON DETAIL MODAL ================= */}
        {selectedAddonDetail && (
          <Modal visible={!!selectedAddonDetail} transparent animationType="slide" statusBarTranslucent={true} onRequestClose={() => setSelectedAddonDetail(null)}>
            <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)" }}>
              <Pressable
                style={{ flex: 1 }}
                onPress={() => setSelectedAddonDetail(null)}
              />
              <View style={{
                backgroundColor: "#fff",
                maxHeight: "70%",
                borderTopLeftRadius: 20,
                borderTopRightRadius: 20,
                paddingBottom: Math.max(insets.bottom, 20)
              }}>
                {/* Header */}
                <View style={{ flexDirection: "row", justifyContent: "space-between", padding: 16, borderBottomWidth: 1, borderBottomColor: "#eee" }}>
                  <Text style={{ fontSize: 20, fontWeight: "800" }}>{selectedAddonDetail.title}</Text>
                  <Pressable onPress={() => setSelectedAddonDetail(null)}>
                    <Text style={{ fontSize: 20 }}>✕</Text>
                  </Pressable>
                </View>

                <ScrollView contentContainerStyle={{ padding: 20 }}>
                  {/* addon image */}
                  {selectedAddonDetail.image && selectedAddonDetail.image.trim() !== '' ? (
                    <Image
                      source={{ uri: selectedAddonDetail.image }}
                      style={{ width: "100%", height: 280, borderRadius: 8 }}
                      resizeMode="cover"
                    />
                  ) : null}

                  {/* Duration */}
                  <Text style={{ fontSize: 15, color: "#666", marginBottom: 8 }}>
                    {selectedAddonDetail.duration} mins
                  </Text>

                  {/* Price */}
                  <Text style={{ fontSize: 20, fontWeight: "800", marginBottom: 16 }}>
                    {String(selectedAddonDetail.price).startsWith('₹') ? selectedAddonDetail.price : `₹${selectedAddonDetail.price}`}
                  </Text>

                  {/* Description */}
                  {selectedAddonDetail.description && (
                    <>
                      <Text style={{ fontSize: 18, fontWeight: "700", marginTop: 24, color: COLORS.black }}>Description</Text>
                      <Text style={{ fontSize: 15, lineHeight: 22, marginTop: 8, color: "#333" }}>{selectedAddonDetail.description}</Text>
                    </>
                  )}

                  {/* Work Includes */}
                  {selectedAddonDetail.work_includes && selectedAddonDetail.work_includes.trim() ? (
                    <>
                      <Text style={{ fontSize: 18, fontWeight: "700", marginTop: 24, color: COLORS.saffron }}>Work Includes</Text>
                      {parseTextList(selectedAddonDetail.work_includes).map((line, idx) => (
                        <View key={idx} style={{ flexDirection: "row", marginTop: 8 }}>
                          <Text style={{ marginRight: 8, fontSize: 15 }}>•</Text>
                          <Text style={{ fontSize: 15, flex: 1, lineHeight: 22 }}>{line}</Text>
                        </View>
                      ))}
                    </>
                  ) : null}

                  {/* Work Not Includes */}
                  {selectedAddonDetail.work_not_included && selectedAddonDetail.work_not_included.trim() ? (
                    <>
                      <Text style={{ fontSize: 18, fontWeight: "700", marginTop: 24, color: "#D32F2F" }}>Work Not Includes</Text>
                      {parseTextList(selectedAddonDetail.work_not_included).map((line, idx) => (
                        <View key={idx} style={{ flexDirection: "row", marginTop: 8 }}>
                          <Text style={{ marginRight: 8, fontSize: 15, color: "#555" }}>•</Text>
                          <Text style={{ fontSize: 15, flex: 1, lineHeight: 22, color: "#555" }}>{line}</Text>
                        </View>
                      ))}
                    </>
                  ) : null}
                </ScrollView>

                {/* Add Button */}
                <View style={{ padding: 16 }}>
                  {editServices.some((s) => s.id === selectedAddonDetail.id) ? (
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#f0f0f0", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 6 }}>
                      <Pressable
                        onPress={() => decrementAddon(selectedAddonDetail.id)}
                        style={{ paddingHorizontal: 20, paddingVertical: 8 }}
                      >
                        <Text style={{ fontSize: 22, fontWeight: "700", color: "#000" }}>-</Text>
                      </Pressable>

                      <Text style={{ fontSize: 18, fontWeight: "700", color: "#000" }}>
                        {editServices.find((s) => s.id === selectedAddonDetail.id)?.quantity || 1}
                      </Text>

                      <Pressable
                        onPress={() => addAddonToCart(selectedAddonDetail)}
                        style={{ paddingHorizontal: 20, paddingVertical: 8 }}
                        disabled={(editServices.find((s) => s.id === selectedAddonDetail.id)?.quantity || 1) >= (selectedAddonDetail.max_quantity || 3)}
                      >
                        <Text
                          style={{
                            fontSize: 22,
                            fontWeight: "700",
                            color: (editServices.find((s) => s.id === selectedAddonDetail.id)?.quantity || 1) >= (selectedAddonDetail.max_quantity || 3) ? "#ccc" : "#000"
                          }}
                        >
                          +
                        </Text>
                      </Pressable>
                    </View>
                  ) : (
                    <Pressable
                      onPress={() => addAddonToCart(selectedAddonDetail)}
                      style={{ backgroundColor: COLORS.saffron, paddingVertical: 14, borderRadius: 10, alignItems: "center" }}
                    >
                      <Text style={{ color: "#000", fontWeight: "800" }}>+ Add</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            </View>
          </Modal>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/* ================= STYLES ================= */

const styles = StyleSheet.create({
  container: { padding: 20 },
  pageTitle: { fontSize: 26, fontWeight: "700" },

  dropdownRow: { flexDirection: "row", gap: 10 },
  picker: { flex: 1, color: "#000", backgroundColor: "#fff" },

  calendar: { marginTop: 15 },
  dayCol: { alignItems: "center", width: 45 },
  dayLabel: { fontSize: 12, color: "#666" },

  dateBox: {
    width: 38,
    height: 38,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyDate: { height: 38 },

  selectedDate: { backgroundColor: "#fbbf24", borderRadius: 6 },
  selectedText: { color: "#000", fontWeight: "600" },
  disabledDate: { backgroundColor: "#eee" },
  disabledText: { color: "#aaa" },

  section: { fontSize: 18, fontWeight: "600", marginTop: 20 },

  timeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginTop: 10,
  },

  timeBox: {
    width: "30%",
    borderWidth: 1,
    borderColor: "#ccc",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 12,
  },

  timeText: { fontSize: 14 },

  selectedTime: {
    backgroundColor: "#fbbf24",
    borderColor: "#fbbf24",
  },

  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  serviceCard: { marginTop: 10 },
  bold: { fontWeight: "600" },
  meta: { fontSize: 13, color: "#555" },

  primaryBtn: {
    backgroundColor: "#F4C430",
    padding: 16,
    borderRadius: 10,
    marginTop: 20,
  },

  disabledBtn: { backgroundColor: "#ccc" },

  primaryText: {
    color: "#000",
    textAlign: "center",
    fontWeight: "700",
    fontSize: 16,
  },

  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
  },

  modal: {
    backgroundColor: "#fff",
    margin: 20,
    padding: 20,
    borderRadius: 14,
  },

  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  modalTitle: { fontSize: 18, fontWeight: "700" },
  close: { fontSize: 18 },

  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: 10,
  },

  remove: { color: "#000" },
  edit: { color: "#000", fontWeight: "600" },

  outlineBtn: {
    borderWidth: 1,
    borderColor: "#000",
    padding: 12,
    alignItems: "center",
    borderRadius: 8,
    marginVertical: 10,
  },

  addHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  addTitle: { fontSize: 20, fontWeight: "700" },

  addRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
    alignItems: "center",
  },

  addBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
  },
});
