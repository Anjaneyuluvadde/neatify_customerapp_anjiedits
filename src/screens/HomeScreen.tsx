// import { Ionicons } from "@expo/vector-icons";
// import { useEffect, useMemo, useState } from "react";
// import {
//   ActivityIndicator,
//   FlatList,
//   StatusBar,
//   Text,
//   View,
// } from "react-native";
// import { SafeAreaView } from "react-native-safe-area-context";

// import CategoryTabs from "../components/CategoryTabs";
// import Header from "../components/Header";
// import ServiceCard from "../components/ServiceCard";
// import { supabase } from "../lib/supabase";
// import { COLORS } from "../theme/colors";
// import { Service } from "../types/service";

// export default function HomeScreen({ navigation }: any) {
//   const [services, setServices] = useState<Service[]>([]);
//   const [activeCategory, setActiveCategory] = useState("ALL");
//   const [searchText, setSearchText] = useState("");
//   const [loading, setLoading] = useState(true);

//   useEffect(() => {
//     fetchServices();
//   }, []);

//   const fetchServices = async () => {
//     setLoading(true);

//     const { data, error } = await supabase.from("services").select(`
//         id,
//         title,
//         service_type,
//         duration,
//         price,
//         image,
//         gallery_images,
//         description
//       `);

//     if (error) {
//       console.log("Supabase error:", error);
//     } else {
//       setServices(data || []);
//     }

//     setLoading(false);
//   };

//   /* ✅ Tabs dynamically from service_type */
//   const tabs = useMemo(() => {
//     const uniqueTypes = Array.from(
//       new Set((services || []).map((s) => s.service_type).filter(Boolean))
//     );

//     return [
//       { label: "All Services", value: "ALL" },
//       ...uniqueTypes.map((type) => ({
//         label: type
//           .toLowerCase()
//           .replace(/_/g, " ")
//           .replace(/\b\w/g, (c) => c.toUpperCase()),
//         value: type,
//       })),
//     ];
//   }, [services]);

//   /* ✅ Search + Filter using service_type */
//   const filteredServices = services.filter((service) => {
//     const search = (searchText ?? "").trim().toLowerCase();

//     const title = (service.title ?? "").toLowerCase();
//     const serviceType = (service.service_type ?? "").toLowerCase();

//     const matchesSearch =
//       search.length === 0 ||
//       title.includes(search) ||
//       serviceType.includes(search);

//     const matchesCategory =
//       activeCategory === "ALL" || service.service_type === activeCategory;

//     return matchesSearch && matchesCategory;
//   });

//   return (
//     <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }} edges={["top"]}>
//       {/* ✅ This makes sure status bar looks clean */}
//       <StatusBar barStyle="dark-content" backgroundColor="#fff" />

//       <View style={{ flex: 1, backgroundColor: "#fff" }}>
//         <Header
//           searchText={searchText}
//           onSearchChange={(text) => {
//             setSearchText(text);
//             setActiveCategory("ALL");
//           }}
//         />

//         <CategoryTabs
//           activeTab={activeCategory}
//           onChange={setActiveCategory}
//           tabs={tabs}
//         />

//         {loading ? (
//           <ActivityIndicator size="large" style={{ marginTop: 40 }} />
//         ) : filteredServices.length === 0 ? (
//           <View style={{ marginTop: 60, alignItems: "center" }}>
//             <Ionicons name="search-outline" size={40} color={COLORS.gray} />
//             <Text style={{ marginTop: 12, color: COLORS.gray, fontSize: 16 }}>
//               No search results found
//             </Text>
//           </View>
//         ) : (
//           <FlatList
//             data={filteredServices}
//             keyExtractor={(item) => item.id}
//             numColumns={2}
//             contentContainerStyle={{
//               padding: 8,
//               backgroundColor: "#fff", // ✅ Fix gray background
//             }}
//             renderItem={({ item }) => (
//               <ServiceCard
//                 service={item}
//                 onPress={() =>
//                   navigation.navigate("ServiceDetail", {
//                     service: item,
//                   })
//                 }
//               />
//             )}
//           />
//         )}
//       </View>
//     </SafeAreaView>
//   );
// }
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  ImageSourcePropType,
  Modal,
  Pressable,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import CategoryTabs from "../components/CategoryTabs";
import Header from "../components/Header";
import ServiceCard from "../components/ServiceCard";
import { useLanguage } from "../context/LanguageContext";
import { useAuthGuard } from "../hooks/useAuthGuard";
import { supabase, SUPABASE_URL } from "../lib/supabase";
import { COLORS } from "../theme/colors";
import { Service } from "../types/service";

