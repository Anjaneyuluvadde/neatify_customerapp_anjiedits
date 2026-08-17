import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import React, { useEffect, useRef } from "react";
import {
  Animated,
  Dimensions,
  StyleSheet,
  Text,
  View,
  Easing,
  TouchableOpacity,
} from "react-native";

const { width } = Dimensions.get("window");

export default function HomeHero() {
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleTranslateY = useRef(new Animated.Value(15)).current;

  const detailsOpacity = useRef(new Animated.Value(0)).current;
  const detailsTranslateY = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    // 2. Main Title Text (0.4s, 0.1s delay)
    Animated.parallel([
      Animated.timing(titleOpacity, {
        toValue: 1,
        duration: 400,
        delay: 100,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(titleTranslateY, {
        toValue: 0,
        duration: 400,
        delay: 100,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();

    // 3. Supporting Details & Badges (0.4s, 0.2s delay)
    Animated.parallel([
      Animated.timing(detailsOpacity, {
        toValue: 1,
        duration: 400,
        delay: 200,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(detailsTranslateY, {
        toValue: 0,
        duration: 400,
        delay: 200,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Animated.View style={{ opacity: titleOpacity, transform: [{ translateY: titleTranslateY }] }}>
          <Text style={styles.headline}>
            Clean Home,{"\n"}Zero Hassle.
          </Text>
        </Animated.View>

        <Animated.View style={[{ opacity: detailsOpacity, transform: [{ translateY: detailsTranslateY }] }]}>
          <TouchableOpacity style={styles.ctaButton} activeOpacity={0.8}>
            <Text style={styles.ctaText}>Book a Service →</Text>
          </TouchableOpacity>

          <View style={styles.badges}>
            <View style={styles.badge}>
              <Ionicons name="star" size={14} color="#111111" />
              <Text style={styles.badgeText}>4.9 Rating</Text>
            </View>
            <View style={styles.badge}>
              <Ionicons name="shield-checkmark" size={15} color="#111111" />
              <Text style={styles.badgeText}>Verified Pros</Text>
            </View>
            <View style={styles.badge}>
              <Ionicons name="flash" size={15} color="#111111" />
              <Text style={styles.badgeText}>Same Day Service</Text>
            </View>
          </View>
        </Animated.View>
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
    height: 250,
    backgroundColor: "#FFC928",
    position: "relative",
    zIndex: 1,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  content: {
    paddingLeft: 24,
    paddingTop: 12,
    paddingBottom: 24,
    zIndex: 2,
    width: width * 0.62,
    justifyContent: 'center',
    height: '100%',
    marginTop: -15,
  },
  headline: {
    fontSize: 27,
    lineHeight: 32,
    fontWeight: "900",
    color: "#0F172A",
    marginBottom: 16,
    letterSpacing: -0.5,
  },
  ctaButton: {
    backgroundColor: "#0F172A",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 24,
    alignSelf: "flex-start",
    marginBottom: 16,
  },
  ctaText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  badges: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    gap: 10,
    flexWrap: "wrap",
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.3)",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#111111",
  },
  heroImage: {
    position: "absolute",
    right: -15,
    bottom: -15,
    width: width * 0.70,
    height: 320,
    zIndex: 10,
  },
});
