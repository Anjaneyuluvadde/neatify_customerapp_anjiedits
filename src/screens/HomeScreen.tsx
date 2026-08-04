import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useIsFocused } from "@react-navigation/native";
import { Image } from "expo-image";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Clipboard,
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
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import AnimatedGradientBorder from "../components/AnimatedGradientBorder";
import Header from "../components/Header";
import ServiceCard from "../components/ServiceCard";
import WhyChooseUs from "../components/WhyChooseUs";
import { useLanguage } from "../context/LanguageContext";
import { useTheme } from "../context/ThemeContext"; // @ts-ignore
import { useNotification } from "../hooks/useNotification";
import { supabase, SUPABASE_URL } from "../lib/supabase";
import { COLORS } from "../theme/colors";
import { MainCategory, Service } from "../types/service";
import { setClaimedOffer } from "../utils/priceUtils";

const { width, height } = Dimensions.get("window");
const SLIDER_HEIGHT = height * 0.25; // Increased height to reduce empty space

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
  const [mainCategories, setMainCategories] = useState<MainCategory[]>([]);
  const [activeMainCategory, setActiveMainCategory] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState("ALL");
  const [measuredHeights, setMeasuredHeights] = useState<{ [key: string]: number }>({});
  const [searchText, setSearchText] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // ✅ Hero banners state
  const [heroBanners, setHeroBanners] = useState<ImageSourcePropType[]>([]);

  // ✅ Refs
  const sliderRef = useRef<FlatList>(null);
  const pagerRef = useRef<FlatList>(null);
  const scrollRef = useRef<ScrollView>(null); // Main ScrollView ref
  const isProgrammaticScroll = useRef(false);
  const [showGoUp, setShowGoUp] = useState(false);
  const popupSliderRef = useRef<FlatList>(null);

  const [currentSlide, setCurrentSlide] = useState(0);
  const [isUserSwiping, setIsUserSwiping] = useState(false);
  const [servicesY, setServicesY] = useState(0); // Store Y position of services section

  // ✅ Popup state
  const POPUP_WIDTH = Math.min(width - 48, 360);
  const [popupType, setPopupType] = useState<"APP_POPUP" | "OFFERS" | null>(null);
  const [appPopups, setAppPopups] = useState<{ title: string; description: string | null; image_url: string | null }[]>([]);
  const [popupIndex, setPopupIndex] = useState(0);
  const [activeOffers, setActiveOffers] = useState<{ service_type: string; title: string; offer_percentage: number; description: string | null }[]>([]);
  const [showPopup, setShowPopup] = useState(false);
  const { showToast } = useNotification();

  // ✅ Welcome Reward Popup state
  const [showWelcomePopup, setShowWelcomePopup] = useState(false);
  const [welcomeCoupon, setWelcomeCoupon] = useState("");

  const checkWelcomeReward = useCallback(async () => {
    try {
      // Safely get the session without forcing a stressful backend refresh
      const { data: { session }, error: refreshError } = await supabase.auth.getSession();
      if (refreshError) throw refreshError;

      const user = session?.user;
      console.log("🔍 Checking Welcome Reward metadata...");

      if (user?.user_metadata?.show_welcome_reward && user?.user_metadata?.welcome_coupon_code) {
        console.log("🎁 Welcome Reward detected!", user.user_metadata.welcome_coupon_code);
        setWelcomeCoupon(user.user_metadata.welcome_coupon_code);

        // Short delay to ensure other UI is ready
        setTimeout(() => {
          setShowWelcomePopup(true);
        }, 1000);

        // Update metadata to NOT show it again
        await supabase.auth.updateUser({
          data: { show_welcome_reward: false }
        });
      }
    } catch (err) {
      console.error("Error checking welcome reward:", err);
    }
  }, []);

  // ✅ Category Sheet state
  const [categorySheetVisible, setCategorySheetVisible] = useState(false);
  const [selectedMainCategoryForSheet, setSelectedMainCategoryForSheet] = useState<MainCategory | null>(null);
  const isFocused = useIsFocused();

  const fetchServices = useCallback(async () => {
    const { data, error } = await supabase.from("services").select("*");

    if (error) {
      console.log("Supabase error:", error);
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
          return {
            ...svc,
            discount_label: `${matchingOffer.offer_percentage}% OFF`,
            discount_percent: matchingOffer.offer_percentage,
          };
        }
        return svc;
      });
    }

    setServices(serviceList);
  }, []);

  const fetchMainCategories = useCallback(async () => {
    const { data, error } = await supabase
      .from("main_categories")
      .select("*")
      .order("sort_order", { ascending: true });

    if (error) {
      console.log("Main Categories error:", error);
      return;
    }
    setMainCategories(data || []);
    // Optional: Set the first one as active by default if you want
    // if (data && data.length > 0) setActiveMainCategory(data[0].id);
  }, []);

  const fetchHeroBanners = useCallback(async () => {
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
  }, []);

  const fetchPopups = useCallback(async () => {
    if (hasShownPopupThisSession) return;

    const { data: popupData } = await supabase
      .from("app_popups")
      .select("*")
      .eq("is_active", true);

    const { data: offersData } = await supabase
      .from("offers")
      .select("*")
      .eq("is_offer_enabled", true);

    if (popupData && popupData.length > 0) {
      setAppPopups(popupData);
    }

    if (offersData && offersData.length > 0) {
      setActiveOffers(offersData);
    }

    if (popupData && popupData.length > 0) {
      setPopupType("APP_POPUP");
      setShowPopup(true);
      hasShownPopupThisSession = true;
    } else if (offersData && offersData.length > 0) {
      setPopupType("OFFERS");
      setShowPopup(true);
      hasShownPopupThisSession = true;
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      const loadAll = async () => {
        setLoading(true);
        try {
          await Promise.all([fetchMainCategories(), fetchServices()]);
          await Promise.all([fetchHeroBanners(), fetchPopups()]);
          await checkWelcomeReward();
        } catch (err) {
          console.error("Home load error:", err);
        } finally {
          setLoading(false);
        }
      };
      loadAll();
    }, [fetchServices, fetchHeroBanners, fetchPopups, fetchMainCategories, checkWelcomeReward])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchMainCategories(), fetchServices(), fetchHeroBanners(), fetchPopups()]);
    setRefreshing(false);
  };

  const tabs = useMemo(() => {
    const categoryMap = new Map<string, number>();

    // Filter services by active main category
    const filteredServices = activeMainCategory
      ? services.filter(s => s.main_category_id === activeMainCategory)
      : services;

    filteredServices.forEach((s) => {
      if (s.service_type && !categoryMap.has(s.service_type)) {
        categoryMap.set(s.service_type, s.category_order ?? 999);
      }
    });

    const sorted = Array.from(categoryMap.entries()).sort((a, b) => a[1] - b[1]);

    const result = sorted.map(([type]) => ({
      label: type.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      value: type,
    }));

    if (result.length > 0) {
      return [{ label: t("home.allServices"), value: "ALL" }, ...result];
    }
    return result;
  }, [services, t, activeMainCategory]);

  // Sync activeCategory when tabs change
  useEffect(() => {
    if (tabs.length > 0) {
      const exists = tabs.find(t => t.value === activeCategory);
      if (!exists) setActiveCategory(tabs[0].value);
    }
  }, [tabs, activeCategory]);

  // ✅ Get unique sub-categories for the bottom sheet
  const subCategories = useMemo(() => {
    if (!selectedMainCategoryForSheet) return [];

    // Use a map to track unique types AND their first found icon
    const typeMap = new Map<string, { label: string, value: string, icon: string | null, order?: number }>();

    services
      .filter(s => s.main_category_id === selectedMainCategoryForSheet.id)
      .forEach(s => {
        if (s.service_type) {
          const type = s.service_type;
          const existing = typeMap.get(type);

          // If we haven't found this type yet, OR if we found it but it didn't have an icon and this one does
          if (!existing || (!existing.icon && s.category_icon_url)) {
            typeMap.set(type, {
              label: type.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
              value: type,
              icon: s.category_icon_url || existing?.icon || null,
              order: s.category_order ?? existing?.order ?? 9999
            });
          }
        }
      });

    const result = Array.from(typeMap.values());

    // Add 4 specific containers for Insta Help if they don't exist
    if (selectedMainCategoryForSheet.name === "Insta Help") {
      const instaItems = [
        "Kitchen Utensil Cleaning",
        "Clothes Ironing",
        "Clothes Folding",
        "Floor Mopping"
      ];

      instaItems.forEach(label => {
        if (!result.some(r => r.label === label)) {
          result.push({
            label,
            value: label.toUpperCase().replace(/\s+/g, "_"),
            icon: null,
            order: 9999
          });
        }
      });
    }

    result.sort((a, b) => {
      const orderA = a.order ?? 9999;
      const orderB = b.order ?? 9999;
      if (orderA !== orderB) return orderA - orderB;
      return a.label.localeCompare(b.label);
    });

    return result;
  }, [services, selectedMainCategoryForSheet]);

  const getServicesForCategory = useCallback(
    (categoryValue: string) => {
      const search = (searchText ?? "").trim().toLowerCase();
      return services.filter((service) => {
        // Must match active Main Category if one is selected
        if (activeMainCategory && service.main_category_id !== activeMainCategory) return false;

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
    [services, searchText, activeMainCategory]
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
              onContentSizeChange={(_, h) => {
                if (measuredHeights[tab.value] !== h) {
                  setMeasuredHeights((prev) => ({ ...prev, [tab.value]: h }));
                }
              }}
            />
          )}
        </View>
      );
    },
    [getServicesForCategory, navigation, t, theme, measuredHeights]
  );

  const activeCategoryServices = getServicesForCategory(activeCategory);
  const CARD_ROW_HEIGHT = 320; // Safe fallback height to prevent any layout cutoffs
  const serviceRows = Math.max(1, Math.ceil(activeCategoryServices.length / 2));
  const pagerHeight = activeCategoryServices.length === 0
    ? 150
    : (measuredHeights[activeCategory] || (serviceRows * CARD_ROW_HEIGHT));

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
          ref={scrollRef}
          onScroll={(e) => setShowGoUp(e.nativeEvent.contentOffset.y > 200)}
          scrollEventThrottle={16}

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
          contentContainerStyle={{ backgroundColor: theme.background, paddingBottom: 0 }}
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
            <View
              style={{ height: SLIDER_HEIGHT, marginHorizontal: 12, marginTop: 4, borderRadius: 20, overflow: "hidden", backgroundColor: theme.surfaceVariant }}
            >
              <FlatList
                ref={sliderRef}
                data={heroBanners}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={(e) => setCurrentSlide(Math.round(e.nativeEvent.contentOffset.x / (width - 24)))}
                onScrollBeginDrag={() => setIsUserSwiping(true)}
                onScrollEndDrag={() => setIsUserSwiping(false)}
                renderItem={({ item }) => (
                  <Pressable
                    onPress={() => scrollRef.current?.scrollTo({ y: servicesY, animated: true })}
                    style={{ width: width - 24, height: SLIDER_HEIGHT }}
                  >
                    <Image source={item} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                  </Pressable>
                )}
              />
              <View style={styles.dots} pointerEvents="none">
                {heroBanners.map((_, i) => (
                  <View key={i} style={[styles.dot, { backgroundColor: currentSlide === i ? "#fff" : "rgba(255,255,255,0.4)", width: currentSlide === i ? 20 : 8 }]} />
                ))}
              </View>
            </View>
          )}

          {/* New User Promo Banner (Matching Website Image 1) */}
          <View style={promoBannerStyles.container}>
            <View style={promoBannerStyles.headerRow}>
              <View style={promoBannerStyles.sparkleCircle}>
                <Text style={{ fontSize: 16 }}>✨</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={promoBannerStyles.titleText}>
                  New to The Neatify Team? Get <Text style={promoBannerStyles.highlightText}>40% OFF</Text> on Your First Booking!
                </Text>
                <Text style={promoBannerStyles.subText}>
                  Register with a new mobile number to enjoy 40% OFF on your first eligible service.
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={promoBannerStyles.claimBtn}
              activeOpacity={0.8}
              onPress={() => navigation.navigate("Login", { isRegister: true })}
            >
              <Text style={promoBannerStyles.claimBtnText}>Claim 40% OFF →</Text>
            </TouchableOpacity>
          </View>

          {/* 3. Main Category Grid (Explore all services) */}
          {mainCategories.length > 0 && (
            <View style={styles.gridContainer} onLayout={(e) => setServicesY(e.nativeEvent.layout.y)}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Explore all services</Text>
              <View style={styles.grid}>
                {mainCategories.map((item) => (
                  <Pressable
                    key={item.id}
                    style={[styles.gridItem, activeMainCategory === item.id && styles.gridItemActive]}
                    onPress={() => {
                      setSelectedMainCategoryForSheet(item);
                      setCategorySheetVisible(true);
                    }}
                  >
                    <View style={[styles.gridIconContainer, { backgroundColor: theme.surfaceVariant || "#F5F7FA" }]}>
                      {item.icon_url ? (
                        <Image source={{ uri: item.icon_url }} style={styles.gridIcon} contentFit="cover" />
                      ) : (
                        <Ionicons name="apps-outline" size={32} color={theme.primary} />
                      )}
                    </View>
                    <Text style={[styles.gridLabel, { color: theme.text }]} numberOfLines={2}>
                      {item.name}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}


          {/* 6. Why Choose Us Section */}
          <WhyChooseUs onBookNow={() => {
            scrollRef.current?.scrollTo({ y: 0, animated: true });
          }} />
        </ScrollView>
      )}

      {/* Popups (Festive & Offers) */}
      <Modal visible={showPopup && !!popupType} transparent animationType="fade" onRequestClose={() => setShowPopup(false)}>
        <Pressable style={popupStyles.overlay} onPress={() => {
          if (popupType === "APP_POPUP" && activeOffers.length > 0) {
            setPopupType("OFFERS");
          } else {
            setShowPopup(false);
          }
        }}>
          <AnimatedGradientBorder borderRadius={20} borderWidth={2} animationSpeed={3} style={{ width: popupType === "APP_POPUP" ? POPUP_WIDTH : "90%" }}>
            <Pressable onPress={(e) => e.stopPropagation()} style={[popupStyles.container, { backgroundColor: theme.background }]}>
              <Pressable style={popupStyles.closeBtn} onPress={() => {
                if (popupType === "APP_POPUP" && activeOffers.length > 0) {
                  setPopupType("OFFERS");
                } else {
                  setShowPopup(false);
                }
              }}>
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
                    <Pressable
                      key={i}
                      style={[popupStyles.offItem, { borderBottomColor: theme.border }]}
                      onPress={async () => {
                        setShowPopup(false);
                        const matchingSvc = services.find((s) => s.title === off.title);
                        if (matchingSvc) {
                          await setClaimedOffer({
                            serviceId: matchingSvc.id,
                            serviceTitle: matchingSvc.title,
                            offerPercentage: off.offer_percentage || 40,
                            offerPrice: (off as any).offer_price || (off as any).fixed_price,
                            claimedAt: new Date().toISOString(),
                          });
                          navigation.navigate("ServiceDetail", { service: matchingSvc });
                        }
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={popupStyles.offType}>{off.service_type}</Text>
                        <Text style={[popupStyles.offTitle, { color: theme.text }]}>{off.title}</Text>
                      </View>
                      <View style={[popupStyles.offBadge, { backgroundColor: theme.primary + "20", borderColor: theme.primary }]}>
                        <Text style={{ color: theme.primary, fontWeight: '800' }}>{off.offer_percentage}% OFF</Text>
                      </View>
                    </Pressable>
                  ))}
                  <Pressable style={[popupStyles.footerBtn, { backgroundColor: theme.primary }]} onPress={() => setShowPopup(false)}><Text style={{ fontWeight: '700' }}>Browse Services</Text></Pressable>
                </View>
              )}
            </Pressable>
          </AnimatedGradientBorder>
        </Pressable>
      </Modal>

      <Modal
        visible={categorySheetVisible && isFocused}
        transparent
        animationType="slide"
        onRequestClose={() => setCategorySheetVisible(false)}
      >
        <Pressable
          style={sheetStyles.overlay}
          onPress={() => setCategorySheetVisible(false)}
        >
          <View style={[sheetStyles.sheetContainer, { backgroundColor: theme.background }]}>
            <View style={sheetStyles.header}>
              <Text style={[sheetStyles.title, { color: theme.text }]}>
                {selectedMainCategoryForSheet?.name}
              </Text>
              <Pressable
                onPress={() => setCategorySheetVisible(false)}
                style={[sheetStyles.closeButton, { backgroundColor: theme.surfaceVariant }]}
              >
                <Ionicons name="close" size={24} color={theme.text} />
              </Pressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={sheetStyles.content}
            >
              <View style={sheetStyles.categoryGrid}>
                {subCategories.map((cat) => (
                  <Pressable
                    key={cat.value}
                    style={sheetStyles.categoryItem}
                    onPress={() => {
                      navigation.navigate("CategoryDetail", {
                        category: cat.value,
                        label: cat.label
                      });
                    }}
                  >
                    <View style={[sheetStyles.categoryIconContainer, { backgroundColor: theme.surfaceVariant || "#F5F7FA" }]}>
                      {cat.icon ? (
                        <Image source={{ uri: cat.icon }} style={sheetStyles.categoryImage} contentFit="contain" />
                      ) : (
                        <Ionicons name="apps-outline" size={32} color={theme.primary} />
                      )}
                    </View>
                    <Text style={[sheetStyles.categoryLabel, { color: theme.text }]} numberOfLines={2}>
                      {cat.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

      {/* Welcome Reward Popup */}
      <Modal visible={showWelcomePopup} transparent animationType="slide" onRequestClose={() => setShowWelcomePopup(false)}>
        <Pressable style={popupStyles.overlay} onPress={() => setShowWelcomePopup(false)}>
          <View style={[popupStyles.welcomeCard, { backgroundColor: theme.background }]}>
            <View style={popupStyles.rewardIconContainer}>
              <Ionicons name="gift" size={50} color={COLORS.saffron} />
            </View>
            <Text style={[popupStyles.welcomeTitle, { color: theme.text }]}>Welcome Reward! 🎉</Text>
            <Text style={[popupStyles.welcomeDesc, { color: theme.textLight }]}>
              Thanks for joining us! Here is your ₹50 reward for using a referral code.
            </Text>
            <View style={[popupStyles.couponBox, { backgroundColor: theme.surfaceVariant }]}>
              <Text style={[popupStyles.couponCodeText, { color: theme.text }]}>{welcomeCoupon}</Text>
              <TouchableOpacity onPress={() => {
                Clipboard.setString(welcomeCoupon);
                showToast("Code copied!", "success");
              }}>
                <Ionicons name="copy-outline" size={24} color={theme.primary} />
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={[popupStyles.footerBtn, { backgroundColor: theme.primary, width: '100%', margin: 0, marginTop: 24 }]}
              onPress={() => setShowWelcomePopup(false)}
            >
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Great, Thanks!</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
      {/* Floating Go Up Button */}
      {showGoUp && (
        <TouchableOpacity
          style={[goUpStyles.goUpBtn, { backgroundColor: theme.background, borderColor: theme.border }]}
          onPress={() => scrollRef.current?.scrollTo({ y: 0, animated: true })}
          activeOpacity={0.85}
        >
          <Ionicons name="arrow-up" size={24} color={COLORS.saffron} />
        </TouchableOpacity>
      )}
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
  sectionTitle: { fontSize: 18, fontWeight: "700", marginLeft: 16, marginTop: 24, marginBottom: 16 },
  gridContainer: { paddingHorizontal: 12 },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  gridItem: { width: "33.33%", alignItems: "center", marginBottom: 20, paddingHorizontal: 4 },
  gridItemActive: { opacity: 0.7 },
  gridIconContainer: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
    backgroundColor: "#F5F7FA",
    overflow: "hidden", // Ensures image stays within rounded corners
  },
  gridIcon: { width: "85%", height: "85%" },
  gridLabel: { fontSize: 13, fontWeight: "600", textAlign: "center", lineHeight: 18 },
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
  welcomeCard: {
    width: "85%",
    padding: 24,
    borderRadius: 24,
    alignItems: "center",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
  },
  rewardIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(244, 196, 48, 0.15)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  welcomeTitle: {
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 10,
  },
  welcomeDesc: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 20,
  },
  couponBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    padding: 16,
    borderRadius: 16,
    borderStyle: "dashed",
    borderWidth: 2,
    borderColor: COLORS.saffron,
  },
  couponCodeText: {
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: 1,
  },
});

const sheetStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  sheetContainer: {
    width: "100%",
    maxHeight: height * 0.85,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingTop: 24,
    paddingBottom: 40,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    paddingHorizontal: 20,
  },
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingTop: 10,
  },
  categoryItem: {
    width: "25%",
    alignItems: "center",
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  categoryIconContainer: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  categoryLabel: {
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 16,
  },
  categoryImage: {
    width: "70%",
    height: "70%",
  },
});

const goUpStyles = StyleSheet.create({
  goUpBtn: {
    position: "absolute",
    bottom: 30,
    alignSelf: "center",
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },
});

const promoBannerStyles = StyleSheet.create({
  container: {
    marginHorizontal: 12,
    marginTop: 14,
    marginBottom: 6,
    backgroundColor: "#161F33",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 12,
  },
  sparkleCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 2,
  },
  titleText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 20,
  },
  highlightText: {
    color: "#FACC15",
    fontWeight: "900",
  },
  subText: {
    color: "#94A3B8",
    fontSize: 11,
    fontWeight: "500",
    marginTop: 4,
    lineHeight: 16,
  },
  claimBtn: {
    backgroundColor: "#FACC15",
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 24,
    alignSelf: "flex-end",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#FACC15",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  claimBtnText: {
    color: "#0F172A",
    fontWeight: "900",
    fontSize: 13,
  },
});
