import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import React, { useMemo } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

import { useCart } from "../context/CartContext";
import { COLORS } from "../theme/colors";

export default function CartScreen() {
  const navigation = useNavigation<any>();
  const { cartItems, removeFromCart, clearCart, loadingCart } = useCart();

  const total = useMemo(() => {
    return cartItems.reduce((sum, item) => {
      const num = Number((item.price || "").replace(/[^\d]/g, ""));
      return sum + (isNaN(num) ? 0 : num);
    }, 0);
  }, [cartItems]);

  // ✅ Convert cart items to SelectedService[] for Schedule screen
  const servicesForSchedule = useMemo(() => {
    return cartItems.map((item) => ({
      id: item.service_id,
      title: item.title,
      duration: item.duration,
      price: item.price,
      image: item.image,
    }));
  }, [cartItems]);

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      {/* HEADER */}
      <View
        style={{
          paddingTop: 14,
          paddingHorizontal: 16,
          paddingBottom: 14,
          borderBottomWidth: 1,
          borderColor: COLORS.grayLight,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Text style={{ fontSize: 22, fontWeight: "900", color: COLORS.black }}>
          My Cart
        </Text>

        {cartItems.length > 0 ? (
          <Pressable onPress={clearCart}>
            <Text style={{ fontWeight: "800", color: "#dc2626" }}>Clear</Text>
          </Pressable>
        ) : null}
      </View>

      {/* ✅ LOADING */}
      {loadingCart ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={COLORS.black} />
          <Text style={{ marginTop: 12, color: COLORS.gray }}>
            Loading cart...
          </Text>
        </View>
      ) : cartItems.length === 0 ? (
        /* ✅ EMPTY CART */
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <Ionicons name="cart-outline" size={50} color={COLORS.gray} />
          <Text style={{ marginTop: 12, fontSize: 16, color: COLORS.gray }}>
            Your cart is empty
          </Text>

          <Pressable
            onPress={() => navigation.navigate("Home")}
            style={{
              marginTop: 16,
              backgroundColor: COLORS.saffron,
              paddingVertical: 12,
              paddingHorizontal: 20,
              borderRadius: 12,
            }}
          >
            <Text style={{ fontWeight: "900", color: "#000" }}>
              Browse Services
            </Text>
          </Pressable>
        </View>
      ) : (
        <>
          {/* CART LIST */}
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
            {/* ✅ Add more services */}
            <Pressable
              onPress={() => navigation.navigate("Home")}
              style={{
                borderWidth: 1,
                borderColor: COLORS.grayLight,
                borderRadius: 14,
                paddingVertical: 14,
                alignItems: "center",
                marginBottom: 14,
              }}
            >
              <Text style={{ fontWeight: "900", color: COLORS.black }}>
                + Add More Services
              </Text>
            </Pressable>

            {cartItems.map((item) => (
              <View
                key={item.id}
                style={{
                  flexDirection: "row",
                  gap: 12,
                  borderWidth: 1,
                  borderColor: COLORS.grayLight,
                  borderRadius: 16,
                  padding: 12,
                  marginBottom: 14,
                  backgroundColor: "#fff",
                }}
              >
                {/* IMAGE */}
                {item.image && item.image.trim() !== '' ? (
                  <Image
                    source={{ uri: item.image }}
                    style={{
                      width: 78,
                      height: 78,
                      borderRadius: 16,
                      backgroundColor: "#f1f5f9",
                    }}
                  />
                ) : (
                  <View
                    style={{
                      width: 78,
                      height: 78,
                      borderRadius: 16,
                      backgroundColor: "#f1f5f9",
                    }}
                  />
                )}

                {/* DETAILS */}
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontWeight: "900",
                      fontSize: 16,
                      color: COLORS.black,
                    }}
                    numberOfLines={2}
                  >
                    {item.title}
                  </Text>

                  <Text style={{ marginTop: 5, color: COLORS.textLight }}>
                    {item.duration}
                  </Text>

                  <Text
                    style={{
                      marginTop: 6,
                      fontWeight: "900",
                      fontSize: 16,
                    }}
                  >
                    {item.price}
                  </Text>

                  {/* ✅ Remove Button */}
                  <Pressable
                    onPress={() => removeFromCart(item.service_id)}
                    style={{ marginTop: 10 }}
                  >
                    <Text style={{ color: "#dc2626", fontWeight: "900" }}>
                      Remove
                    </Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </ScrollView>

          {/* ✅ BOTTOM FOOTER */}
          <View
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              backgroundColor: "#fff",
              padding: 16,
              borderTopWidth: 1,
              borderColor: "#f1f5f9",
            }}
          >
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                marginBottom: 12,
              }}
            >
              <Text style={{ fontWeight: "900", fontSize: 16 }}>Total</Text>
              <Text style={{ fontWeight: "900", fontSize: 16 }}>₹{total}</Text>
            </View>

            <Pressable
              onPress={() => {
                navigation.navigate("Schedule", {
                  services: servicesForSchedule,
                });
              }}
              style={{
                backgroundColor: COLORS.saffron,
                paddingVertical: 14,
                borderRadius: 14,
                alignItems: "center",
              }}
            >
              <Text style={{ color: "#000", fontWeight: "900", fontSize: 16 }}>
                Continue Booking
              </Text>
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}
