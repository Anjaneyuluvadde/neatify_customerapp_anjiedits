import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import React, { memo } from "react";
import { Dimensions, Pressable, StyleSheet, Text, View } from "react-native";
import { useBookingCart } from "../context/BookingCartContext";
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
  const { cartItems, addService, updateQuantity, removeService } = useBookingCart();

  const cartItem = cartItems.find(s => s.id === service.id);

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
          <Ionicons name="time-outline" size={12} color={theme.textLight} />
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

          {/* Cart Actions */}
          <View style={styles.cartActionContainer}>
            {cartItem ? (
              <View style={styles.quantityControl}>
                <Pressable
                  style={styles.qtyBtn}
                  onPress={(e) => {
                    e.stopPropagation();
                    if (cartItem.quantity && cartItem.quantity > 1) {
                      updateQuantity(service.id, -1);
                    } else {
                      removeService(service.id);
                    }
                  }}
                >
                  <Ionicons name="remove" size={16} color={COLORS.black} />
                </Pressable>
                <Text style={styles.qtyText}>{cartItem.quantity || 1}</Text>
                <Pressable
                  style={styles.qtyBtn}
                  onPress={(e) => {
                    e.stopPropagation();
                    updateQuantity(service.id, 1);
                  }}
                >
                  <Ionicons name="add" size={16} color={COLORS.black} />
                </Pressable>
              </View>
            ) : (
              <Pressable
                style={styles.addButton}
                onPress={(e) => {
                  e.stopPropagation();
                  addService(service);
                }}
              >
                <Ionicons name="add" size={14} color={COLORS.black} />
                <Text style={styles.addButtonText}>Add</Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'column',
    flex: 1,
    marginVertical: 8,
    borderRadius: 16,
    overflow: "hidden",
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    borderWidth: 1,
    backgroundColor: '#fff',
  },
  imageContainer: {
    position: 'relative',
    width: '100%',
    height: 120,
    backgroundColor: '#F1F5F9', // subtle placeholder color
  },
  image: {
    height: '100%',
    width: '100%',
  },
  specialOfferBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(254, 243, 199, 0.95)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  specialOfferText: {
    color: '#92400E',
    fontSize: 9,
    fontWeight: '800',
  },
  content: {
    padding: 12,
    flex: 1,
    justifyContent: 'flex-start',
  },
  title: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.black,
    marginBottom: 6,
    lineHeight: 18,
    height: 36, // fix height to align rows
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  durationText: {
    fontSize: 11,
    fontWeight: '500',
    color: "#64748B",
  },
  bottomRow: {
    flexDirection: "row",
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  priceColumn: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: 2,
  },
  currentPrice: {
    fontSize: 15,
    fontWeight: "800",
  },
  originalPrice: {
    fontSize: 11,
    color: "#94A3B8",
    textDecorationLine: "line-through",
    fontWeight: '500',
  },
  cartActionContainer: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FDE047',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 4,
  },
  addButtonText: {
    fontWeight: '700',
    color: COLORS.black,
    fontSize: 13,
  },
  quantityControl: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FDE047',
    borderRadius: 20,
    overflow: 'hidden',
  },
  qtyBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyText: {
    fontWeight: '700',
    fontSize: 13,
    color: COLORS.black,
    paddingHorizontal: 4,
  },
});
