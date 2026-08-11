import { Ionicons } from "@expo/vector-icons";
import { DrawerActions, useNavigation } from "@react-navigation/native";
import { Image } from "expo-image";
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

    return () => subscription.unsubscribe();
  }, []);

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
          <Image
            source={require("../../assets/images/neatifylogo.png")}
            contentFit="contain"
            style={styles.logo}
          />
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
          Good Morning, {userName} 
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
    fontSize: 16,
    fontWeight: "500",
    color: "#111111",
  },
});
