import React from "react";
import { View, Text, StyleSheet, Pressable, StatusBar, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { RouteProp, useNavigation } from "@react-navigation/native";
import { Image } from "expo-image";

import { useTheme } from "../context/ThemeContext";
import { useBottomNavPadding } from "../hooks/useBottomNavPadding";
import { RootStackParamList } from "../navigation/AppNavigator";

type Props = {
  route: RouteProp<RootStackParamList, "Subservices">;
};

export default function SubservicesScreen({ route }: Props) {
  const { mainCategoryName, subCategories } = route.params;
  const { theme } = useTheme();
  const bottomNavPadding = useBottomNavPadding();
  const navigation = useNavigation<any>();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={["top"]}>
      <StatusBar barStyle={theme.background === "#FFFFFF" ? "dark-content" : "light-content"} />
      
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <Pressable 
          onPress={() => navigation.goBack()}
          style={[styles.backButton, { backgroundColor: theme.surfaceVariant }]}
        >
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.text }]}>{mainCategoryName}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, bottomNavPadding]}
      >
        <View style={styles.categoryGrid}>
          {subCategories.map((cat: any) => (
            <Pressable
              key={cat.value}
              style={styles.categoryItem}
              onPress={() => {
                navigation.navigate("CategoryDetail", {
                  category: cat.value,
                  label: cat.label
                });
              }}
            >
              <View style={[styles.categoryIconContainer, { backgroundColor: theme.surfaceVariant || "#F5F7FA" }]}>
                {cat.icon ? (
                  <Image source={{ uri: cat.icon }} style={styles.categoryImage} contentFit="contain" />
                ) : (
                  <Ionicons name="apps-outline" size={32} color={theme.primary} />
                )}
              </View>
              <Text style={[styles.categoryLabel, { color: theme.text }]} numberOfLines={2}>
                {cat.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 40,
  },
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  categoryItem: {
    width: "33.33%",
    alignItems: "center",
    marginBottom: 24,
    paddingHorizontal: 6,
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
