import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import React, { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useLanguage } from "../context/LanguageContext";
import { useTheme } from "../context/ThemeContext";
import { COLORS } from "../theme/colors";
import { Service } from "../types/service";

type Props = {
  service: Service;
  onPress: () => void;
};

export default memo(function ServiceCard({ service, onPress }: Props) {
  const { t } = useLanguage();
  const { theme, isDark } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.container,
        {
          backgroundColor: theme.background,
          borderColor: theme.border,
          opacity: pressed ? 0.9 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        }
      ]}
    >
      <View style={styles.imageContainer}>
        <Image
          source={{ uri: service.image }}
          style={styles.image}
        />
        {/* Special Offer Badge */}
        <View style={styles.specialOfferBadge}>
          <Ionicons name="pricetag" size={12} color="#92400E" />
          <Text style={styles.specialOfferText}>Special Offer</Text>
        </View>
      </View>

      <View style={styles.content}>
        <Text
          numberOfLines={2}
          ellipsizeMode="tail"
          style={[styles.title, { color: theme.text }]}
        >
          {service.title}
        </Text>

        <View style={styles.infoRow}>
          <Ionicons name="time-outline" size={16} color={theme.textLight} />
          <Text style={[styles.durationText, { color: theme.textLight }]}>{service.duration}</Text>
        </View>

        <View style={styles.priceRow}>
          {service.original_price && Number(String(service.original_price).replace(/[^\d.]/g, '')) > 0 ? (
            <Text style={styles.originalPrice}>₹{service.original_price}</Text>
          ) : null}
          <Text style={[styles.currentPrice, { color: theme.text }]}>{service.price}</Text>
        </View>

        <View style={styles.button}>
          <Text style={styles.buttonText}>
            {t("home.viewService") || "View Service"}
          </Text>
          <Ionicons name="arrow-forward" size={18} color={COLORS.black} />
        </View>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    margin: 8,
    borderRadius: 20,
    overflow: "hidden",
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    borderWidth: 1,
  },
  imageContainer: {
    position: 'relative',
  },
  image: {
    height: 120,
    width: "100%",
  },
  specialOfferBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(254, 243, 199, 0.9)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  specialOfferText: {
    color: '#92400E',
    fontSize: 12,
    fontWeight: '800',
  },
  content: {
    padding: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: "800",
    color: COLORS.black,
    marginBottom: 8,
    lineHeight: 20,
    height: 40,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  durationText: {
    fontSize: 13,
    fontWeight: '600',
    color: "#64748B",
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  originalPrice: {
    fontSize: 13,
    color: "#94A3B8",
    textDecorationLine: "line-through",
    fontWeight: '500',
  },
  currentPrice: {
    fontSize: 18,
    fontWeight: "800",
  },
  button: {
    backgroundColor: COLORS.saffron,
    paddingVertical: 10,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  buttonText: {
    color: COLORS.black,
    fontWeight: "800",
    fontSize: 14,
  },
});
