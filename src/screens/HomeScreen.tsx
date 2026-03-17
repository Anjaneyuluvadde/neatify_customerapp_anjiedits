import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  ImageSourcePropType,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import CategoryTabs from "../components/CategoryTabs";
import Header from "../components/Header";
import ServiceCard from "../components/ServiceCard";
import AnimatedGradientBorder from "../components/AnimatedGradientBorder";
import { useLanguage } from "../context/LanguageContext";
import { useTheme } from "../context/ThemeContext"; // @ts-ignore
import { supabase, SUPABASE_URL } from "../lib/supabase";
import { COLORS } from "../theme/colors";
import { Service } from "../types/service";

const { width, height } = Dimensions.get("window");
const SLIDER_HEIGHT = height * 0.22; // Slightly reduced for better fit

// ✅ Fuzzy Search Helper (Levenshtein Distance)
const getLevenshteinDistance = (a: string, b: string) => {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
};

// ✅ Module-level flag: only show popup once per app session
let hasShownPopupThisSession = false;

export default function HomeScreen({ navigation }: any) {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const [services, setServices] = useState<Service[]>([]);
  const [activeCategory, setActiveCategory] = useState("BATHROOM");
  const [searchText, setSearchText] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // ✅ Hero banners state
  const [heroBanners, setHeroBanners] = useState<ImageSourcePropType[]>([]);

  // ✅ Refs
  const sliderRef = useRef<FlatList>(null);
  const pagerRef = useRef<FlatList>(null);
  const isProgrammaticScroll = useRef(false);
  const popupSliderRef = useRef<FlatList>(null);

  const [currentSlide, setCurrentSlide] = useState(0);
  const [isUserSwiping, setIsUserSwiping] = useState(false);

  // ✅ Popup state
  const POPUP_WIDTH = Math.min(width - 48, 360);
  const [popupType, setPopupType] = useState<"APP_POPUP" | "OFFERS" | null>(null);
  const [appPopups, setAppPopups] = useState<{ title: string; description: string | null; image_url: string | null }[]>([]);
  const [popupIndex, setPopupIndex] = useState(0);
  const [activeOffers, setActiveOffers] = useState<{ service_type: string; title: string; offer_percentage: number; description: string | null }[]>([]);
  const [showPopup, setShowPopup] = useState(false);

  useEffect(() => {
    fetchServices();
    fetchHeroBanners();
    fetchPopups();
  }, []);

  const fetchServices = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("services").select("*");

    if (error) {
      console.log("Supabase error:", error);
      setLoading(false);
      return;
    }

    let serviceList = data || [];

    // ✅ Fetch active offers
    const { data: offersData } = await supabase
      .from("offers")
      .select("title, offer_percentage")
      .eq("is_offer_enabled", true);

    if (offersData && offersData.length > 0) {
      serviceList = serviceList.map((svc: any) => {
        const matchingOffer = offersData.find(
          (o) => o.title.toLowerCase() === svc.title.toLowerCase()
        );
        if (matchingOffer && matchingOffer.offer_percentage > 0) {
          const cleanedOriginal = String(svc.original_price ?? '').replace(/[^\d.]/g, '');
          const basePrice =
            svc.original_price && cleanedOriginal && Number(cleanedOriginal) > 0
              ? Number(cleanedOriginal)
              : parseFloat(String(svc.price).replace(/[^\d.]/g, ""));
          const discountedPrice = Math.round(
            basePrice - (basePrice * matchingOffer.offer_percentage) / 100
          );
          return {
            ...svc,
            price: `₹${discountedPrice}`,
            original_price: basePrice.toString(),
            discount_label: `${matchingOffer.offer_percentage}% OFF`,
            discount_percent: matchingOffer.offer_percentage,
          };
        }
        return svc;
      });
    }

    setServices(serviceList);
    setLoading(false);
  };

  const fetchHeroBanners = async () => {
    const { data, error } = await supabase
      .from("hero_banners")
      .select("image_path")
      .eq("is_active", true)
      .order("priority", { ascending: true });

    const fallbackBanners: ImageSourcePropType[] = [
      require("../../assets/images/1.png"),
      require("../../assets/images/2.png"),
      require("../../assets/images/3.png"),
    ];

    if (error) {
      setHeroBanners(fallbackBanners);
      return;
    }

    if (data && data.length > 0) {
      const bannerUrls = data.map(
        (banner) => ({ uri: `${SUPABASE_URL}/storage/v1/object/public/hero-images/${banner.image_path}` })
      );
      setHeroBanners(bannerUrls);
      return;
    }
    setHeroBanners(fallbackBanners);
  };

  const fetchPopups = async () => {
    if (hasShownPopupThisSession) return;

    const { data: popupData } = await supabase
      .from("app_popups")
      .select("*")
      .eq("is_active", true);

    if (popupData && popupData.length > 0) {
      setAppPopups(popupData);
      setPopupType("APP_POPUP");
      setShowPopup(true);
      hasShownPopupThisSession = true;
      return;
    }

    const { data: offersData } = await supabase
      .from("offers")
      .select("*")
      .eq("is_offer_enabled", true);

    if (offersData && offersData.length > 0) {
      setActiveOffers(offersData);
      setPopupType("OFFERS");
      setShowPopup(true);
      hasShownPopupThisSession = true;
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchServices(), fetchHeroBanners(), fetchPopups()]);
    setRefreshing(false);
  };

  const tabs = useMemo(() => {
    const categoryMap = new Map<string, number>();
    services.forEach((s) => {
      if (s.service_type && !categoryMap.has(s.service_type)) {
        categoryMap.set(s.service_type, s.category_order ?? 999);
      }
    });

    const sorted = Array.from(categoryMap.entries()).sort((a, b) => a[1] - b[1]);

    return [
      ...sorted.map(([type]) => ({
        label: type.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        value: type,
      })),
      { label: t("home.allServices"), value: "ALL" },
    ];
  }, [services, t]);

  const getServicesForCategory = useCallback(
    (categoryValue: string) => {
      const search = (searchText ?? "").trim().toLowerCase();
      return services.filter((service) => {
        const matchesCategory = categoryValue === "ALL" || service.service_type === categoryValue;
        if (!matchesCategory) return false;
        if (search.length === 0) return true;

        const title = (service.title ?? "").toLowerCase();
        const type = (service.service_type ?? "").toLowerCase();
        
        if (title.includes(search) || type.includes(search)) return true;
        if (search.length > 3 && getLevenshteinDistance(search, type) <= 2) return true;
        return false;
      }).sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999));
    },
    [services, searchText]
  );

  const handleCategoryChange = useCallback(
    (value: string) => {
      setActiveCategory(value);
      const idx = tabs.findIndex((t) => t.value === value);
      if (idx >= 0 && pagerRef.current) {
        isProgrammaticScroll.current = true;
        pagerRef.current.scrollToIndex({ index: idx, animated: true });
        setTimeout(() => { isProgrammaticScroll.current = false; }, 400);
      }
    },
    [tabs]
  );

  const onPagerScrollEnd = useCallback(
    (e: any) => {
      if (isProgrammaticScroll.current) return;
      const idx = Math.round(e.nativeEvent.contentOffset.x / width);
      if (tabs[idx]) setActiveCategory(tabs[idx].value);
    },
    [tabs]
  );

  const renderCategoryPage = useCallback(
    ({ item: tab }: { item: { label: string; value: string } }) => {
      const pageServices = getServicesForCategory(tab.value);
      return (
        <View style={{ width }}>
          {pageServices.length === 0 ? (
            <View style={{ marginTop: 60, alignItems: "center" }}>
              <Ionicons name="search-outline" size={40} color={theme.textMuted} />
              <Text style={{ marginTop: 12, color: theme.textMuted, fontSize: 16 }}>{t("home.noResults")}</Text>
            </View>
          ) : (
            <FlatList
              data={pageServices}
              keyExtractor={(s) => s.id}
              numColumns={2}
              scrollEnabled={false}
              renderItem={({ item }) => (
                <ServiceCard service={item} onPress={() => navigation.navigate("ServiceDetail", { service: item })} />
              )}
              contentContainerStyle={{ padding: 8, paddingBottom: 16 }}
            />
          )}
        </View>
      );
    },
    [getServicesForCategory, navigation, t, theme]
  );

  const activeCategoryServices = getServicesForCategory(activeCategory);
  const CARD_ROW_HEIGHT = 350; // Better estimation for service cards
  const serviceRows = Math.max(1, Math.ceil(activeCategoryServices.length / 2));
  const pagerHeight = activeCategoryServices.length === 0 ? 250 : serviceRows * CARD_ROW_HEIGHT + 32;

  // Auto-slide effect
  useEffect(() => {
    if (heroBanners.length <= 1) return;
    const interval = setInterval(() => {
      if (!isUserSwiping) {
        setCurrentSlide((prev) => {
          const next = (prev + 1) % heroBanners.length;
          sliderRef.current?.scrollToIndex({ index: next, animated: true });
          return next;
        });
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [heroBanners.length, isUserSwiping]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={["top"]}>
      <StatusBar barStyle={theme.background === "#FFFFFF" ? "dark-content" : "light-content"} />

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={COLORS.saffron} /></View>
      ) : (
        <ScrollView
          stickyHeaderIndices={[heroBanners.length > 0 ? 2 : 1]} // Dynamic sticky index
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.primary}
              colors={[theme.primary]}
              progressBackgroundColor={theme.background}
            />
          }
          contentContainerStyle={{ flexGrow: 1, backgroundColor: theme.background, paddingBottom: 100 }}
        >
          {/* 1. Header (Logo + Search) */}
          <Header
            searchText={searchText}
            onSearchChange={(text) => {
              setSearchText(text);
              const match = tabs.find(t => t.value !== "ALL" && t.label.toLowerCase() === text.trim().toLowerCase());
              if (match) handleCategoryChange(match.value);
            }}
          />

          {/* 2. Hero Slider */}
          {heroBanners.length > 0 && (
            <View style={{ height: SLIDER_HEIGHT, marginHorizontal: 12, marginTop: 8, borderRadius: 20, overflow: "hidden", backgroundColor: theme.surfaceVariant }}>
              <FlatList
                ref={sliderRef}
                data={heroBanners}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={(e) => setCurrentSlide(Math.round(e.nativeEvent.contentOffset.x / (width - 44)))}
                onScrollBeginDrag={() => setIsUserSwiping(true)}
                onScrollEndDrag={() => setIsUserSwiping(false)}
                renderItem={({ item }) => (
                  <View style={{ width: width - 44, height: SLIDER_HEIGHT }}>
                    <Image source={item} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                  </View>
                )}
              />
              <View style={styles.dots} pointerEvents="none">
                {heroBanners.map((_, i) => (
                  <View key={i} style={[styles.dot, { backgroundColor: currentSlide === i ? "#fff" : "rgba(255,255,255,0.4)", width: currentSlide === i ? 20 : 8 }]} />
                ))}
              </View>
            </View>
          )}

          {/* 3. Category Tabs (Sticky) */}
          <CategoryTabs activeTab={activeCategory} onChange={handleCategoryChange} tabs={tabs} />

          {/* 4. Title Heading */}
          <View style={[styles.titleRow, { backgroundColor: theme.background }]}>
            <View style={styles.titleBar} />
            <Text style={[styles.titleText, { color: theme.text }]}>
              {activeCategory === "ALL" ? t("home.allServices") : tabs.find(t => t.value === activeCategory)?.label ?? "Services"}
            </Text>
          </View>

          {/* 5. Horizontal Pager with nested non-scrolling service lists */}
          <View style={{ height: pagerHeight }}>
            <FlatList
              ref={pagerRef}
              data={tabs}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={onPagerScrollEnd}
              renderItem={renderCategoryPage}
              initialScrollIndex={tabs.findIndex(t => t.value === activeCategory)}
              getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
            />
          </View>
        </ScrollView>
      )}

      {/* Popups (Festive & Offers) */}
      <Modal visible={showPopup && !!popupType} transparent animationType="fade">
        <View style={popupStyles.overlay}>
          <AnimatedGradientBorder borderRadius={20} borderWidth={2} animationSpeed={3} style={{ width: popupType === "APP_POPUP" ? POPUP_WIDTH : "90%" }}>
            <View style={[popupStyles.container, { backgroundColor: theme.background }]}>
              <Pressable style={popupStyles.closeBtn} onPress={() => setShowPopup(false)}>
                <Ionicons name="close" size={22} color="#fff" />
              </Pressable>

              {popupType === "APP_POPUP" ? (
                <View>
                  <FlatList
                    ref={popupSliderRef}
                    data={appPopups}
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    onMomentumScrollEnd={(e) => setPopupIndex(Math.round(e.nativeEvent.contentOffset.x / POPUP_WIDTH))}
                    renderItem={({ item }) => (
                      <View style={{ width: POPUP_WIDTH }}>
                        {item.image_url ? <Image source={{ uri: item.image_url }} style={popupStyles.appImage} /> : <View style={[popupStyles.appImage, { backgroundColor: theme.surfaceVariant }]} />}
                        <View style={popupStyles.appContent}>
                          <Text style={[popupStyles.appTitle, { color: theme.text }]}>{item.title}</Text>
                          {item.description && <Text style={[popupStyles.appDesc, { color: theme.textLight }]}>{item.description}</Text>}
                        </View>
                      </View>
                    )}
                  />
                  {appPopups.length > 1 && (
                    <View style={popupStyles.dotsRow}>
                      {appPopups.map((_, i) => <View key={i} style={[popupStyles.pDot, i === popupIndex && { backgroundColor: theme.primary, width: 18 }]} />)}
                    </View>
                  )}
                </View>
              ) : (
                <View style={popupStyles.offersView}>
                  <View style={[popupStyles.offHeader, { backgroundColor: theme.primary }]}>
                    <Text style={popupStyles.offHeaderText}>🎉 Special Offers</Text>
                  </View>
                  {activeOffers.map((off, i) => (
                    <Pressable key={i} style={[popupStyles.offItem, { borderBottomColor: theme.border }]} onPress={() => { setShowPopup(false); navigation.navigate("ServiceDetail", { service: services.find(s => s.title === off.title) }) }}>
                      <View style={{ flex: 1 }}>
                        <Text style={popupStyles.offType}>{off.service_type}</Text>
                        <Text style={[popupStyles.offTitle, { color: theme.text }]}>{off.title}</Text>
                      </View>
                      <View style={[popupStyles.offBadge, { backgroundColor: theme.primary + "20", borderColor: theme.primary }]}><Text style={{ color: theme.primary, fontWeight: '800' }}>{off.offer_percentage}% OFF</Text></View>
                    </Pressable>
                  ))}
                  <Pressable style={[popupStyles.footerBtn, { backgroundColor: theme.primary }]} onPress={() => setShowPopup(false)}><Text style={{ fontWeight: '700' }}>Browse Services</Text></Pressable>
                </View>
              )}
            </View>
          </AnimatedGradientBorder>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  dots: { position: "absolute", bottom: 12, alignSelf: "center", flexDirection: "row", gap: 6 },
  dot: { height: 8, borderRadius: 4 },
  titleRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  titleBar: { width: 4, height: 22, backgroundColor: COLORS.saffron, borderRadius: 2 },
  titleText: { fontSize: 20, fontWeight: "800" },
});

const popupStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center" },
  container: { borderRadius: 20, overflow: "hidden" },
  closeBtn: { position: "absolute", top: 12, right: 12, zIndex: 20, backgroundColor: "rgba(0,0,0,0.4)", borderRadius: 20, padding: 4 },
  appImage: { width: "100%", height: 200 },
  appContent: { padding: 20, alignItems: "center" },
  appTitle: { fontSize: 18, fontWeight: "800", textAlign: "center" },
  appDesc: { fontSize: 13, textAlign: "center", marginTop: 6, lineHeight: 18 },
  dotsRow: { flexDirection: "row", justifyContent: "center", paddingBottom: 16, gap: 6 },
  pDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#ccc" },
  offersView: { width: "100%" },
  offHeader: { padding: 16, alignItems: "center" },
  offHeaderText: { fontSize: 18, fontWeight: "800", color: "#000" },
  offItem: { flexDirection: "row", padding: 16, borderBottomWidth: 1, alignItems: "center" },
  offType: { fontSize: 10, color: "#999", fontWeight: "700" },
  offTitle: { fontSize: 14, fontWeight: "700", marginTop: 2 },
  offBadge: { padding: 6, borderRadius: 8, borderWidth: 1 },
  footerBtn: { margin: 16, paddingVertical: 14, borderRadius: 12, alignItems: "center" },
});
