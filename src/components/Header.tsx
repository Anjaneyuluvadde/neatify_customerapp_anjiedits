import { Ionicons } from "@expo/vector-icons";
import { DrawerActions, useNavigation } from "@react-navigation/native";
import { Image } from "expo-image";
import * as Location from "expo-location";
import React, { useEffect, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { useLanguage } from "../context/LanguageContext";
import { useTheme } from "../context/ThemeContext";
import { useAuthGuard } from "../hooks/useAuthGuard";
import { supabase } from "../lib/supabase";

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

    fetchCurrentLocation();

    return () => subscription.unsubscribe();
  }, []);

  const fetchCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationName("Permission denied");
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const { latitude, longitude } = location.coords;
      const addressList = await Location.reverseGeocodeAsync({ latitude, longitude });

      if (addressList && addressList.length > 0) {
        const address = addressList[0];
        const name = address.city || address.subregion || address.region || "Unknown Location";
        setLocationName(name);
      } else {
        setLocationName("Unknown Location");
      }
    } catch (error) {
      console.error("Location error:", error);
      setLocationName("Location unavailable");
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
          activeOpacity={0.8}
          onPress={() =>
            navigation.reset({
              index: 0,
              routes: [{ name: "HomeDrawer" }],
            })
          }
          style={styles.brandContainer}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="location" size={18} color="#111111" style={{ marginRight: 4 }} />
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#111111' }}>
              {locationName}
            </Text>
          </View>
        </TouchableOpacity>

        <View style={styles.rightActions}>
          <TouchableOpacity style={styles.actionButton}>
            <Ionicons
              name="notifications"
              size={25}
              color="#111111"
            />

            <View style={styles.notificationBadge}>
              <Text style={styles.notificationBadgeText}>
                2
              </Text>
            </View>
          </TouchableOpacity>

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
      <View style={styles.greetingContainer}>
        <Text style={styles.greeting}>
          Hello, {userName} 
        </Text>
      </View>
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
  actionButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  profileButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  notificationBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    width: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: "#F4B400",
    alignItems: "center",
    justifyContent: "center",
  },
  notificationBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#111111",
  },
  greetingContainer: {
    marginTop: 22,
  },
  greeting: {
    fontSize: 22,
    fontWeight: "800",
    color: "#111111",
    letterSpacing: 0.5,
  },
});
