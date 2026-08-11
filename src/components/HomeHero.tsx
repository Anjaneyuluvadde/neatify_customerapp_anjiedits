import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";

const { width } = Dimensions.get("window");

export default function HomeHero() {
  return (
    <View style={styles.container}>

      <View style={styles.content}>

        <Text style={styles.title}>
          Professional Home
        </Text>

        <Text style={styles.title}>
          Cleaning in Hyderabad
        </Text>

        <View style={styles.badges}>

          <View style={styles.badge}>
            <Ionicons
              name="star"
              size={16}
              color="#111111"
            />

            <Text style={styles.badgeText}>
              4.9 Rating
            </Text>
          </View>

          <View style={styles.badge}>
            <Ionicons
              name="shield-checkmark"
              size={17}
              color="#111111"
            />

            <Text style={styles.badgeText}>
              Verified Pros
            </Text>
          </View>

          <View style={styles.badge}>
            <Ionicons
              name="flash"
              size={17}
              color="#111111"
            />

            <Text style={styles.badgeText}>
              Same Day Service
            </Text>
          </View>

        </View>

      </View>

      <Image
        source={require("../../assets/images/heroimg.png")}
        contentFit="contain"
        style={styles.heroImage}
      />

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 180,
    backgroundColor: "#FFC928",
    position: "relative",
    zIndex: 1,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },

  content: {
    paddingLeft: 16,
    paddingTop: 0,
    marginTop: -4,
    zIndex: 2,
    width: width * 0.55,
  },

  title: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "800",
    color: "#111111",
  },

  badges: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 14,
    gap: 10,
    flexWrap: "wrap",
  },

  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },

  badgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#111111",
  },

  heroImage: {
    position: "absolute",
    right: -10,
    bottom: -35,
    width: width * 0.65,
    height: 290,
    zIndex: 10,
  },
});
