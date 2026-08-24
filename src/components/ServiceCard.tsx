import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import React, { memo } from "react";
import { Dimensions, Pressable, StyleSheet, Text, View } from "react-native";
import { useLanguage } from "../context/LanguageContext";
import { useTheme } from "../context/ThemeContext";
import { COLORS } from "../theme/colors";
import { Service } from "../types/service";

const { width } = Dimensions.get("window");

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
          <Ionicons name="pricetag" size={10} color="#92400E" />
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
          <Ionicons name="time-outline" size={14} color={theme.textLight} />
          <Text style={[styles.durationText, { color: theme.textLight }]}>{service.duration}</Text>
        </View>

        <View style={styles.bottomRow}>
          <View style={styles.priceRow}>
            <Text style={[styles.currentPrice, { color: theme.text }]}>
              {String(service.price).startsWith('₹') ? service.price : `₹${service.price}`}
            </Text>
            {service.original_price && Number(String(service.original_price).replace(/[^\d.]/g, '')) > 0 ? (
              <Text style={styles.originalPrice}>
                {String(service.original_price).startsWith('₹') ? service.original_price : `₹${service.original_price}`}
              </Text>
            ) : null}
          </View>
        </View>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 16,
    overflow: "hidden",
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    borderWidth: 1,
    padding: 12,
  },
  imageContainer: {
    position: 'relative',
    marginRight: 12,
  },
  image: {
    height: 100,
    width: 100,
    borderRadius: 12,
  },
  specialOfferBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: 'rgba(254, 243, 199, 0.95)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 2,
  },
  specialOfferText: {
    color: '#92400E',
    fontSize: 9,
    fontWeight: '800',
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.black,
    marginBottom: 4,
    lineHeight: 22,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  durationText: {
    fontSize: 12,
    fontWeight: '500',
    color: "#64748B",
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  currentPrice: {
    fontSize: 16,
    fontWeight: "800",
  },
  originalPrice: {
    fontSize: 12,
    color: "#94A3B8",
    textDecorationLine: "line-through",
    fontWeight: '500',
  },

});
