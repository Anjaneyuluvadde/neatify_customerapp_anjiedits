
import { Ionicons } from "@expo/vector-icons";
import { RouteProp, useNavigation } from "@react-navigation/native";
import { Image } from "expo-image";
import React, { useEffect, useMemo, useState, useRef, useCallback } from "react";
import {
  Dimensions,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  Text,
  View
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import Header from "../components/Header";
import AnimatedGradientBorder from "../components/AnimatedGradientBorder";
import { useLanguage } from "../context/LanguageContext";
import { useTheme } from "../context/ThemeContext";
import { useAuthGuard } from "../hooks/useAuthGuard";
import { supabase } from "../lib/supabase";
import { RootStackParamList } from "../navigation/AppNavigator";
import { COLORS } from "../theme/colors";
import { Service } from "../types/service";

/* ================= TYPES ================= */

type Props = {
  route: RouteProp<RootStackParamList, "ServiceDetail">;
};

// We need a local type for the fetched service to match what we use in state
// or we can just use the Service type if it matches well enough.
// The Service type has optional fields, so it should be fine.

type SelectedService = {
  id: string;
  title: string;
  duration: string;
  price: string;
  service_type?: string; // Add this
  original_price?: string | null;
  discount_percent?: number | null;
  image?: string | null;
  discount_label?: string | null;
  tax_percent?: number | null;
  quantity?: number; // For addons, track how many times added (max 3)
};

type AddOn = {
  id: string;
  title: string;
  duration: number; // integer in db
  price: string; // text with ₹ symbol from db
  image?: string | null;
  service_type?: string;
  description?: string;
  sort_order?: number;
  original_price?: string | null; // text with ₹ symbol from db
  discount_percent?: number | null;
  work_includes?: string | null; // text in db (was text[], now text)
  work_not_included?: string | null; // text in db
  discount_label?: string | null;
  tax_percent?: number | null;
  max_quantity?: number | null; // max times this addon can be added (from db)
  is_active?: boolean; // only show addon if true
};

/**
 * Parse text that may be in PostgreSQL array format {"item1","item2"} or newline-separated text.
 * Returns an array of individual items.
 */
const parseTextList = (text: string): string[] => {
  const trimmed = text.trim();
  // Check for PostgreSQL array format: {"item1","item2"}
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return trimmed
      .slice(1, -1) // Remove outer braces
      .split(/",\s*"/)
      .map((s) => s.replace(/^"|"$/g, '').trim())
      .filter(Boolean);
  }
  // Otherwise, split by newlines
  return trimmed
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
};

/* ================= COMPONENT ================= */

