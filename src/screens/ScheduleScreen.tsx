import { RouteProp, useNavigation } from "@react-navigation/native";
import { Image } from "expo-image";
import React, { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import Header from "../components/Header";
import AnimatedGradientBorder from "../components/AnimatedGradientBorder";
import { useTheme } from "../context/ThemeContext";
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
  is_active?: boolean; // only show addon if true
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

// Fallback defaults (used if schedule_config table fetch fails)
const DEFAULT_YEARS = [2026, 2027, 2028];
const DEFAULT_TIMES = [
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
  timeString: string,
  selectedServices: SelectedService[],
  serviceTimeRules: any[]
) => {
  if (day === null) return false;
  if (!timeString || typeof timeString !== "string") return false;

  const [time, modifier] = timeString.split(" ");
  if (!time) return false;
  let [hours, minutes] = time.split(":").map(Number);

  if (modifier === "pm" && hours < 12) hours += 12;
  if (modifier === "am" && hours === 12) hours = 0;

  const slotDate = new Date(year, month, day, hours, minutes);
  const now = new Date();
  const cutoff = new Date(now.getTime() + 90 * 60000); // Now + 1 hour 30 mins

  // 1. Basic delay check (Now + 90 mins)
  if (slotDate <= cutoff) return false;

  // 2. Service-specific last booking time check
  if (serviceTimeRules.length > 0 && selectedServices.length > 0) {
    const selectedServiceNames = selectedServices.map(s => s.title.toLowerCase().trim());
    const selectedServiceTypes = selectedServices.map(s => (s.service_type || "").toLowerCase().trim());
    const matchingRules = serviceTimeRules.filter(rule => {
      const ruleServiceName = String(rule.service_name || rule.service || "").toLowerCase().trim();
      if (!ruleServiceName) return false;
      
      // Match against service_type (category) first — this is the primary match
      if (selectedServiceTypes.some(type => type && (type === ruleServiceName || type.includes(ruleServiceName) || ruleServiceName.includes(type)))) return true;
      
      // Fallback: match against title
      const ruleKeywords = ruleServiceName.split(" ").filter(k => k.length > 3);
      return selectedServiceNames.some(name => {
        if (name.includes(ruleServiceName) || ruleServiceName.includes(name)) return true;
        return ruleKeywords.some(kw => name.includes(kw));
      });
    });

    if (matchingRules.length > 0) {
      let earliestLimitInMinutes: number | null = null;

      matchingRules.forEach(rule => {
        const lbTimeRaw = rule.last_booking_time;
        if (!lbTimeRaw) return;

        const normalized = String(lbTimeRaw).toLowerCase().trim();
        const lbModifier = normalized.includes("pm") ? "pm" : "am";
        const timePart = normalized.replace(/[ap]m/g, "").trim();
        
        let lbHours = 0;
        let lbMinutes = 0;

        if (timePart.includes(":")) {
          const parts = timePart.split(":").map(Number);
          lbHours = parts[0] || 0;
          lbMinutes = parts[1] || 0;
        } else {
          lbHours = Number(timePart) || 0;
        }

        if (lbModifier === "pm" && lbHours < 12) lbHours += 12;
        if (lbModifier === "am" && lbHours === 12) lbHours = 0;

        const limitInMinutes = lbHours * 60 + lbMinutes;
        if (earliestLimitInMinutes === null || limitInMinutes < earliestLimitInMinutes) {
          earliestLimitInMinutes = limitInMinutes;
        }
      });

      if (earliestLimitInMinutes !== null) {
        const slotMinutesTotal = hours * 60 + minutes;
        if (slotMinutesTotal > earliestLimitInMinutes) {
          return false;
        }
      }
    }
  }

  return true;
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
  const { theme, isDark } = useTheme();

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
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [showYearPicker, setShowYearPicker] = useState(false);

  // Addons-related state
  const [showAddonsModal, setShowAddonsModal] = useState(false);
  const [selectedAddonDetail, setSelectedAddonDetail] = useState<AddOn | null>(null);
  const [addons, setAddons] = useState<AddOn[]>([]);

  // Dynamic schedule config from Supabase
  const [timeSlots, setTimeSlots] = useState<string[]>(DEFAULT_TIMES);
  const [availableYears, setAvailableYears] = useState<number[]>(DEFAULT_YEARS);
  const [serviceTimeRules, setServiceTimeRules] = useState<any[]>([]);

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

    // Fetch addons (only active ones)
    supabase
      .from("add_ons")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .then(({ data, error }) => {
        if (error) console.error("Error fetching addons:", error);
        if (data) setAddons(data as AddOn[]);
      });

    // Fetch schedule config (time_slots, years)
    supabase
      .from("schedule_config")
      .select("*")
      .then(({ data, error }) => {
        if (error) {
          console.error("Error fetching schedule config:", error);
          return;
        }
        if (data) {
          data.forEach((row: { config_key: string; config_value: any }) => {
            if (row.config_key === "time_slots" && Array.isArray(row.config_value)) {
              // time_slots may be plain strings or objects {value, active}
              const normalized = row.config_value
                .map((slot: any) => {
                  if (typeof slot === "string") return slot.trim();
                  if (slot && typeof slot === "object" && slot.value) {
                    if (slot.active === false) return null;
                    const val = String(slot.value).trim();
                    return val || null;
                  }
                  return null;
                })
                .filter(Boolean) as string[];
              setTimeSlots(normalized);
            }
            if (row.config_key === "years" && Array.isArray(row.config_value)) {
              setAvailableYears(row.config_value as number[]);
            }
            // Check both config_key and config_keys as per user requirement
            const key = (row as any).config_key || (row as any).config_keys || (row as any).config_id;
            if (key === "service_time_rules") {
              let rules = [];
              if (typeof row.config_value === "string") {
                try { rules = JSON.parse(row.config_value); } catch(e) { rules = []; }
              } else {
                rules = row.config_value;
              }
              const finalRules = Array.isArray(rules) ? rules : (rules ? [rules] : []);
              setServiceTimeRules(finalRules);
            }
          });
        }
      });
  }, []);


  // Reset selectedTime when date, month, or year changes
  useEffect(() => {
    setSelectedTime(null);
  }, [selectedDate, month, year]);

  // ✅ Filter addons to match the main service's service_type (case-insensitive)
  const filteredAddons = useMemo(() => {
    const mainService = allServices.find((s) => s.id === editServices[0]?.id);
    const mainServiceType = mainService?.service_type?.toUpperCase() || '';
    return addons.filter(
      (addon) => addon.service_type?.toUpperCase() === mainServiceType
    );
  }, [addons, allServices, editServices]);

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
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={["top"]}>
      <Header />
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={[styles.pageTitle, { color: theme.text }]}>{t("schedule.title")}</Text>

        {/* MONTH / YEAR */}
        <View style={styles.dropdownRow}>
          <Pressable style={[styles.pickerBtn, { backgroundColor: theme.surfaceVariant, borderColor: theme.border }]} onPress={() => setShowMonthPicker(true)}>
            <Text style={[styles.pickerBtnText, { color: theme.text }]}>{MONTHS[month]}</Text>
            <Text style={[styles.pickerArrow, { color: theme.textLight }]}>▼</Text>
          </Pressable>

          <Pressable style={[styles.pickerBtn, { backgroundColor: theme.surfaceVariant, borderColor: theme.border }]} onPress={() => setShowYearPicker(true)}>
            <Text style={[styles.pickerBtnText, { color: theme.text }]}>{String(year)}</Text>
            <Text style={[styles.pickerArrow, { color: theme.textLight }]}>▼</Text>
          </Pressable>
        </View>

        {/* Month Picker Modal */}
        <Modal visible={showMonthPicker} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setShowMonthPicker(false)}>
          <Pressable style={styles.pickerOverlay} onPress={() => setShowMonthPicker(false)}>
            <View style={[styles.pickerModal, { width: 250, maxHeight: 300, backgroundColor: theme.background }]}>
                <FlatList
                  data={MONTHS}
                  keyExtractor={(item) => item}
                  renderItem={({ item, index }) => (
                    <Pressable
                      style={[styles.pickerItem, month === index && styles.pickerItemSelected]}
                      onPress={() => { setMonth(index); setShowMonthPicker(false); }}
                    >
                      <Text style={[styles.pickerItemText, { color: theme.text }, month === index && styles.pickerItemTextSelected]}>{item}</Text>
                    </Pressable>
                  )}
                />
              </View>
          </Pressable>
        </Modal>

        {/* Year Picker Modal */}
        <Modal visible={showYearPicker} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setShowYearPicker(false)}>
          <Pressable style={styles.pickerOverlay} onPress={() => setShowYearPicker(false)}>
            <View style={[styles.pickerModal, { width: 150, maxHeight: 200, backgroundColor: theme.background }]}>
                <FlatList
                  data={availableYears}
                  keyExtractor={(item) => String(item)}
                  renderItem={({ item }) => (
                    <Pressable
                      style={[styles.pickerItem, year === item && styles.pickerItemSelected]}
                      onPress={() => { setYear(item); setShowYearPicker(false); }}
                    >
                      <Text style={[styles.pickerItemText, { color: theme.text }, year === item && styles.pickerItemTextSelected]}>{String(item)}</Text>
                    </Pressable>
                  )}
                />
              </View>
          </Pressable>
        </Modal>

        {/* CALENDAR */}
        <View style={[styles.calendar, { backgroundColor: theme.background }]}>
          <View style={{ flexDirection: "row" }}>
            {DAYS.map((d, i) => (
              <View key={d} style={styles.dayCol}>
                <Text style={[styles.dayLabel, { color: theme.textLight }]}>{d}</Text>

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
                          { color: theme.text },
                          selected && styles.selectedText,
                          disabled && { color: theme.textLight },
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
            <Text style={[styles.section, { color: theme.text }]}>{t("schedule.selectTime")}</Text>

            <View style={styles.timeGrid}>
              {timeSlots.map((time) => {
                const valid = isTimeSlotValid(year, month, selectedDate, time, selectedServices, serviceTimeRules);
                return (
                  <Pressable
                    key={time}
                    disabled={!valid}
                    onPress={() => setSelectedTime(time)}
                    style={[
                      styles.timeBox,
                      { backgroundColor: theme.surfaceVariant, borderColor: theme.border },
                      !valid && { backgroundColor: isDark ? '#2a2a2a' : '#f0f0f0', borderColor: isDark ? '#333' : '#ddd' },
                      selectedTime === time && styles.selectedTime,
                    ]}
                  >
                    <Text
                      style={[
                        styles.timeText,
                        { color: theme.text },
                        !valid && { color: theme.textLight },
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
          <Text style={[styles.section, { color: theme.text }]}>{t("schedule.serviceDetails")}</Text>
          <Pressable onPress={() => setShowSummary(true)}>
            <Text style={styles.edit}>{t("schedule.edit")}</Text>
          </Pressable>
        </View>

        {selectedServices.map((s: SelectedService) => (
          <View key={s.id} style={[styles.serviceCard, { backgroundColor: theme.background, borderColor: theme.border }]}>
            <Text style={[styles.bold, { color: theme.text }]}>
              {s.title}
              {s.quantity && s.quantity > 1 ? ` (x${s.quantity})` : ""}
            </Text>

            {/* ✅ Pricing Display - Calculate total based on quantity */}
            <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
              <Text style={{ fontSize: 15, fontWeight: "600", color: theme.text }}>
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

            <Text style={[styles.meta, { color: theme.textLight }]}>
              {selectedDate && selectedTime
                ? `${selectedDayName}, ${selectedDate} ${MONTHS[month]} ${year} at ${selectedTime}`
                : ""}
            </Text>
            <Text style={[styles.meta, { color: theme.textLight }]}>{s.duration}</Text>
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
            { backgroundColor: theme.primary },
            (!selectedDate ||
              !selectedTime ||
              selectedServices.length === 0) &&
            styles.disabledBtn,
          ]}
          onPress={() => {
            const bookingDateText = `${selectedDayName}, ${selectedDate} ${MONTHS[month]} ${year} at ${selectedTime}`;

            navigation.navigate("Checkout", {
              services: selectedServices,
              bookingDateText,
            });
          }}
        >
          <Text style={[styles.primaryText, { color: theme.background }]}>{t("schedule.proceed")}</Text>
        </Pressable>

        {/* ================= APPOINTMENT SUMMARY MODAL ================= */}
        <Modal visible={showSummary} transparent animationType="fade" statusBarTranslucent={true}>
          <Pressable
            style={{
              flex: 1,
              backgroundColor: "rgba(0,0,0,0.55)",
              justifyContent: "center",
              padding: 20
            }}
            onPress={() => setShowSummary(false)}
          >
            <AnimatedGradientBorder
              borderRadius={14}
              borderWidth={2}
              animationSpeed={3}
              style={{ width: "100%", maxHeight: "80%" }}
            >
              <Pressable
                style={{
                  backgroundColor: theme.background,
                  borderRadius: 14,
                  padding: 20,
                  width: "100%"
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
                  <Text style={{ fontSize: 18, fontWeight: "800", color: theme.text }}>
                    Appointment Summary
                  </Text>
                  <Pressable onPress={() => setShowSummary(false)}>
                    <Text style={{ fontSize: 18, color: theme.text }}>✕</Text>
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
                      <Text style={{ fontWeight: "800", fontSize: 16, color: theme.text }}>
                        {s.title}
                        {s.quantity && s.quantity > 1 ? ` (x${s.quantity})` : ""}
                      </Text>
                      <Text style={{ marginTop: 4, color: theme.textLight }}>
                        {s.duration}
                      </Text>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 }}>
                        <Text style={{ fontSize: 16, fontWeight: "800", color: theme.text }}>
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

                {/* ✅ ADDONS BUTTON — only show if there are matching addons for this service_type */}
                {filteredAddons.length > 0 && (
                  <Pressable
                    onPress={() => {
                      setShowSummary(false);
                      setShowAddonsModal(true);
                    }}
                    style={{
                      borderWidth: 1,
                      borderColor: theme.border,
                      paddingVertical: 12,
                      alignItems: "center",
                      marginTop: 16,
                      borderRadius: 10,
                    }}
                  >
                    <Text style={{ fontWeight: "800", color: theme.text }}>+ Addons</Text>
                  </Pressable>
                )}

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
                    backgroundColor: theme.primary,
                    paddingVertical: 14,
                    alignItems: "center",
                    marginTop: 16,
                    borderRadius: 10,
                  }}
                >
                  <Text style={{ color: theme.background, fontWeight: "800" }}>
                    {t("schedule.update")}
                  </Text>
                </Pressable>
              </Pressable>
            </AnimatedGradientBorder>
          </Pressable>
        </Modal>

        {/* ================= ADD SERVICE MODAL ================= */}
        <Modal visible={showAddService} animationType="slide" statusBarTranslucent={true}>
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", padding: 10 }}>
            <AnimatedGradientBorder
              borderRadius={20}
              borderWidth={2}
              animationSpeed={3}
              style={{ flex: 1 }}
            >
              <View style={{ flex: 1, backgroundColor: theme.background, borderRadius: 20, padding: 20 }}>
                <View style={styles.addHeader}>
                  <Text style={[styles.addTitle, { color: theme.text }]}>{t("schedule.addService")}</Text>
                  <Pressable onPress={() => setShowAddService(false)}>
                    <Text style={[styles.close, { color: theme.text }]}>✕</Text>
                  </Pressable>
                </View>

                <ScrollView style={{ marginTop: 20 }}>
                  {allServices.map((s) => {
                    const exists = editServices.some((x) => x.id === s.id);

                    return (
                      <View key={s.id} style={[styles.addRow, { borderColor: theme.border }]}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.bold, { color: theme.text }]}>{s.title}</Text>
                          <Text style={{ color: theme.textLight }}>{s.duration}</Text>
                          <Text style={{ color: theme.text }}>{s.price}</Text>
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
            </AnimatedGradientBorder>
          </View>
        </Modal>

        {/* ================= ADDONS LIST MODAL ================= */}
        <Modal visible={showAddonsModal} transparent animationType="slide" statusBarTranslucent={true}>
          <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={["top", "bottom"]}>
            <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", padding: 10 }}>
              <AnimatedGradientBorder
                borderRadius={20}
                borderWidth={2}
                animationSpeed={3}
                style={{ flex: 1 }}
              >
                <View style={{ flex: 1, backgroundColor: theme.background, borderRadius: 20 }}>
                  {/* Header */}
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                      paddingHorizontal: 20,
                      paddingVertical: 15,
                      borderBottomWidth: 1,
                      borderBottomColor: theme.border,
                    }}
                  >
                    <Text style={{ fontSize: 20, fontWeight: "800", color: theme.text }}>{t("schedule.addons")}</Text>
                    <Pressable
                      onPress={() => {
                        setShowAddonsModal(false);
                        setShowSummary(true);
                      }}
                    >
                      <Text style={{ fontSize: 20, padding: 5, color: theme.text }}>✕</Text>
                    </Pressable>
                  </View>

                  <ScrollView contentContainerStyle={{ padding: 16 }}>
                    {filteredAddons.length === 0 ? (
                      <Text style={{ textAlign: "center", marginTop: 20, color: "#888" }}>
                        No extra add-ons available.
                      </Text>
                    ) : (
                      filteredAddons.map((addon) => {
                        const isAdded = editServices.some(
                          (s) => s.id === addon.id
                        );

                        return (
                          <Pressable
                            key={addon.id}
                            onPress={() => setSelectedAddonDetail(addon)}
                            style={({ pressed }) => ({
                              flexDirection: "row",
                              backgroundColor: theme.background,
                              borderRadius: 12,
                              marginBottom: 16,
                              borderWidth: 1,
                              borderColor: theme.border,
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
                                <Text style={{ fontSize: 16, fontWeight: "700", color: theme.text }}>
                                  {addon.title}
                                </Text>
                                <Text
                                  style={{
                                    fontSize: 13,
                                    color: theme.textLight,
                                    marginTop: 2,
                                  }}
                                >
                                  {addon.duration} mins
                                </Text>

                                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 }}>
                                  <Text style={{ fontSize: 16, fontWeight: "800", color: theme.text }}>
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
                                    borderColor: theme.border,
                                    paddingVertical: 6,
                                    borderRadius: 6,
                                    alignItems: "center",
                                  }}
                                >
                                  <Text style={{ fontSize: 13, fontWeight: "600", color: theme.text }}>
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
                                      backgroundColor: isDark ? '#2a2a2a' : '#f0f0f0',
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
                                      <Text style={{ fontSize: 18, fontWeight: "700", color: theme.text }}>
                                        -
                                      </Text>
                                    </Pressable>

                                    <Text style={{ fontSize: 14, fontWeight: "700", color: theme.text }}>
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
                                          color: (editServices.find((s) => s.id === addon.id)?.quantity || 1) >= (addon.max_quantity || 3) ? theme.textLight : theme.text
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
              </AnimatedGradientBorder>
            </View>
          </SafeAreaView>
        </Modal>

        {/* ================= ADDON DETAIL MODAL ================= */}
        {selectedAddonDetail && (
          <Modal visible={!!selectedAddonDetail} transparent animationType="slide" statusBarTranslucent={true} onRequestClose={() => setSelectedAddonDetail(null)}>
            <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", padding: 10, justifyContent: "flex-end" }}>
              <AnimatedGradientBorder
                borderRadius={20}
                borderWidth={2}
                animationSpeed={3}
                style={{ width: "100%", maxHeight: "80%" }}
              >
                <View style={{
                  backgroundColor: theme.background,
                  borderRadius: 20,
                  paddingBottom: Math.max(insets.bottom, 20),
                  width: "100%"
                }}>
                  {/* Header */}
                  <View style={{ flexDirection: "row", justifyContent: "space-between", padding: 16, borderBottomWidth: 1, borderBottomColor: theme.border }}>
                    <Text style={{ fontSize: 20, fontWeight: "800", color: theme.text }}>{selectedAddonDetail.title}</Text>
                    <Pressable onPress={() => setSelectedAddonDetail(null)}>
                      <Text style={{ fontSize: 20, color: theme.text }}>✕</Text>
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
                    <Text style={{ fontSize: 15, color: theme.textLight, marginBottom: 8, marginTop: 10 }}>
                      {selectedAddonDetail.duration} mins
                    </Text>

                    {/* Price */}
                    <Text style={{ fontSize: 20, fontWeight: "800", marginBottom: 16, color: theme.text }}>
                      {String(selectedAddonDetail.price).startsWith('₹') ? selectedAddonDetail.price : `₹${selectedAddonDetail.price}`}
                    </Text>

                    {/* Description */}
                    {selectedAddonDetail.description && (
                      <>
                        <Text style={{ fontSize: 18, fontWeight: "700", marginTop: 24, color: theme.text }}>Description</Text>
                        <Text style={{ fontSize: 15, lineHeight: 22, marginTop: 8, color: theme.textLight }}>{selectedAddonDetail.description}</Text>
                      </>
                    )}

                    {/* Work Includes */}
                    {selectedAddonDetail.work_includes && selectedAddonDetail.work_includes.trim() ? (
                      <>
                        <Text style={{ fontSize: 18, fontWeight: "700", marginTop: 24, color: theme.primary }}>Work Includes</Text>
                        {parseTextList(selectedAddonDetail.work_includes).map((line, idx) => (
                          <View key={idx} style={{ flexDirection: "row", marginTop: 8 }}>
                            <Text style={{ marginRight: 8, fontSize: 15, color: theme.text }}>•</Text>
                            <Text style={{ fontSize: 15, flex: 1, lineHeight: 22, color: theme.text }}>{line}</Text>
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
                            <Text style={{ marginRight: 8, fontSize: 15, color: theme.textLight }}>•</Text>
                            <Text style={{ fontSize: 15, flex: 1, lineHeight: 22, color: theme.textLight }}>{line}</Text>
                          </View>
                        ))}
                      </>
                    ) : null}
                  </ScrollView>

                  {/* Add Button */}
                  <View style={{ padding: 16 }}>
                    {editServices.some((s) => s.id === selectedAddonDetail.id) ? (
                      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: isDark ? '#2a2a2a' : '#f0f0f0', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 6 }}>
                        <Pressable
                          onPress={() => decrementAddon(selectedAddonDetail.id)}
                          style={{ paddingHorizontal: 20, paddingVertical: 8 }}
                        >
                          <Text style={{ fontSize: 22, fontWeight: "700", color: theme.text }}>-</Text>
                        </Pressable>

                        <Text style={{ fontSize: 18, fontWeight: "700", color: theme.text }}>
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
                              color: (editServices.find((s) => s.id === selectedAddonDetail.id)?.quantity || 1) >= (selectedAddonDetail.max_quantity || 3) ? theme.textLight : theme.text
                            }}
                          >
                            +
                          </Text>
                        </Pressable>
                      </View>
                    ) : (
                      <Pressable
                        onPress={() => addAddonToCart(selectedAddonDetail)}
                        style={{ backgroundColor: theme.primary, paddingVertical: 14, borderRadius: 10, alignItems: "center" }}
                      >
                        <Text style={{ color: theme.background, fontWeight: "800" }}>+ Add</Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              </AnimatedGradientBorder>
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

  dropdownRow: { flexDirection: "row", gap: 10, marginTop: 10 },
  pickerBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  pickerBtnText: { fontSize: 16, fontWeight: "600", color: "#000" },
  pickerArrow: { fontSize: 10, color: "#666", marginLeft: 6 },
  pickerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  pickerModal: {
    backgroundColor: "#fff",
    borderRadius: 14,
    width: "80%",
    maxHeight: "60%",
    paddingVertical: 8,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  pickerItem: {
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  pickerItemSelected: {
    backgroundColor: "#FFF8E1",
  },
  pickerItemText: {
    fontSize: 16,
    color: "#000",
  },
  pickerItemTextSelected: {
    fontWeight: "700",
    color: "#000",
  },

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
  disabledDate: { opacity: 0.3 },
  disabledText: { color: "#aaa" },

  section: { fontSize: 18, fontWeight: "600", marginTop: 20 },

  timeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-start",
    columnGap: 12,
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

  serviceCard: { marginTop: 10, borderRadius: 12, padding: 12, borderWidth: 1 },
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
