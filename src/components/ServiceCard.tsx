import { Image } from "expo-image";
import React, { memo } from "react";
import { Pressable, Text, View } from "react-native";
import { useLanguage } from "../context/LanguageContext";
import { COLORS } from "../theme/colors";
import { Service } from "../types/service";

type Props = {
  service: Service;
  onPress: () => void;
};

export default memo(function ServiceCard({ service, onPress }: Props) {
  const { t } = useLanguage();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        margin: 8,
        backgroundColor: COLORS.white,
        borderWidth: 1,
        borderColor: COLORS.grayLight,
        borderRadius: 14,
        overflow: "hidden",
        minHeight: 320,
        opacity: pressed ? 0.7 : 1, // ✅ Visual feedback when pressed
        transform: [{ scale: pressed ? 0.98 : 1 }], // ✅ Slight scale effect
      })}
    >
      <Image
        source={{ uri: service.image }}
        style={{ height: 140, width: "100%" }}
      />

      <View style={{ padding: 12, flex: 1 }}>
        {/* ✅ Title fixed height */}
        <Text
          numberOfLines={2}
          ellipsizeMode="tail"
          style={{
            fontSize: 16,
            fontWeight: "700",
            color: COLORS.black,
            minHeight: 44,
          }}
        >
          {service.title}
        </Text>

        <View
          style={{
            height: 1,
            backgroundColor: COLORS.grayLight,
            marginVertical: 10,
          }}
        />

        {/* ✅ Duration */}
        <Text style={{ color: COLORS.textLight }}>{service.duration}</Text>

        {/* ✅ Pricing Display */}
        <View style={{ marginTop: 6, flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
          {/* Original Price (strikethrough) */}
          {service.original_price && Number(String(service.original_price).replace(/[^\d.]/g, '')) > 0 ? (
            <Text
              style={{
                fontSize: 13,
                color: "#777",
                textDecorationLine: "line-through",
              }}
            >
              {service.original_price}
            </Text>
          ) : null}

          {/* Current Price */}
          <Text
            style={{
              fontSize: 16,
              fontWeight: "600",
              color: COLORS.black,
            }}
          >
            {service.price}
          </Text>

          {/* Discount Badge */}
          {service.discount_label ? (
            <View
              style={{
                backgroundColor: "#E9F7EF",
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 12,
              }}
            >
              <Text
                style={{
                  color: "#1E7E34",
                  fontWeight: "700",
                  fontSize: 11,
                }}
              >
                {service.discount_label || t("home.specialOffer")}
              </Text>
            </View>
          ) : null}
        </View>

        {/* ✅ Push button indicator to bottom */}
        <View style={{ flex: 1 }} />

        {/* ✅ Visual button indicator (non-interactive, just for show) */}
        <View
          style={{
            marginTop: 14,
            backgroundColor: COLORS.saffron,
            paddingVertical: 10,
            borderRadius: 10,
            alignItems: "center",
          }}
        >
          <Text style={{ color: COLORS.black, fontWeight: "600" }}>
            {t("home.viewService")}
          </Text>
        </View>
      </View>
    </Pressable>
  );
});