export default function ServiceDetailScreen({ route }: Props) {
  const navigation = useNavigation<any>();
  const { t } = useLanguage();
  const { theme, isDark } = useTheme();
  const { checkAuth } = useAuthGuard();
  const insets = useSafeAreaInsets();
  const { service: paramService, serviceId } = route.params;

  const [service, setService] = useState<Service | null>(paramService || null);
  const [loadingService, setLoadingService] = useState(!paramService && !!serviceId);
  const [refreshing, setRefreshing] = useState(false);
  const addonsTouchY = useRef(0);

  const [showSummary, setShowSummary] = useState(false);
  // const [showAddService, setShowAddService] = useState(false); // Removed as per request to replace
  const [showAddonsModal, setShowAddonsModal] = useState(false);
  const [selectedAddonDetail, setSelectedAddonDetail] = useState<AddOn | null>(
    null
  );

  const [availableServices, setAvailableServices] = useState<Service[]>([]);
  const [selectedServices, setSelectedServices] = useState<SelectedService[]>(
    []
  );
  const [addons, setAddons] = useState<AddOn[]>([]);

  // ✅ Active offer from offers table
  const [activeOfferPercent, setActiveOfferPercent] = useState<number | null>(null);

  /* ✅ PRICE FORMATTER */
  const formatPrice = (value: any) => {
    if (value === null || value === undefined) return "";
    return value
      .toString()
      .replace(/^₹\s*/, "")
      .replace(/,/g, "");
  };

  /* ✅ Convert to "₹799" style always */
  const displayRupee = (value: any) => {
    const cleaned = formatPrice(value);
    if (!cleaned) return "";
    return `₹${Number(cleaned).toLocaleString("en-IN")}`;
  };

  /* ✅ Dynamic Offer Badge Text */
  const offerBadgeText = (discount_percent: any, percentText?: any) => {
    if (percentText) return percentText;
    if (discount_percent && Number(discount_percent) > 0) {
      return `${discount_percent}% off`;
    }
    return t("serviceDetail.specialOffer");
  };

  /* ================= FETCH SERVICES & ADDONS ================= */

  const fetchAddons = useCallback(async () => {
    // Fetch Services (keeping existing logic though Add Another Service is removed from UI, might be useful later)
    const { data: servicesData } = await supabase
      .from("services")
      .select(
        "id, title, service_type, duration, price, original_price, discount_percent, discount_label, tax_percent, image, sort_order, description, gallery_images, work_not_included"
      );
    if (servicesData) setAvailableServices(servicesData as Service[]);

    // Fetch Add-ons (only active ones)
    const { data: addonsData, error } = await supabase
      .from("add_ons")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });
    
    if (error) console.error("Error fetching addons:", error);
    if (addonsData) setAddons(addonsData as AddOn[]);
  }, []);

  const fetchServiceDetails = useCallback(async () => {
    if (!service && serviceId) {
      setLoadingService(true);

      const fetchBySlug = async () => {
        const { data, error } = await supabase
          .from("services")
          .select(
            "id, slug, title, service_type, duration, price, original_price, discount_percent, discount_label, tax_percent, image, sort_order, description, gallery_images, work_includes, work_not_included"
          )
          .eq("slug", serviceId)
          .maybeSingle();
        return { data, error };
      };

      const fetchById = async () => {
        const { data, error } = await supabase
          .from("services")
          .select(
            "id, slug, title, service_type, duration, price, original_price, discount_percent, discount_label, tax_percent, image, sort_order, description, gallery_images, work_includes, work_not_included"
          )
          .eq("id", serviceId)
          .maybeSingle();
        return { data, error };
      };

      // Try slug first
      let { data, error } = await fetchBySlug();

      // If no data (and no breaking error), try ID
      if (!data) {
        const fallback = await fetchById();
        data = fallback.data;
        error = fallback.error;
      }

      if (error) {
        console.error("Error fetching service details:", error);
      }
      if (data) {
        setService(data as Service);
      }
      setLoadingService(false);
    }
  }, [service, serviceId]);

  const fetchActiveOffer = useCallback(async (currentService: Service | null) => {
    if (!currentService) return;

    const { data: offerData } = await supabase
      .from("offers")
      .select("offer_percentage")
      .eq("title", currentService.title)
      .eq("is_offer_enabled", true)
      .maybeSingle();

    if (offerData && offerData.offer_percentage > 0) {
      setActiveOfferPercent(offerData.offer_percentage);
    } else {
      setActiveOfferPercent(null);
    }
  }, []);

  useEffect(() => {
    fetchAddons();
  }, [fetchAddons]);

  useEffect(() => {
    fetchServiceDetails();
  }, [fetchServiceDetails]);

  useEffect(() => {
    fetchActiveOffer(service);
  }, [service, fetchActiveOffer]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      fetchAddons(),
      fetchServiceDetails(),
      fetchActiveOffer(service)
    ]);
    setRefreshing(false);
  };

  /* ================= INIT SELECTED SERVICE ================= */
  useEffect(() => {
    if (service) {
      // Determine effective price and badge based on active offer
      let effectivePrice = service.price;
      let effectiveLabel = (service as any)?.discount_label ?? null;
      let effectiveOriginalPrice = (service as any)?.original_price ?? null;
      let effectiveDiscountPercent = (service as any)?.discount_percent ?? null;

      if (activeOfferPercent && activeOfferPercent > 0) {
        // Use original_price as the base for calculating offer discount
        const cleanedOriginal = String(effectiveOriginalPrice ?? '').replace(/[^\d.]/g, '');
        const basePrice = cleanedOriginal && Number(cleanedOriginal) > 0
          ? Number(cleanedOriginal)
          : parseFloat(String(service.price).replace(/[^\d.]/g, ""));

        const discountedPrice = Math.round(basePrice - (basePrice * activeOfferPercent / 100));
        effectivePrice = discountedPrice.toString();
        effectiveLabel = `${activeOfferPercent}% OFF`;
        effectiveOriginalPrice = basePrice.toString();
        effectiveDiscountPercent = activeOfferPercent;
      }

      setSelectedServices([
        {
          id: service.id,
          title: service.title,
          duration: service.duration,
          price: effectivePrice,
          service_type: service.service_type,
          original_price: effectiveOriginalPrice,
          discount_percent: effectiveDiscountPercent,
          discount_label: effectiveLabel,
          tax_percent: (service as any)?.tax_percent ?? null,
          image: (service as any)?.image ?? null,
          quantity: 1, // Main service always has quantity 1
        },
      ]);
    }
  }, [service, activeOfferPercent]);

  /* ================= HELPERS ================= */

  const handleBookNow = () => {
    if (!service) return;
    setShowSummary(true);
  };

  const handleShare = async () => {
    if (!service) return;
    try {
      // Use slug for cleaner links, fallback to ID
      const identifier = service.slug || service.id;
      const url = `https://www.theneatifyteam.in/service/${identifier}`;

      await Share.share({
        message: `Check out this service: ${service.title} - ${service.description?.substring(0, 100)}... \n\nBook now on The Neatify Team! \n${url}`,
        title: service.title,
        url: url, // iOS sometimes uses this field
      });
    } catch (error) {
      console.log('Error sharing:', error);
    }
  };

  const addAddonToCart = (addon: AddOn) => {
    // Check if already added
    const existingAddon = selectedServices.find((s) => s.id === addon.id);

    if (existingAddon) {
      // If already added, increment quantity (up to max_quantity)
      const maxQty = addons.find((a) => a.id === addon.id)?.max_quantity || 3;
      if ((existingAddon.quantity || 1) >= maxQty) {
        // Already at max, do nothing
        return;
      }

      setSelectedServices((prev) =>
        prev.map((s) =>
          s.id === addon.id
            ? { ...s, quantity: (s.quantity || 1) + 1 }
            : s
        )
      );
      // Don't close modal when just incrementing quantity
    } else {
      // Add new addon with quantity 1
      const newService: SelectedService = {
        id: addon.id,
        title: addon.title,
        duration: `${addon.duration} mins`, // Convert int to string format
        price: addon.price, // already string with ₹ from db
        original_price: addon.original_price, // already string with ₹ from db
        discount_percent: addon.discount_percent,
        discount_label: (addon as any)?.discount_label ?? null,
        tax_percent: (addon as any)?.tax_percent ?? null,
        image: addon.image,
        quantity: 1,
      };

      setSelectedServices((prev) => [...prev, newService]);
      // Modal stays open so user can immediately adjust quantity
    }
  };

  const decrementAddon = (addonId: string) => {
    const existingAddon = selectedServices.find((s) => s.id === addonId);

    if (!existingAddon) return;

    if ((existingAddon.quantity || 1) <= 1) {
      // Remove the addon if quantity would go to 0
      removeService(addonId);
    } else {
      // Decrement quantity
      setSelectedServices((prev) =>
        prev.map((s) =>
          s.id === addonId
            ? { ...s, quantity: (s.quantity || 1) - 1 }
            : s
        )
      );
    }
  };

  const removeService = (id: string) => {
    if (selectedServices.length === 1) return; // ✅ cannot remove last
    setSelectedServices((prev) => prev.filter((s) => s.id !== id));
  };

  // ✅ Filter addons to match the main service's service_type (case-insensitive)
  const availableAddons = useMemo(() => {
    const mainServiceType = service?.service_type?.toUpperCase() || '';
    return addons.filter(
      (addon) => addon.service_type?.toUpperCase() === mainServiceType
    );
  }, [addons, service]);

  const descriptionLines = useMemo(() => {
    return (service?.description || "")
      .replace(/\r\n/g, "\n")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
  }, [service]);

  /* ✅ PRICE UI SETTINGS */
  const hasMRP =
    (service as any)?.original_price !== null &&
    (service as any)?.original_price !== undefined &&
    Number(String((service as any)?.original_price).replace(/[^\d.]/g, '')) > 0;

  /* ================= REUSABLE PRICE ROW (EXACT LIKE SCREENSHOT) ================= */

  const PriceRow = ({
    price,
    original_price,
    discount_percent,
    percentText,
    size = "normal", // 'normal' | 'small'
  }: {
    price: any;
    original_price?: any;
    discount_percent?: any;
    percentText?: any;
    size?: "normal" | "small";
  }) => {
    // ✅ FIX: Clean prices before comparing
    const cleanPrice = formatPrice(price);
    const cleanOriginal = formatPrice(original_price);

    const hasOld =
      original_price !== null &&
      original_price !== undefined &&
      cleanOriginal &&
      Number(cleanOriginal) > Number(cleanPrice);

    const fontSize = size === "small" ? 16 : 22;
    const oldPriceSize = size === "small" ? 12 : 15;
    const badgePaddingV = size === "small" ? 4 : 8;
    const badgeFontSize = size === "small" ? 10 : 14; // Removed badge font size customization from props, assuming strict structure

    return (
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          marginTop: size === "small" ? 6 : 10,
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        {/* ✅ MRP (STRIKE) - SHOWN FIRST */}
        {hasOld ? (
              <Text
            style={{
              fontSize: oldPriceSize,
              color: theme.textMuted,
              textDecorationLine: "line-through",
              textDecorationStyle: "solid",
              marginTop: 2,
            }}
          >
            {displayRupee(original_price)}
          </Text>
        ) : null}

        {/* ✅ OFFER PRICE (BIG) - SHOWN SECOND */}
        <Text
          style={{
            fontSize: fontSize,
            fontWeight: "800",
            color: theme.text,
          }}
        >
          {displayRupee(price)}
        </Text>

        {/* ✅ BADGE - SHOWN LAST */}
        {(percentText || discount_percent > 0) && (
          <View
            style={{
              backgroundColor: isDark ? "rgba(22, 163, 74, 0.2)" : "#E9F7EF",
              paddingHorizontal: 10,
              paddingVertical: badgePaddingV,
              borderRadius: 22,
            }}
          >
            <Text
              style={{
                color: isDark ? "#4ade80" : "#1E7E34",
                fontWeight: "700",
                fontSize: size === "small" ? 11 : 14,
              }}
            >
              {percentText || offerBadgeText(discount_percent)}
            </Text>
          </View>
        )}
      </View>
    );
  };

  /* ================= UI ================= */

  if (loadingService) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: theme.textLight }}>{t("common.loading")}</Text>
      </SafeAreaView>
    );
  }

  if (!service) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: theme.textLight }}>{t("serviceDetail.notFound")}</Text>
        <Pressable onPress={() => navigation.goBack()} style={{ marginTop: 20, padding: 10 }}>
          <Text style={{ color: theme.primary }}>{t("serviceDetail.goBack")}</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={["top"]}>
      <Header />

      <ScrollView 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[theme.primary]} // Android
            tintColor={theme.primary} // iOS
            progressBackgroundColor={theme.background}
          />
        }
      >
        {/* BACK BUTTON */}
        <Pressable
          onPress={() => {
            if (navigation.canGoBack()) {
              navigation.goBack();
            } else {
              navigation.navigate("HomeDrawer" as any);
            }
          }}
          style={{
            position: "absolute",
            top: 16,
            left: 16,
            zIndex: 10,
            backgroundColor: isDark ? "rgba(0,0,0,0.6)" : "rgba(255, 255, 255, 0.9)",
            width: 40,
            height: 40,
            borderRadius: 20,
            alignItems: "center",
            justifyContent: "center",
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.25,
            shadowRadius: 3.84,
            elevation: 5,
          }}
        >
          <Ionicons name="arrow-back" size={24} color={isDark ? "#fff" : "#000"} />
        </Pressable>

        {/* SHARE BUTTON */}
        <Pressable
          onPress={handleShare}
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            zIndex: 10,
            backgroundColor: isDark ? "rgba(0,0,0,0.6)" : "rgba(255, 255, 255, 0.9)",
            width: 40,
            height: 40,
            borderRadius: 20,
            alignItems: "center",
            justifyContent: "center",
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.25,
            shadowRadius: 3.84,
            elevation: 5,
          }}
        >
          <Ionicons name="share-social-outline" size={22} color={isDark ? "#fff" : "#000"} />
        </Pressable>

        {/* IMAGE */}
        <Image
          source={{ uri: service.image }}
          style={{ width: "100%", height: 240 }}
          resizeMode="cover"
        />

        {/* CONTENT */}
        <View style={{ padding: 16 }}>
          <Text style={{ fontSize: 26, fontWeight: "800", color: theme.text }}>
            {service.title}
          </Text>

          {/* ✅ Duration */}
          <Text style={{ marginTop: 6, color: theme.textLight, fontSize: 14 }}>
            {service.duration}
          </Text>

          {/* ✅ Exact Price Row — uses offer-overridden values if offer is active */}
          <PriceRow
            price={activeOfferPercent ? selectedServices[0]?.price ?? service.price : service.price}
            original_price={activeOfferPercent ? selectedServices[0]?.original_price : (service as any)?.original_price}
            discount_percent={activeOfferPercent ? activeOfferPercent : (service as any)?.discount_percent}
            percentText={activeOfferPercent ? `${activeOfferPercent}% OFF` : (service as any)?.discount_label}
          />

          {/* ✅ BOOK NOW */}
          <Pressable
            onPress={handleBookNow}
            style={{
              marginTop: 20,
              backgroundColor: COLORS.saffron,
              paddingVertical: 16,
              borderRadius: 12,
              alignItems: "center",
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: "700", color: "#000" }}>
              {t("serviceDetail.bookNow")}
            </Text>
          </Pressable>

          {/* ✅ Description */}
          {descriptionLines.length > 0 ? (
            <>
              <Text
                style={{
                  fontSize: 22,
                  fontWeight: "800",
                  marginTop: 26,
                  color: theme.text,
                }}
              >
                {t("serviceDetail.description")}
              </Text>

              {descriptionLines.map((line, index) => (
                <Text
                  key={index}
                  style={{
                    marginTop: 8,
                    fontSize: 15,
                    lineHeight: 22,
                    color: theme.text,
                  }}
                >
                  {line}
                </Text>
              ))}
            </>
          ) : null}

          {/* ✅ Work Includes */}
          {service.work_includes && service.work_includes.trim() ? (
            <>
              <Text
                style={{
                  fontSize: 22,
                  fontWeight: "800",
                  marginTop: 26,
                  color: COLORS.saffron,
                }}
              >
                {t("serviceDetail.includes")}
              </Text>

              {service.work_includes
                .replace(/\r\n/g, "\n")
                .split("\n")
                .map((l) => l.trim())
                .filter(Boolean)
                .map((line, index) => (
                  <View
                    key={index}
                    style={{
                      flexDirection: "row",
                      marginTop: 8,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 15,
                        lineHeight: 22,
                        color: theme.text,
                        marginRight: 8,
                      }}
                    >
                      •
                    </Text>
                    <Text
                      style={{
                        fontSize: 15,
                        lineHeight: 22,
                        color: theme.text,
                        flex: 1,
                      }}
                    >
                      {line}
                    </Text>
                  </View>
                ))}
            </>
          ) : null}

          {/* ✅ Work Not Includes */}
          {service.work_not_included && service.work_not_included.trim() ? (
            <>
              <Text
                style={{
                  fontSize: 22,
                  fontWeight: "800",
                  marginTop: 26,
                  color: "#D32F2F",
                }}
              >
                Work Not Includes
              </Text>

              {service.work_not_included
                .replace(/\r\n/g, "\n")
                .split("\n")
                .map((l) => l.trim())
                .filter(Boolean)
                .map((line, index) => (
                  <View
                    key={index}
                    style={{
                      flexDirection: "row",
                      marginTop: 8,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 15,
                        lineHeight: 22,
                        color: theme.textLight,
                        marginRight: 8,
                      }}
                    >
                      •
                    </Text>
                    <Text
                      style={{
                        fontSize: 15,
                        lineHeight: 22,
                        color: theme.textLight,
                        flex: 1,
                      }}
                    >
                      {line}
                    </Text>
                  </View>
                ))}
            </>
          ) : null}

          {/* ✅ Gallery */}
          {Array.isArray(service.gallery_images) &&
            service.gallery_images.length > 0 ? (
            <>
              <Text
                style={{
                  fontSize: 22,
                  fontWeight: "800",
                  marginTop: 30,
                  color: theme.text,
                }}
              >
                {t("serviceDetail.workframes")}
              </Text>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginTop: 12 }}
              >
                {service.gallery_images.map((img, idx) => (
                  <Image
                    key={idx}
                    source={{ uri: img }}
                    style={{
                      width: 130,
                      height: 130,
                      borderRadius: 12,
                      marginRight: 12,
                    }}
                  />
                ))}
              </ScrollView>
            </>
          ) : null}
        </View>

        {/* ================= SUMMARY MODAL ================= */}
          <Modal visible={showSummary} transparent animationType="fade" statusBarTranslucent={true} onRequestClose={() => setShowSummary(false)}>
            <View
              style={{
                flex: 1,
                backgroundColor: "rgba(0,0,0,0.55)",
                justifyContent: "center",
                padding: 20,
              }}
            >
              <AnimatedGradientBorder
                borderRadius={14}
                borderWidth={2}
                animationSpeed={3}
                style={{ width: "100%", maxHeight: "80%" }}
              >
                <View
                  style={{
                    backgroundColor: theme.background,
                    borderRadius: 14,
                    padding: 20,
                    width: "100%",
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <Text style={{ fontSize: 18, fontWeight: "800", color: theme.text }}>
                      {t("schedule.summary")}
                    </Text>
                    <Pressable onPress={() => setShowSummary(false)}>
                      <Text style={{ fontSize: 18, color: theme.text }}>✕</Text>
                    </Pressable>
                  </View>

                  <ScrollView
                    style={{ maxHeight: Dimensions.get('window').height * 0.4, marginTop: 14 }}
                    showsVerticalScrollIndicator={true}
                    nestedScrollEnabled={true}
                    bounces={false}
                  >
                    {selectedServices.map((s) => (
                      <View
                        key={s.id}
                        style={{
                          paddingVertical: 10,
                          borderBottomWidth: 0.5,
                          borderBottomColor: theme.border,
                        }}
                      >
                        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontWeight: "800", fontSize: 16, color: theme.text }}>
                              {s.title}
                              {s.quantity && s.quantity > 1 ? ` (x${s.quantity})` : ""}
                            </Text>
                            <Text style={{ marginTop: 4, color: theme.textLight }}>
                              {s.duration}
                            </Text>

                            {/* ✅ Calculate price based on quantity */}
                            <PriceRow
                              price={(parseFloat(formatPrice(s.price)) * (s.quantity || 1)).toString()}
                              original_price={s.original_price ? Number(String(s.original_price).replace(/[^\d.]/g, '')) * (s.quantity || 1) : null}
                              discount_percent={s.discount_percent}
                              percentText={(s as any)?.discount_label}
                              size="small"
                            />
                          </View>
                        </View>

                        {/* Show remove only if it's NOT the main service */}
                        {s.id !== service.id && (
                          <View style={{ flexDirection: "row", gap: 12, marginTop: 10 }}>
                            <Pressable onPress={() => removeService(s.id)} style={{ paddingVertical: 6 }}>
                              <Text
                                style={{ color: "red", fontSize: 12 }}
                              >
                                {t("schedule.remove")}
                              </Text>
                            </Pressable>
                          </View>
                        )}
                      </View>
                    ))}
                  </ScrollView>

                  {/* ✅ ADDONS BUTTON — only show if there are matching addons for this service_type */}
                  {availableAddons.length > 0 && (
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
                        <Text style={{ fontWeight: "800", color: theme.text }}>{"+ " + t("serviceDetail.addOns")}</Text>
                      </Pressable>
                    )}

                  <Pressable
                    onPress={async () => {
                      const isAuth = await checkAuth("schedule an appointment");
                      if (isAuth) {
                        setShowSummary(false);
                        navigation.navigate("Schedule", {
                          services: selectedServices,
                        });
                      }
                    }}
                    style={{
                      backgroundColor: COLORS.saffron,
                      paddingVertical: 14,
                      alignItems: "center",
                      marginTop: 16,
                      borderRadius: 10,
                    }}
                  >
                    <Text style={{ color: "#000", fontWeight: "800" }}>
                      {t("serviceDetail.scheduleAppointment")}
                    </Text>
                  </Pressable>
                </View>
              </AnimatedGradientBorder>
            </View>
        </Modal>

        {/* ================= ADDONS LIST MODAL ================= */}
        <Modal visible={showAddonsModal} transparent animationType="slide" statusBarTranslucent={true} onRequestClose={() => { setShowAddonsModal(false); setShowSummary(true); }}>
          <SafeAreaView style={{ flex: 1, backgroundColor: "transparent" }} edges={["top", "bottom"]}>
            <View 
              style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", paddingHorizontal: 10, paddingVertical: 20 }}
              onTouchStart={(e) => addonsTouchY.current = e.nativeEvent.pageY}
              onTouchEnd={(e) => {
                if (e.nativeEvent.pageY - addonsTouchY.current > 80) {
                  setShowAddonsModal(false);
                  setShowSummary(true);
                }
              }}
            >
              <AnimatedGradientBorder
                borderRadius={20}
                borderWidth={2}
                animationSpeed={3}
                style={{ width: "100%", alignSelf: "stretch", flex: 1 }}
                flex={1}
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
                    <Text style={{ fontSize: 20, fontWeight: "800", color: theme.text }}>{t("serviceDetail.addOns")}</Text>
                    <Pressable
                      onPress={() => {
                        setShowAddonsModal(false);
                        setShowSummary(true);
                      }}
                    >
                      <Text style={{ fontSize: 20, padding: 5, color: theme.text }}>✕</Text>
                    </Pressable>
                  </View>

                  <ScrollView 
                    contentContainerStyle={{ padding: 16 }}
                    onScroll={(e) => {
                      if (e.nativeEvent.contentOffset.y < -60) {
                        setShowAddonsModal(false);
                        setShowSummary(true);
                      }
                    }}
                    onScrollEndDrag={(e) => {
                      if (e.nativeEvent.contentOffset.y <= 0 && e.nativeEvent.velocity && e.nativeEvent.velocity.y > 1.5) {
                        setShowAddonsModal(false);
                        setShowSummary(true);
                      }
                    }}
                    scrollEventThrottle={16}
                  >
                    {availableAddons.length === 0 ? (
                      <Text style={{ textAlign: "center", marginTop: 20, color: theme.textLight }}>
                        {t("serviceDetail.noAddons")}
                      </Text>
                    ) : (
                      availableAddons.map((addon) => {
                        const isAdded = selectedServices.some(
                          (s) => s.id === addon.id
                        );

                        return (
                          <Pressable
                            key={addon.id}
                            onPress={() => setSelectedAddonDetail(addon)}
                            style={({ pressed }) => ({
                              flexDirection: "row",
                              backgroundColor: theme.background,
                              borderRadius: 14,
                              marginBottom: 16,
                              borderWidth: 1,
                              borderColor: theme.border,
                              overflow: "hidden",
                              opacity: pressed ? 0.7 : 1,
                              padding: 10,
                            })}
                          >
                            {/* Left Side: Image */}
                            <View style={{ width: 100, height: 100, borderRadius: 10, overflow: 'hidden' }}>
                              {addon.image && addon.image.trim() !== '' ? (
                                <Image
                                  source={{ uri: addon.image }}
                                  style={{ width: '100%', height: '100%' }}
                                  resizeMode="cover"
                                />
                              ) : (
                                <View
                                  style={{
                                    width: '100%',
                                    height: '100%',
                                    backgroundColor: theme.surfaceVariant,
                                    alignItems: "center",
                                    justifyContent: "center",
                                  }}
                                >
                                  <Text style={{ color: theme.textLight, fontSize: 10 }}>{t("serviceDetail.noImage")}</Text>
                                </View>
                              )}
                            </View>

                            {/* Right Side: Details */}
                            <View
                              style={{
                                flex: 1,
                                paddingLeft: 12,
                                justifyContent: "center",
                              }}
                            >
                              <View>
                                <Text style={{ fontSize: 16, fontWeight: "800", color: theme.text }} numberOfLines={1}>
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

                                <Text style={{ fontSize: 15, fontWeight: "700", color: theme.text, marginTop: 2 }}>
                                  {addon.price}
                                </Text>
                              </View>

                              {/* Action Buttons */}
                              <View
                                style={{
                                  flexDirection: "row",
                                  gap: 8,
                                  marginTop: 10,
                                }}
                              >
                                <Pressable
                                  onPress={(e) => {
                                    e.stopPropagation();
                                    setSelectedAddonDetail(addon);
                                  }}
                                  style={{
                                    flex: 1,
                                    paddingVertical: 10,
                                    borderRadius: 10,
                                    borderWidth: 1,
                                    borderColor: "#E5E7EB",
                                    backgroundColor: "#F9FAFB",
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                  }}
                                >
                                  <Text style={{ fontSize: 13, fontWeight: "700", color: "#374151" }}>
                                    {t("schedule.view")}
                                  </Text>
                                </Pressable>

                                {isAdded ? (
                                  <View
                                    style={{
                                      flex: 1.2,
                                      flexDirection: "row",
                                      alignItems: "center",
                                      justifyContent: 'space-between',
                                      backgroundColor: theme.surfaceVariant,
                                      borderRadius: 10,
                                      paddingHorizontal: 8,
                                    }}
                                  >
                                    <Pressable
                                      onPress={(e) => {
                                        e.stopPropagation();
                                        decrementAddon(addon.id);
                                      }}
                                      style={{
                                        paddingHorizontal: 10,
                                        paddingVertical: 8,
                                      }}
                                    >
                                      <Text style={{ fontSize: 20, fontWeight: "700", color: theme.text }}>
                                        -
                                      </Text>
                                    </Pressable>

                                    <Text style={{ fontSize: 16, fontWeight: "700", color: theme.text }}>
                                      {selectedServices.find((s) => s.id === addon.id)?.quantity || 1}
                                    </Text>

                                    <Pressable
                                      onPress={(e) => {
                                        e.stopPropagation();
                                        addAddonToCart(addon);
                                      }}
                                      style={{
                                        paddingHorizontal: 10,
                                        paddingVertical: 8,
                                      }}
                                      disabled={(selectedServices.find((s) => s.id === addon.id)?.quantity || 1) >= (addon.max_quantity || 3)}
                                    >
                                      <Text
                                        style={{
                                          fontSize: 20,
                                          fontWeight: "700",
                                          color: (selectedServices.find((s) => s.id === addon.id)?.quantity || 1) >= (addon.max_quantity || 3) ? theme.textLight : theme.text
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
                                      flex: 1.2,
                                      backgroundColor: COLORS.saffron,
                                      paddingVertical: 10,
                                      borderRadius: 10,
                                      alignItems: "center",
                                      justifyContent: 'center'
                                    }}
                                  >
                                    <Text
                                      style={{
                                        fontSize: 13,
                                        fontWeight: "700",
                                        color: "#000",
                                      }}
                                    >
                                      + {t("schedule.add")}
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
          <Modal
            visible={!!selectedAddonDetail}
            transparent
            animationType="slide"
            onRequestClose={() => setSelectedAddonDetail(null)}
            statusBarTranslucent={true}
          >
            <View 
              style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", padding: 10, paddingTop: insets.top + 10 }}
              onTouchStart={(e) => addonsTouchY.current = e.nativeEvent.pageY}
              onTouchEnd={(e) => {
                if (e.nativeEvent.pageY - addonsTouchY.current > 80) {
                  setSelectedAddonDetail(null);
                }
              }}
            >
              <AnimatedGradientBorder
                borderRadius={20}
                borderWidth={2}
                animationSpeed={3}
                style={{ flex: 1 }}
              >
                <View style={{ flex: 1, backgroundColor: theme.background, borderRadius: 20, overflow: 'hidden' }}>
                  {/* Close Button absolute top right */}
                  <Pressable
                    onPress={() => setSelectedAddonDetail(null)}
                    style={{
                      position: 'absolute',
                      top: 20,
                      right: 20,
                      zIndex: 10,
                      backgroundColor: 'rgba(0,0,0,0.5)',
                      borderRadius: 20,
                      width: 36,
                      height: 36,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>✕</Text>
                  </Pressable>

                  <ScrollView 
                  style={{ flex: 1 }} 
                  scrollEventThrottle={16} 
                  showsVerticalScrollIndicator={false} 
                  decelerationRate="normal"
                  onScroll={(e) => {
                    if (e.nativeEvent.contentOffset.y < -60) {
                      setSelectedAddonDetail(null);
                    }
                  }}
                  onScrollEndDrag={(e) => {
                    if (e.nativeEvent.contentOffset.y <= 0 && e.nativeEvent.velocity && e.nativeEvent.velocity.y > 1.5) {
                      setSelectedAddonDetail(null);
                    }
                  }}
                >
                    {/* Full Image */}
                    <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
                      {selectedAddonDetail.image && selectedAddonDetail.image.trim() !== '' ? (
                        <Image
                          source={{ uri: selectedAddonDetail.image }}
                          style={{ width: "100%", height: 280, borderRadius: 16 }}
                          resizeMode="cover"
                        />
                      ) : (
                        <View
                          style={{
                            width: "100%",
                            height: 200,
                            backgroundColor: theme.surfaceVariant,
                            alignItems: "center",
                            justifyContent: "center",
                            borderRadius: 16,
                          }}
                        >
                          <Text style={{ color: theme.textLight }}>{t("serviceDetail.noImage")}</Text>
                        </View>
                      )}
                    </View>

                    <View style={{ padding: 20 }}>
                      <Text style={{ fontSize: 24, fontWeight: "800", color: theme.text }}>{selectedAddonDetail.title}</Text>
                      <Text style={{ fontSize: 14, color: theme.textLight, marginTop: 4 }}>{selectedAddonDetail.duration} mins • {selectedAddonDetail.service_type || 'Add-on'}</Text>

                      {/* Description */}
                      {selectedAddonDetail.description && (
                        <>
                          <Text style={{ fontSize: 18, fontWeight: "700", marginTop: 24, color: theme.text }}>Description</Text>
                          <Text style={{ fontSize: 15, lineHeight: 22, marginTop: 8, color: theme.text }}>{selectedAddonDetail.description}</Text>
                        </>
                      )}

                      {/* Work Includes */}
                      {selectedAddonDetail.work_includes && selectedAddonDetail.work_includes.trim() ? (
                        <>
                          <Text style={{ fontSize: 18, fontWeight: "700", marginTop: 24, color: COLORS.saffron }}>Work Includes</Text>
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
                    </View>
                  </ScrollView>

                  {/* Pinned Bottom Area: Price and Add Button */}
                  <View style={{
                    padding: 20,
                    paddingBottom: Math.max(insets.bottom, 20),
                    borderTopWidth: 1,
                    borderTopColor: theme.border,
                    backgroundColor: theme.background
                  }}>
                    <PriceRow
                      price={selectedAddonDetail.price}
                      original_price={selectedAddonDetail.original_price}
                      discount_percent={selectedAddonDetail.discount_percent}
                    />

                    {/* Action Button */}
                    {selectedServices.find(
                      (s) => s.id === selectedAddonDetail.id
                    ) ? (
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                          backgroundColor: theme.surfaceVariant,
                          borderRadius: 10,
                          paddingHorizontal: 20,
                          paddingVertical: 14,
                          marginTop: 15,
                        }}
                      >
                        <Pressable
                          onPress={() => decrementAddon(selectedAddonDetail.id)}
                          style={{
                            paddingHorizontal: 20,
                            paddingVertical: 8,
                          }}
                        >
                          <Text style={{ fontSize: 24, fontWeight: "700", color: theme.text }}>
                            -
                          </Text>
                        </Pressable>

                        <Text style={{ fontSize: 18, fontWeight: "700", color: theme.text }}>
                          {selectedServices.find((s) => s.id === selectedAddonDetail.id)?.quantity || 1}
                        </Text>

                        <Pressable
                          onPress={() => addAddonToCart(selectedAddonDetail)}
                          style={{
                            paddingHorizontal: 20,
                            paddingVertical: 8,
                          }}
                          disabled={(selectedServices.find((s) => s.id === selectedAddonDetail.id)?.quantity || 1) >= 3}
                        >
                          <Text
                            style={{
                              fontSize: 24,
                              fontWeight: "700",
                              color: (selectedServices.find((s) => s.id === selectedAddonDetail.id)?.quantity || 1) >= 3 ? theme.textLight : theme.text
                            }}
                          >
                            +
                          </Text>
                        </Pressable>
                      </View>
                    ) : (
                      <Pressable
                        onPress={() => addAddonToCart(selectedAddonDetail)}
                        style={{
                          backgroundColor: COLORS.saffron,
                          paddingVertical: 14,
                          borderRadius: 10,
                          alignItems: "center",
                          marginTop: 15,
                        }}
                      >
                        <Text
                          style={{
                            color: "#000",
                            fontWeight: "800",
                            fontSize: 16,
                          }}
                        >
                          + Add
                        </Text>
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

