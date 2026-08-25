import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useBookingCart } from "../context/BookingCartContext";
import { useTheme } from "../context/ThemeContext";
import { useBottomNavPadding } from "../hooks/useBottomNavPadding";
import { COLORS } from "../theme/colors";
import Animated, { FadeInDown, FadeOutDown, Layout } from "react-native-reanimated";

export default function FloatingCartSummary() {
  const { totalUnits, totalPrice, cartItems, updateQuantity, removeService } = useBookingCart();
  const navigation = useNavigation<any>();
  const { theme } = useTheme();
  // Pass extraPadding=0 and ignoreCart=true because this is the cart itself!
  const { paddingBottom } = useBottomNavPadding(0, true);
  const [isExpanded, setIsExpanded] = useState(false);

  // If cart is empty, hide and reset state
  if (cartItems.length === 0) {
    if (isExpanded) setIsExpanded(false);
    return null;
  }

  const handleContinue = () => {
    navigation.navigate("Schedule", { services: cartItems });
  };

  return (
    <Animated.View
      layout={Layout.springify().damping(20).stiffness(200)}
      entering={FadeInDown.duration(300)}
      exiting={FadeOutDown.duration(300)}
      style={[
        styles.container,
        {
          bottom: paddingBottom + 16,
          backgroundColor: theme.surfaceVariant || "#F1F5F9",
          shadowColor: theme.text,
        },
      ]}
    >
      {isExpanded ? (
        <View>
          {/* Expanded Header */}
          <Pressable onPress={() => setIsExpanded(false)} style={styles.expandedHeader}>
            <Text style={{ fontSize: 16, fontWeight: "800", color: theme.text }}>
              Selected Services
            </Text>
            <Ionicons name="chevron-down" size={20} color={theme.text} />
          </Pressable>

          <View style={[styles.divider, { backgroundColor: theme.border }]} />

          {/* Service List */}
          <ScrollView style={{ maxHeight: 350 }} nestedScrollEnabled showsVerticalScrollIndicator={false}>
            {cartItems.map((item, index) => {
              const itemPrice = parseFloat(String(item.price).replace(/[^\d.]/g, "")) || 0;
              const qty = item.quantity || 1;
              const subtotal = itemPrice * qty;
              const isLast = index === cartItems.length - 1;

              return (
                <View key={item.id} style={{ paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: isLast ? 0 : 1, borderBottomColor: theme.border }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                    <Text style={{ fontSize: 15, fontWeight: "600", color: theme.text, flex: 1, paddingRight: 8, lineHeight: 22 }}>
                      {item.title}
                    </Text>
                    <Pressable
                      onPress={() => removeService(item.id)}
                      style={{ padding: 6, backgroundColor: theme.surfaceVariant, borderRadius: 8 }}
                    >
                      <Ionicons name="trash-outline" size={18} color="#EF4444" />
                    </Pressable>
                  </View>
                  
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                    <Text style={{ fontSize: 14, color: theme.textLight }}>
                      ₹{itemPrice.toLocaleString("en-IN")} × {qty}
                    </Text>
                    <Text style={{ fontSize: 15, fontWeight: "800", color: theme.text }}>
                      ₹{subtotal.toLocaleString("en-IN")}
                    </Text>
                  </View>

                  <View style={{ alignItems: "center" }}>
                    <View style={styles.quantityControl}>
                      <Pressable
                        style={styles.qtyBtn}
                        onPress={() => {
                          if (qty > 1) {
                            updateQuantity(item.id, -1);
                          } else {
                            removeService(item.id);
                          }
                        }}
                      >
                        <Ionicons name="remove" size={18} color={COLORS.black} />
                      </Pressable>
                      <Text style={styles.qtyText}>{qty}</Text>
                      <Pressable
                        style={styles.qtyBtn}
                        onPress={() => updateQuantity(item.id, 1)}
                      >
                        <Ionicons name="add" size={18} color={COLORS.black} />
                      </Pressable>
                    </View>
                  </View>
                </View>
              );
            })}
          </ScrollView>

          <View style={[styles.divider, { backgroundColor: theme.border }]} />

          {/* Expanded Footer */}
          <View style={{ padding: 16, paddingTop: 12 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <Text style={{ fontSize: 16, fontWeight: "700", color: theme.text }}>Total</Text>
              <Text style={{ fontSize: 18, fontWeight: "900", color: theme.text }}>
                ₹{totalPrice.toLocaleString("en-IN")}
              </Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Pressable style={styles.continueButton} onPress={handleContinue}>
                <Text style={styles.continueText}>Continue</Text>
                <Ionicons name="arrow-forward" size={16} color={COLORS.black} />
              </Pressable>
            </View>
          </View>
        </View>
      ) : (
        <View style={{ padding: 16 }}>
          {/* Collapsed State */}
          <Pressable
            onPress={() => setIsExpanded(true)}
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 12,
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: "600", color: theme.textLight }}>
              {cartItems.length} {cartItems.length === 1 ? "Service" : "Services"} · {totalUnits} {totalUnits === 1 ? "Unit" : "Units"}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={{ fontSize: 18, fontWeight: "900", color: theme.text }}>
                ₹{totalPrice.toLocaleString("en-IN")}
              </Text>
              <Ionicons name="chevron-up" size={18} color={theme.text} />
            </View>
          </Pressable>

          <View style={{ alignItems: "flex-end" }}>
            <Pressable style={styles.continueButton} onPress={handleContinue}>
              <Text style={styles.continueText}>Continue</Text>
              <Ionicons name="arrow-forward" size={16} color={COLORS.black} />
            </Pressable>
          </View>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 16,
    right: 16,
    borderRadius: 16,
    elevation: 8,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    zIndex: 9999,
  },
  expandedHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
  },
  divider: {
    height: 1,
    width: "100%",
  },
  continueButton: {
    backgroundColor: "#FDE047", // Yellow theme
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  continueText: {
    color: COLORS.black,
    fontWeight: "800",
    fontSize: 16,
  },
  quantityControl: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FDE047',
    borderRadius: 12,
    overflow: 'hidden',
    width: 140,
    justifyContent: 'space-between',
  },
  qtyBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyText: {
    fontWeight: '800',
    fontSize: 16,
    color: COLORS.black,
  },
});
