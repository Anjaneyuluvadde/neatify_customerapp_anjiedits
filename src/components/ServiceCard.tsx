import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import React, { memo } from "react";
import { Pressable, StyleSheet, Text, View, Dimensions } from "react-native";

const { width } = Dimensions.get("window");
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
            <Text style={styles.originalPrice}>
              {String(service.original_price).startsWith('₹') ? service.original_price : `₹${service.original_price}`}
            </Text>
          ) : null}
          <Text style={[styles.currentPrice, { color: theme.text }]}>
            {String(service.price).startsWith('₹') ? service.price : `₹${service.price}`}
          </Text>
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
    maxWidth: width / 2 - 24,
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
    height: 85,
    width: "100%",
  },
  specialOfferBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: 'rgba(254, 243, 199, 0.9)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  specialOfferText: {
    color: '#92400E',
    fontSize: 10,
    fontWeight: '800',
  },
  content: {
    padding: 10,
  },
  title: {
    fontSize: 14,
    fontWeight: "800",
    color: COLORS.black,
    marginBottom: 4,
    lineHeight: 18,
    height: 36,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  durationText: {
    fontSize: 11,
    fontWeight: '600',
    color: "#64748B",
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
  },
  originalPrice: {
    fontSize: 12,
    color: "#94A3B8",
    textDecorationLine: "line-through",
    fontWeight: '500',
  },
  currentPrice: {
    fontSize: 15,
    fontWeight: "800",
  },
  button: {
    backgroundColor: COLORS.saffron,
    paddingVertical: 6,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  buttonText: {
    color: COLORS.black,
    fontWeight: "800",
    fontSize: 12,
  },
});
