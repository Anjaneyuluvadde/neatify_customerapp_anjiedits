import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, DrawerActions } from "@react-navigation/native";
import * as Location from "expo-location";
import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, Text, TouchableOpacity, View, LayoutAnimation, Platform, UIManager } from "react-native";

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

import LocationService from "../services/LocationService";
import { useLanguage } from "../context/LanguageContext";
import { useTheme } from "../context/ThemeContext";
import { useAuthGuard } from "../hooks/useAuthGuard";
import { supabase } from "../lib/supabase";

type HeaderProps = {
  isCurved?: boolean;
};

export default function Header({ isCurved = false }: HeaderProps) {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const { checkAuth } = useAuthGuard();
  const { t } = useLanguage();
  const { theme, isDark } = useTheme();

  const isHome = route.name.toLowerCase().includes('home');

  const [profile, setProfile] = useState<{ full_name: string; email: string } | null>(null);
  const [locationName, setLocationName] = useState<string>("Fetching location...");
  const [fullAddress, setFullAddress] = useState<string>("");
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const greetingOpacity = useRef(new Animated.Value(0)).current;
  const greetingTranslateY = useRef(new Animated.Value(15)).current;
  const spinValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(greetingOpacity, {
        toValue: 1,
        duration: 300,
        delay: 0,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(greetingTranslateY, {
        toValue: 0,
        duration: 300,
        delay: 0,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) fetchProfile(session.user.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
      }
    });

    handleRefresh(true);

    return () => subscription.unsubscribe();
  }, []);

  const startSpin = () => {
    spinValue.setValue(0);
    Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 1000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  };

  const stopSpin = () => {
    spinValue.stopAnimation();
  };

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const handleRefresh = async (isInitial = false) => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    startSpin();

    const oldLocation = locationName;
    setLocationName("Fetching location...");

    try {
      const result = await LocationService.fetchCurrentLocation();

      if (result.status === 'permission_denied') {
        setLocationName("Permission denied");
        return;
      }

      if (result.status === 'unserviceable') {
        navigation.reset({
          index: 0,
          routes: [{ name: "ComingSoon" }]
        });
        return;
      }

      if (result.status === 'error') {
        setLocationName("Unable to update location");
        if (!isInitial && oldLocation !== "Fetching location..." && oldLocation !== "Unable to update location") {
          setTimeout(() => setLocationName(oldLocation), 2500);
        }
        return;
      }

      // Success
      setLocationName(result.locality);
      setFullAddress(result.fullAddress);

    } catch (error) {
      console.warn("Location error:", error);
      setLocationName("Unable to update location");
      setFullAddress("");
      if (!isInitial && oldLocation !== "Fetching location..." && oldLocation !== "Unable to update location") {
        setTimeout(() => setLocationName(oldLocation), 2500);
      }
    } finally {
      setIsRefreshing(false);
      stopSpin();
    }
  };

  const toggleLocation = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsExpanded(!isExpanded);
  };

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profile')
        .select('full_name, email')
        .eq('id', userId)
        .single();

      if (data) {
        setProfile(data);
      }
    } catch (error) {
      console.error('Error fetching profile for header:', error);
    }
  };

  const handleMenuPress = () => {
    const drawerNav = navigation.getParent("root-drawer") || navigation;
    drawerNav.dispatch(DrawerActions.toggleDrawer());
  };

  const userName = profile?.full_name || "Anjaneyulu";

  if (!isHome) {
    return null;
  }

  return (
    <View style={[styles.container, isCurved && styles.curved]}>
      {/* TOP ROW */}
      <View style={styles.topRow}>
        <View style={styles.brandContainer}>
          <View style={styles.locationRow}>
            <Ionicons name="location" size={18} color="#111111" style={{ marginRight: 4, marginTop: 1 }} />
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={toggleLocation}
              style={{ flexShrink: 1, marginRight: 6 }}
            >
              <Text 
                style={{ fontSize: 15, fontWeight: '700', color: '#111111', lineHeight: 20 }}
                numberOfLines={isExpanded ? undefined : 1}
              >
                {isExpanded && fullAddress ? fullAddress : locationName}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => handleRefresh(false)}
              disabled={isRefreshing}
              style={{ paddingHorizontal: 4, paddingVertical: 2 }}
            >
              <Animated.View style={{ transform: [{ rotate: spin }] }}>
                <Ionicons name="sync" size={14} color="#111111" />
              </Animated.View>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.rightActions}>
          <TouchableOpacity style={styles.profileButton} onPress={handleMenuPress}>
            <Ionicons
              name="person"
              size={22}
              color="#111111"
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* GREETING */}
      <Animated.View style={[styles.greetingContainer, { opacity: greetingOpacity, transform: [{ translateY: greetingTranslateY }] }]}>
        <Text style={styles.greetingWrapper}>
          <Text style={styles.helloText}>Hello, </Text>
          <Text style={styles.usernameText}>{userName}</Text>
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 12,
    backgroundColor: "#FFC928",
  },
  curved: {
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    paddingBottom: 24,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  brandContainer: {
    flex: 1,
    marginRight: 12,
    justifyContent: "center",
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  logo: {
    width: 125,
    height: 35,
  },
  rightActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  profileButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  greetingContainer: {
    marginTop: 8,
    alignItems: "flex-start",
    justifyContent: "center",
    width: "100%",
    paddingLeft: 12,
  },
  greetingWrapper: {
    textAlign: "left",
  },
  helloText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#475569",
  },
  usernameText: {
    fontSize: 22,
    fontWeight: "900",
    color: "#0F172A",
    letterSpacing: 0.5,
  },
});