const { width, height } = Dimensions.get("window");
const SLIDER_HEIGHT = height * 0.25;

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

export default function HomeScreen({ navigation }: any) {
  const { checkAuth } = useAuthGuard();
  const { t } = useLanguage();
  const [services, setServices] = useState<Service[]>([]);
  const [activeCategory, setActiveCategory] = useState("BATHROOM");
  const [searchText, setSearchText] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // ✅ FIX: Works for both local require + remote uri
  const [heroBanners, setHeroBanners] = useState<ImageSourcePropType[]>([]);

  // ✅ Slider refs
  const sliderRef = useRef<FlatList>(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isUserSwiping, setIsUserSwiping] = useState(false);

  // ✅ Services list ref for scroll
  const servicesListRef = useRef<FlatList>(null);

  // ✅ Store slider Y layout for smooth scroll
  const [sliderLayoutY, setSliderLayoutY] = useState(0);

  // ✅ Popup slider ref
  const popupSliderRef = useRef<FlatList>(null);

  // ✅ Popup container width for paging
  const POPUP_WIDTH = Math.min(width - 48, 360); // matches maxWidth: 360, padding: 24 each side

  // ✅ Popup state
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

    const { data, error } = await supabase.from("services").select(`
        id,
        title,
        service_type,
        category_order,
        duration,
        price,
        image,
        gallery_images,
        description,
        sort_order,
        original_price,
        discount_percent,
        work_includes,
        work_includes,
        discount_label,
        tax_percent
      `);

    if (error) {
      console.log("Supabase error:", error);
      setLoading(false);
      return;
    }

    let serviceList = data || [];

    // ✅ Fetch active offers and merge into services
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
          const basePrice =
            svc.original_price && Number(svc.original_price) > 0
              ? Number(svc.original_price)
              : parseFloat(String(svc.price).replace(/[^\d.]/g, ""));
          const discountedPrice = Math.round(
            basePrice - (basePrice * matchingOffer.offer_percentage) / 100
          );
          return {
            ...svc,
            price: `₹${discountedPrice}`,
            original_price: basePrice,
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
    console.log("🎯 Fetching hero banners from Supabase...");

    const { data, error } = await supabase
      .from("hero_banners")
      .select("image_path")
      .eq("is_active", true)
      .order("display_order", { ascending: true });

    // ✅ Fallback images
    const fallbackBanners: ImageSourcePropType[] = [
      require("../../assets/images/1.png"),
      require("../../assets/images/2.png"),
      require("../../assets/images/3.png"),
    ];

    if (error) {
      console.error("❌ Error fetching hero banners:", error);
      console.log("📦 Falling back to hardcoded banners");
      setHeroBanners(fallbackBanners);
      return;
    }

    if (data && data.length > 0) {
      console.log("✅ Hero banners fetched successfully:", data);

      // ✅ IMPORTANT FIX: Your bucket name is "hero-images"
      const bannerUrls = data.map(
        (banner) =>
          `${SUPABASE_URL}/storage/v1/object/public/hero-images/${banner.image_path}`
      );

      console.log("🖼️ Banner URLs:", bannerUrls);

      // ✅ Convert to ImageSourcePropType format
      setHeroBanners(bannerUrls.map((url) => ({ uri: url })));
      return;
    }

    console.log("⚠️ No hero banners found in DB, using fallback banners");
    setHeroBanners(fallbackBanners);
  };

  /* ================= POPUPS ================= */

  const fetchPopups = async () => {
    // 1. Check app_popups first (priority)
    const { data: popupData } = await supabase
      .from("app_popups")
      .select("title, description, image_url")
      .eq("is_active", true);

    if (popupData && popupData.length > 0) {
      setAppPopups(popupData);
      setPopupIndex(0);
      setPopupType("APP_POPUP");
      setShowPopup(true);
      return;
    }

    // 2. Fallback: Check offers
    const { data: offersData } = await supabase
      .from("offers")
      .select("service_type, title, offer_percentage, description")
      .eq("is_offer_enabled", true);

    if (offersData && offersData.length > 0) {
      setActiveOffers(offersData);
      setPopupType("OFFERS");
      setShowPopup(true);
    }
  };

  const handleOfferPress = (offerTitle: string) => {
    // Find the matching service from already-fetched services
    const matchedService = services.find(
      (s) => s.title.toLowerCase() === offerTitle.toLowerCase()
    );
    setShowPopup(false);
    if (matchedService) {
      navigation.navigate("ServiceDetail", { service: matchedService });
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchServices(), fetchHeroBanners(), fetchPopups()]);
    setRefreshing(false);
  };

  /* ✅ Tabs with dynamic order from database */
  const tabs = useMemo(() => {
    // Extract unique service types with their category_order
    const categoryMap = new Map<string, number>();

    (services || []).forEach((service) => {
      if (service.service_type) {
        // Store the category_order for each service_type
        // If multiple services have the same type, they should have the same order
        if (!categoryMap.has(service.service_type)) {
          categoryMap.set(service.service_type, service.category_order ?? 9999);
        }
      }
    });

    // Convert map to array and sort by category_order
    const sortedCategories = Array.from(categoryMap.entries())
      .sort((a, b) => a[1] - b[1]) // Sort by category_order (a[1] and b[1] are the order values)
      .map(([type, _]) => type); // Extract just the service_type

    const finalTabs = [
      ...sortedCategories.map((type) => ({
        label: type
          .toLowerCase()
          .replace(/_/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase()),
        value: type,
      })),
      { label: t("home.allServices"), value: "ALL" },
    ];

    console.log("📋 Category Tabs Order:", finalTabs.map(t => t.label).join(", "));

    return finalTabs;
  }, [services, t]);

  /* ✅ Search + Filter (Fuzzy) + Sort */
  const filteredServices = useMemo(() => {
    const filtered = services.filter((service) => {
      const search = (searchText ?? "").trim().toLowerCase();
      const title = (service.title ?? "").toLowerCase();
      const serviceType = (service.service_type ?? "").toLowerCase();

      const matchesCategory =
        activeCategory === "ALL" || service.service_type === activeCategory;

      if (!matchesCategory) return false;
      if (search.length === 0) return true;

      // ✅ If search is very small, normal contains search
      if (search.length < 3) {
        return title.includes(search) || serviceType.includes(search);
      }

      // ✅ Fuzzy: matches category
      if (getLevenshteinDistance(search, serviceType) <= 2) return true;
      if (serviceType.includes(search)) return true;

      // ✅ Fuzzy: matches words in title
      const titleWords = title.split(" ");
      const isWordMatch = titleWords.some((word) => {
        const cleanWord = word.replace(/[^a-z0-9]/g, "");
        return (
          cleanWord.includes(search) ||
          (cleanWord.length > 3 && getLevenshteinDistance(search, cleanWord) <= 2)
        );
      });

      if (isWordMatch) return true;

      return title.includes(search);
    });

    // ✅ Sort by sort_order
    return filtered.sort((a, b) => {
      const aOrder = a.sort_order ?? 9999;
      const bOrder = b.sort_order ?? 9999;
      return aOrder - bOrder;
    });
  }, [services, searchText, activeCategory]);

  // ✅ Auto slide every 3 seconds
  useEffect(() => {
    if (heroBanners.length <= 1) return;

    const interval = setInterval(() => {
      if (isUserSwiping) return;
      setCurrentSlide((prev) => {
        const next = (prev + 1) % heroBanners.length;
        sliderRef.current?.scrollToIndex({ index: next, animated: true });
        return next;
      });
    }, 3000);

    return () => clearInterval(interval);
  }, [heroBanners.length, isUserSwiping]);

  const onSlideEnd = (e: any) => {
    const slideWidth = width - 36;
    const index = Math.round(e.nativeEvent.contentOffset.x / slideWidth);
    setCurrentSlide(index);
  };

  // ✅ When user clicks slider → scroll to services list
  const scrollToServices = () => {
    servicesListRef.current?.scrollToOffset({
      offset: sliderLayoutY + SLIDER_HEIGHT - 10,
      animated: true,
    });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {loading ? (
        <ActivityIndicator size="large" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          ref={servicesListRef}
          data={filteredServices}
          keyExtractor={(item) => item.id}
          numColumns={2}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          contentContainerStyle={{
            padding: 8,
            backgroundColor: "#fff",
            flexGrow: 1,
          }}
          ListHeaderComponent={
            <View style={{ backgroundColor: "#fff" }}>
              {/* ✅ Search */}
              <Header
                searchText={searchText}
                onSearchChange={(text) => {
                  setSearchText(text);

                  const match = tabs.find(
                    (t) =>
                      t.value !== "ALL" &&
                      t.label.toLowerCase() === text.trim().toLowerCase()
                  );

                  if (match) {
                    setActiveCategory(match.value);
                  } else {
                    setActiveCategory("ALL");
                  }
                }}
              />

              {/* ✅ Slider */}
              {heroBanners.length > 0 && (
                <View onLayout={(e) => setSliderLayoutY(e.nativeEvent.layout.y)}>
                  <View
                    style={{
                      height: SLIDER_HEIGHT,
                      marginHorizontal: 10,
                      marginTop: 10,
                      borderRadius: 16,
                      overflow: "hidden",
                      backgroundColor: "#f2f2f2",
                    }}
                  >
                    <FlatList
                      ref={sliderRef}
                      data={heroBanners}
                      keyExtractor={(_, index) => index.toString()}
                      horizontal
                      pagingEnabled
                      showsHorizontalScrollIndicator={false}
                      onMomentumScrollEnd={onSlideEnd}
                      onScrollBeginDrag={() => setIsUserSwiping(true)}
                      onScrollEndDrag={() => setIsUserSwiping(false)}
                      onScrollToIndexFailed={(info) => {
                        setTimeout(() => {
                          sliderRef.current?.scrollToIndex({
                            index: info.index,
                            animated: true,
                          });
                        }, 300);
                      }}
                      renderItem={({ item }) => (
                        <Pressable
                          onPress={scrollToServices}
                          style={{ width: width - 36, height: SLIDER_HEIGHT }}
                        >
                          <Image
                            source={item}
                            style={{ width: "100%", height: "100%" }}
                            resizeMode="cover"
                            onError={(e) =>
                              console.log("❌ Banner load error:", e.nativeEvent)
                            }
                          />
                        </Pressable>
                      )}
                    />

                    {/* ✅ Dots */}
                    <View
                      pointerEvents="none"
                      style={{
                        position: "absolute",
                        bottom: 10,
                        alignSelf: "center",
                        flexDirection: "row",
                        gap: 6,
                      }}
                    >
                      {heroBanners.map((_, i) => (
                        <View
                          key={i}
                          style={{
                            width: currentSlide === i ? 18 : 8,
                            height: 8,
                            borderRadius: 20,
                            backgroundColor:
                              currentSlide === i
                                ? "#fff"
                                : "rgba(255,255,255,0.5)",
                          }}
                        />
                      ))}
                    </View>
                  </View>
                </View>
              )}

              {/* ✅ Tabs */}
              <CategoryTabs
                activeTab={activeCategory}
                onChange={setActiveCategory}
                tabs={tabs}
              />
            </View>
          }
          ListEmptyComponent={
            <View style={{ marginTop: 60, alignItems: "center" }}>
              <Ionicons name="search-outline" size={40} color={COLORS.gray} />
              <Text style={{ marginTop: 12, color: COLORS.gray, fontSize: 16 }}>
                {t("home.noResults")}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <ServiceCard
              service={item}
              onPress={async () => {
                const isAuth = await checkAuth("view service details");
                if (isAuth) {
                  navigation.navigate("ServiceDetail", {
                    service: item,
                  });
                }
              }}
            />
          )}
        />
      )}

      {/* ================= POPUP MODALS ================= */}

      {/* App Popup (Festive/General) */}
      <Modal
        visible={showPopup && popupType === "APP_POPUP"}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPopup(false)}
      >
        <View style={popupStyles.overlay}>
          <View style={[popupStyles.appPopupContainer, { width: POPUP_WIDTH }]}>
            {/* Close Button */}
            <Pressable style={popupStyles.closeBtn} onPress={() => setShowPopup(false)}>
              <Ionicons name="close" size={22} color="#fff" />
            </Pressable>

            {/* Swipeable content */}
            <FlatList
              ref={popupSliderRef}
              data={appPopups}
              keyExtractor={(_, i) => i.toString()}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) => {
                const idx = Math.round(e.nativeEvent.contentOffset.x / POPUP_WIDTH);
                setPopupIndex(idx);
              }}
              onScrollToIndexFailed={(info) => {
                setTimeout(() => {
                  popupSliderRef.current?.scrollToIndex({ index: info.index, animated: true });
                }, 300);
              }}
              renderItem={({ item }) => (
                <View style={{ width: POPUP_WIDTH }}>
                  {/* Image */}
                  {item.image_url ? (
                    <Image
                      source={{ uri: item.image_url }}
                      style={popupStyles.appPopupImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={[popupStyles.appPopupImage, { backgroundColor: "#f1f5f9" }]} />
                  )}

                  {/* Content */}
                  <View style={popupStyles.appPopupContent}>
                    <Text style={popupStyles.appPopupTitle}>{item.title}</Text>
                    {item.description ? (
                      <Text style={popupStyles.appPopupDesc}>{item.description}</Text>
                    ) : null}
                  </View>
                </View>
              )}
            />

            {/* Navigation Arrows + Dots (only if multiple popups) */}
            {appPopups.length > 1 && (
              <View style={popupStyles.navRow}>
                <Pressable
                  onPress={() => {
                    const newIdx = Math.max(0, popupIndex - 1);
                    setPopupIndex(newIdx);
                    popupSliderRef.current?.scrollToIndex({ index: newIdx, animated: true });
                  }}
                  style={[popupStyles.arrowBtn, popupIndex === 0 && { opacity: 0.3 }]}
                  disabled={popupIndex === 0}
                >
                  <Ionicons name="chevron-back" size={22} color="#1e293b" />
                </Pressable>

                <View style={popupStyles.dotsRow}>
                  {appPopups.map((_, i) => (
                    <View
                      key={i}
                      style={[
                        popupStyles.dot,
                        i === popupIndex && popupStyles.dotActive,
                      ]}
                    />
                  ))}
                </View>

                <Pressable
                  onPress={() => {
                    const newIdx = Math.min(appPopups.length - 1, popupIndex + 1);
                    setPopupIndex(newIdx);
                    popupSliderRef.current?.scrollToIndex({ index: newIdx, animated: true });
                  }}
                  style={[popupStyles.arrowBtn, popupIndex === appPopups.length - 1 && { opacity: 0.3 }]}
                  disabled={popupIndex === appPopups.length - 1}
                >
                  <Ionicons name="chevron-forward" size={22} color="#1e293b" />
                </Pressable>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Offers Popup */}
      <Modal
        visible={showPopup && popupType === "OFFERS"}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPopup(false)}
      >
        <View style={popupStyles.overlay}>
          <View style={popupStyles.offersContainer}>
            {/* Header */}
            <View style={popupStyles.offersHeader}>
              <Text style={popupStyles.offersHeaderTitle}>🎉 Special Offers</Text>
              <Pressable onPress={() => setShowPopup(false)}>
                <Ionicons name="close-circle" size={28} color="#fff" />
              </Pressable>
            </View>

            {/* Offer Items */}
            {activeOffers.map((offer, index) => {
              const badgeText = `${offer.offer_percentage}% OFF`;

              return (
                <Pressable
                  key={index}
                  style={popupStyles.offerItem}
                  onPress={() => handleOfferPress(offer.title)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={popupStyles.offerServiceType}>{offer.service_type}</Text>
                    <Text style={popupStyles.offerTitle}>{offer.title}</Text>
                    {offer.description ? (
                      <Text style={popupStyles.offerDesc}>{offer.description}</Text>
                    ) : null}
                  </View>
                  <View style={popupStyles.offerBadge}>
                    <Text style={popupStyles.offerBadgeText}>{badgeText}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#F59E0B" style={{ marginLeft: 6 }} />
                </Pressable>
              );
            })}

            {/* Footer CTA */}
            <Pressable style={popupStyles.offersCloseBtn} onPress={() => setShowPopup(false)}>
              <Text style={popupStyles.offersCloseBtnText}>Browse All Services</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/* ================= POPUP STYLES ================= */

const popupStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  // App Popup (Festive)
  appPopupContainer: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "#fff",
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  closeBtn: {
    position: "absolute",
    top: 10,
    right: 10,
    zIndex: 10,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 20,
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  appPopupImage: {
    width: "100%",
    height: 220,
  },
  appPopupContent: {
    padding: 20,
    alignItems: "center",
  },
  appPopupTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1e293b",
    textAlign: "center",
    marginBottom: 8,
  },
  appPopupDesc: {
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 20,
  },
  navRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 12,
  },
  arrowBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  dotsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#cbd5e1",
  },
  dotActive: {
    width: 18,
    backgroundColor: "#F59E0B",
  },
  // Offers Popup
  offersContainer: {
    width: "100%",
    maxWidth: 380,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "#fff",
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  offersHeader: {
    backgroundColor: "#F59E0B",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  offersHeaderTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#fff",
  },
  offerItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  offerServiceType: {
    fontSize: 11,
    fontWeight: "700",
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  offerTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1e293b",
    marginTop: 2,
  },
  offerDesc: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
  },
  offerBadge: {
    backgroundColor: "#FEF3C7",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#FCD34D",
  },
  offerBadgeText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#92400E",
  },
  offersCloseBtn: {
    backgroundColor: "#F59E0B",
    margin: 16,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  offersCloseBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});
