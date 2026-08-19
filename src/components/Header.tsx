import { Ionicons } from "@expo/vector-icons";
import { DrawerActions, useNavigation } from "@react-navigation/native";
import * as Location from "expo-location";
import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { useLanguage } from "../context/LanguageContext";
import { useTheme } from "../context/ThemeContext";
import { useAuthGuard } from "../hooks/useAuthGuard";
import { supabase } from "../lib/supabase";
import { isServiceable, getServiceAreaMatch } from "../config/serviceAreas";

type HeaderProps = {
  isCurved?: boolean;
};

export default function Header({ isCurved = false }: HeaderProps) {
  const navigation = useNavigation<any>();
  const { checkAuth } = useAuthGuard();
  const { t } = useLanguage();
  const { theme, isDark } = useTheme();

  const [profile, setProfile] = useState<{ full_name: string; email: string } | null>(null);
  const [locationName, setLocationName] = useState<string>("Fetching location...");
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

  const getLocality = (addr: Location.LocationGeocodedAddress) => {
    // Priority: subLocality/neighborhood -> locality -> district -> city
    if (addr.district && addr.district.length > 0) return addr.district;
    if (addr.subregion && addr.subregion.length > 0) return addr.subregion;
    if (addr.city && addr.city.length > 0) return addr.city;
    if (addr.name && addr.name.length > 0) return addr.name;
    if (addr.region && addr.region.length > 0) return addr.region;
    return "Unknown Location";
  };

  const handleRefresh = async (isInitial = false) => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    startSpin();
    
    const oldLocation = locationName;
    setLocationName("Fetching location...");

    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      let finalStatus = status;

      if (status !== 'granted') {
        const { status: reqStatus } = await Location.requestForegroundPermissionsAsync();
        finalStatus = reqStatus;
      }

      if (finalStatus !== 'granted') {
        setLocationName("Permission denied");
        setIsRefreshing(false);
        stopSpin();
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const { latitude, longitude } = location.coords;

      // Service Area Check
      const serviceable = isServiceable(latitude, longitude);
      if (!serviceable) {
        setIsRefreshing(false);
        stopSpin();
        navigation.reset({
          index: 0,
          routes: [{ name: "ComingSoon" }]
        });
        return;
      }

      // Reverse Geocoding
      const addressList = await Location.reverseGeocodeAsync({ latitude, longitude });
      let reverseString = "Unknown Location";
      let postalCode = null;

      if (addressList && addressList.length > 0) {
        const addr = addressList[0];
        postalCode = addr.postalCode;
        reverseString = getLocality(addr);
      }

      // Check against strict Neatify Sub-Area mappings
      const matchedArea = getServiceAreaMatch(latitude, longitude, postalCode, reverseString);

      if (matchedArea) {
        setLocationName(matchedArea.name);
      } else {
        setLocationName(reverseString);
      }

    } catch (error) {
      console.warn("Location error:", error);
      setLocationName("Unable to update location");
      // Revert to old location after a brief message if it wasn't the initial load
      if (!isInitial && oldLocation !== "Fetching location..." && oldLocation !== "Unable to update location") {
        setTimeout(() => setLocationName(oldLocation), 2500);
      }
    } finally {
      setIsRefreshing(false);
      stopSpin();
    }
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

  return (
    <View style={[styles.container, isCurved && styles.curved]}>
      {/* TOP ROW */}
      <View style={styles.topRow}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => handleRefresh(false)}
          style={styles.brandContainer}
          disabled={isRefreshing}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="location" size={18} color="#111111" style={{ marginRight: 4 }} />
            <Text style={{ fontSize: 15, fontWeight: '700', color: '#111111' }}>
              {locationName}
            </Text>
            <Animated.View style={{ transform: [{ rotate: spin }], marginLeft: 6 }}>
              <Ionicons name="sync" size={14} color="#111111" />
            </Animated.View>
          </View>
        </TouchableOpacity>

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
    alignItems: "center",
    justifyContent: "space-between",
  },
  brandContainer: {
    justifyContent: "center",
    marginRight: 8,
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
