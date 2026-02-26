
import { Ionicons } from "@expo/vector-icons";
import { RouteProp, useNavigation } from "@react-navigation/native";
import React, { useEffect, useMemo, useState } from "react";
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  Share,
  Text,
  View
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import Header from "../components/Header";
import { useLanguage } from "../context/LanguageContext";
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
  original_price?: number | null;
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
  price: number;
  image?: string | null;
  service_type?: string;
  description?: string;
  sort_order?: number;
  original_price?: number | null;
  discount_percent?: number | null;
  work_includes?: string[] | null; // text[] in db
  discount_label?: string | null;
  tax_percent?: number | null;
};

/* ================= COMPONENT ================= */

export default function ServiceDetailScreen({ route }: Props) {
  const navigation = useNavigation<any>();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const { service: paramService, serviceId } = route.params;

  const [service, setService] = useState<Service | null>(paramService || null);
  const [loadingService, setLoadingService] = useState(!paramService && !!serviceId);

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
  useEffect(() => {
    // Fetch Services (keeping existing logic though Add Another Service is removed from UI, might be useful later)
    supabase
      .from("services")
      .select(
        "id, title, service_type, duration, price, original_price, discount_percent, discount_label, tax_percent, image, sort_order, description, gallery_images"
      )
      .then(({ data }) => {
        if (data) setAvailableServices(data as Service[]);
      });

    // Fetch Add-ons
    supabase
      .from("add_ons")
      .select("*")
      .order("sort_order", { ascending: true })
      .then(({ data, error }) => {
        if (error) console.error("Error fetching addons:", error);
        if (data) setAddons(data as AddOn[]);
      });
  }, []);

  /* ================= FETCH SERVICE IF NEEDED ================= */
  useEffect(() => {
    if (!service && serviceId) {
      setLoadingService(true);

      const fetchBySlug = async () => {
        const { data, error } = await supabase
          .from("services")
          .select(
            "id, slug, title, service_type, duration, price, original_price, discount_percent, discount_label, tax_percent, image, sort_order, description, gallery_images, work_includes"
          )
          .eq("slug", serviceId)
          .maybeSingle();
        return { data, error };
      };

      const fetchById = async () => {
        const { data, error } = await supabase
          .from("services")
          .select(
            "id, slug, title, service_type, duration, price, original_price, discount_percent, discount_label, tax_percent, image, sort_order, description, gallery_images, work_includes"
          )
          .eq("id", serviceId)
          .maybeSingle();
        return { data, error };
      };

      const init = async () => {
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
      };

      init();
    }
  }, [serviceId, service]);

  /* ================= FETCH ACTIVE OFFER ================= */
  useEffect(() => {
    if (!service) return;

    const fetchOffer = async () => {
      const { data: offerData } = await supabase
        .from("offers")
        .select("offer_percentage")
        .eq("title", service.title)
        .eq("is_offer_enabled", true)
        .maybeSingle();

      if (offerData && offerData.offer_percentage > 0) {
        setActiveOfferPercent(offerData.offer_percentage);
      } else {
        setActiveOfferPercent(null);
      }
    };

    fetchOffer();
  }, [service]);

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
        const basePrice = effectiveOriginalPrice && Number(effectiveOriginalPrice) > 0
          ? Number(effectiveOriginalPrice)
          : parseFloat(String(service.price).replace(/[^\d.]/g, ""));

        const discountedPrice = Math.round(basePrice - (basePrice * activeOfferPercent / 100));
        effectivePrice = discountedPrice.toString();
        effectiveLabel = `${activeOfferPercent}% OFF`;
        effectiveOriginalPrice = basePrice;
        effectiveDiscountPercent = activeOfferPercent;
      }

      setSelectedServices([
        {
          id: service.id,
          title: service.title,
          duration: service.duration,
          price: effectivePrice,
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
      const url = `https://neatify-version2-hosting.vercel.app/service/${identifier}`;

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
      // If already added, increment quantity (max 3)
      if ((existingAddon.quantity || 1) >= 3) {
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
        price: addon.price.toString(),
        original_price: addon.original_price,
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

  // Filter out addons that are already selected
  // ✅ CHANGED: We now show ALL addons, but mark selected ones as "Added"
  const availableAddons = useMemo(() => {
    return addons;
  }, [addons]);

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
    Number((service as any)?.original_price) > 0;

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
              color: "#777",
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
            color: "#000",
          }}
        >
          {displayRupee(price)}
        </Text>

        {/* ✅ BADGE - SHOWN LAST */}
        {(percentText || discount_percent > 0) && (
          <View
            style={{
              backgroundColor: "#E9F7EF",
              paddingHorizontal: 10,
              paddingVertical: badgePaddingV,
              borderRadius: 22,
            }}
          >
            <Text
              style={{
                color: "#1E7E34",
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
      <SafeAreaView style={{ flex: 1, backgroundColor: "#fff", justifyContent: 'center', alignItems: 'center' }}>
        <Text>{t("common.loading")}</Text>
      </SafeAreaView>
    );
  }

  if (!service) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#fff", justifyContent: 'center', alignItems: 'center' }}>
        <Text>{t("serviceDetail.notFound")}</Text>
        <Pressable onPress={() => navigation.goBack()} style={{ marginTop: 20, padding: 10 }}>
          <Text style={{ color: 'blue' }}>{t("serviceDetail.goBack")}</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }} edges={["top"]}>
      <Header />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* BACK BUTTON */}
        <Pressable
          onPress={() => navigation.goBack()}
          style={{
            position: "absolute",
            top: 16,
            left: 16,
            zIndex: 10,
            backgroundColor: "rgba(255, 255, 255, 0.9)",
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
          <Ionicons name="arrow-back" size={24} color="#000" />
        </Pressable>

        {/* SHARE BUTTON */}
        <Pressable
          onPress={handleShare}
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            zIndex: 10,
            backgroundColor: "rgba(255, 255, 255, 0.9)",
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
          <Ionicons name="share-social-outline" size={22} color="#000" />
        </Pressable>

        {/* IMAGE */}
        <Image
          source={{ uri: service.image }}
          style={{ width: "100%", height: 240 }}
          resizeMode="cover"
        />

        {/* CONTENT */}
        <View style={{ padding: 16 }}>
          <Text style={{ fontSize: 26, fontWeight: "800", color: "#000" }}>
            {service.title}
          </Text>

          {/* ✅ Duration */}
          <Text style={{ marginTop: 6, color: COLORS.textLight, fontSize: 14 }}>
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
                  color: "#000",
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
                    color: "#000",
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
                        color: "#000",
                        marginRight: 8,
                      }}
                    >
                      •
                    </Text>
                    <Text
                      style={{
                        fontSize: 15,
                        lineHeight: 22,
                        color: "#000",
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
                  color: "#000",
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
        <Modal visible={showSummary} transparent animationType="fade" statusBarTranslucent={true}>
          <View
            style={{
              flex: 1,
              backgroundColor: "rgba(0,0,0,0.55)",
              justifyContent: "center",
            }}
          >
            <View
              style={{
                backgroundColor: "#fff",
                margin: 20,
                borderRadius: 14,
                padding: 20,
                maxHeight: "80%", // Prevent overflow
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <Text style={{ fontSize: 18, fontWeight: "800" }}>
                  {t("schedule.summary")}
                </Text>
                <Pressable onPress={() => setShowSummary(false)}>
                  <Text style={{ fontSize: 18 }}>✕</Text>
                </Pressable>
              </View>

              <ScrollView style={{ maxHeight: 300, marginTop: 14 }}>
                {selectedServices.map((s) => (
                  <View
                    key={s.id}
                    style={{
                      paddingVertical: 10,
                      borderBottomWidth: 0.5,
                      borderBottomColor: "#ddd",
                    }}
                  >
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontWeight: "800", fontSize: 16 }}>
                          {s.title}
                          {s.quantity && s.quantity > 1 ? ` (x${s.quantity})` : ""}
                        </Text>
                        <Text style={{ marginTop: 4, color: COLORS.textLight }}>
                          {s.duration}
                        </Text>

                        {/* ✅ Calculate price based on quantity */}
                        <PriceRow
                          price={(parseFloat(formatPrice(s.price)) * (s.quantity || 1)).toString()}
                          original_price={s.original_price ? Number(s.original_price) * (s.quantity || 1) : null}
                          discount_percent={s.discount_percent}
                          percentText={(s as any)?.discount_label}
                          size="small"
                        />
                      </View>
                    </View>

                    {/* Show remove only if it's NOT the main service */}
                    {s.id !== service.id && (
                      <Pressable onPress={() => removeService(s.id)}>
                        <Text
                          style={{ marginTop: 8, color: "red", fontSize: 12 }}
                        >
                          {t("schedule.remove")}
                        </Text>
                      </Pressable>
                    )}
                  </View>
                ))}
              </ScrollView>

              {/* ✅ ADDONS BUTTON (Replaces Add Another Service) */}
              {/* ✅ ADDONS BUTTON (Replaces Add Another Service) */}
              {/* Only show for services that are NOT Deep Cleaning */}
              {service.service_type !== "DEEP CLEANING" &&
                service.service_type !== "Deep Cleaning" && (
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
                    <Text style={{ fontWeight: "800" }}>{"+ " + t("serviceDetail.addOns")}</Text>
                  </Pressable>
                )}

              <Pressable
                onPress={() => {
                  setShowSummary(false);
                  navigation.navigate("Schedule", {
                    services: selectedServices,
                  });
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
                <Text style={{ fontSize: 20, fontWeight: "800" }}>{t("serviceDetail.addOns")}</Text>
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
                {availableAddons.length === 0 ? (
                  <Text style={{ textAlign: "center", marginTop: 20, color: "#888" }}>
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
                            <Text style={{ color: "#ccc" }}>{t("serviceDetail.noImage")}</Text>
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

                            <PriceRow
                              price={addon.price}
                              original_price={addon.original_price}
                              discount_percent={addon.discount_percent}
                              size="small"
                            />
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
                                e.stopPropagation(); // Prevent card click
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
                                  {selectedServices.find((s) => s.id === addon.id)?.quantity || 1}
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
                                  disabled={(selectedServices.find((s) => s.id === addon.id)?.quantity || 1) >= 3}
                                >
                                  <Text
                                    style={{
                                      fontSize: 18,
                                      fontWeight: "700",
                                      color: (selectedServices.find((s) => s.id === addon.id)?.quantity || 1) >= 3 ? "#ccc" : "#000"
                                    }}
                                  >
                                    +
                                  </Text>
                                </Pressable>
                              </View>
                            ) : (
                              <Pressable
                                onPress={(e) => {
                                  e.stopPropagation(); // Prevent card click
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
          <Modal
            visible={!!selectedAddonDetail}
            transparent
            animationType="slide"
            onRequestClose={() => setSelectedAddonDetail(null)}
            statusBarTranslucent={true}
          >
            <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }} edges={["top", "bottom"]}>
              {/* Close Button absolute top right */}
              <Pressable
                onPress={() => setSelectedAddonDetail(null)}
                style={{
                  position: 'absolute',
                  top: Math.max(insets.top, 20),
                  right: 20,
                  zIndex: 10,
                  backgroundColor: 'rgba(0,0,0,0.5)',
                  borderRadius: 20,
                  width: 36,
                  height: 36,
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>✕</Text>
              </Pressable>

              <ScrollView>
                {/* Full Image */}
                {selectedAddonDetail.image && selectedAddonDetail.image.trim() !== '' ? (
                  <Image
                    source={{ uri: selectedAddonDetail.image }}
                    style={{ width: "100%", height: 280, borderRadius: 8 }}
                    resizeMode="cover"
                  />
                ) : (
                  <View
                    style={{
                      width: "100%",
                      height: 200,
                      backgroundColor: "#f0f0f0",
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: 8,
                    }}
                  >
                    <Text style={{ color: "#ccc" }}>{t("serviceDetail.noImage")}</Text>
                  </View>
                )}

                <View style={{ padding: 20 }}>
                  <Text style={{ fontSize: 24, fontWeight: "800" }}>{selectedAddonDetail.title}</Text>
                  <Text style={{ fontSize: 14, color: "#666", marginTop: 4 }}>{selectedAddonDetail.duration} mins • {selectedAddonDetail.service_type || 'Add-on'}</Text>

                  <View style={{ marginTop: 10 }}>
                    <PriceRow
                      price={selectedAddonDetail.price}
                      original_price={selectedAddonDetail.original_price}
                      discount_percent={selectedAddonDetail.discount_percent}
                    />
                  </View>

                  {/* Action Button */}
                  {selectedServices.find(
                    (s) => s.id === selectedAddonDetail.id
                  ) ? (
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        backgroundColor: "#f0f0f0",
                        borderRadius: 10,
                        paddingHorizontal: 20,
                        paddingVertical: 14,
                        marginTop: 20,
                      }}
                    >
                      <Pressable
                        onPress={() => decrementAddon(selectedAddonDetail.id)}
                        style={{
                          paddingHorizontal: 20,
                          paddingVertical: 8,
                        }}
                      >
                        <Text style={{ fontSize: 24, fontWeight: "700", color: "#000" }}>
                          -
                        </Text>
                      </Pressable>

                      <Text style={{ fontSize: 18, fontWeight: "700", color: "#000" }}>
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
                            color: (selectedServices.find((s) => s.id === selectedAddonDetail.id)?.quantity || 1) >= 3 ? "#ccc" : "#000"
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
                        marginTop: 20,
                      }}
                    >
                      <Text
                        style={{
                          color: "#000",
                          fontWeight: "700",
                          fontSize: 16,
                        }}
                      >
                        + Add to Booking
                      </Text>
                    </Pressable>
                  )}

                  {/* Description */}
                  {selectedAddonDetail.description && (
                    <>
                      <Text style={{ fontSize: 18, fontWeight: "700", marginTop: 24, color: COLORS.black }}>Description</Text>
                      <Text style={{ fontSize: 15, lineHeight: 22, marginTop: 8, color: "#333" }}>{selectedAddonDetail.description}</Text>
                    </>
                  )}

                  {/* Work Includes */}
                  {selectedAddonDetail.work_includes && selectedAddonDetail.work_includes.length > 0 && (
                    <>
                      <Text style={{ fontSize: 18, fontWeight: "700", marginTop: 24, color: COLORS.saffron }}>Work Includes</Text>
                      {selectedAddonDetail.work_includes.map((work, idx) => (
                        <View key={idx} style={{ flexDirection: "row", marginTop: 8 }}>
                          <Text style={{ marginRight: 8, fontSize: 15 }}>•</Text>
                          <Text style={{ fontSize: 15, flex: 1, lineHeight: 22 }}>{work}</Text>
                        </View>
                      ))}
                    </>
                  )}
                </View>
              </ScrollView>
            </SafeAreaView>
          </Modal>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

