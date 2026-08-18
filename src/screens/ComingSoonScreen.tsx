import React, { useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { useNavigation } from "@react-navigation/native";
import Animated, { 
  FadeInDown, 
  FadeInUp, 
  useAnimatedStyle, 
  useSharedValue, 
  withRepeat, 
  withSequence, 
  withTiming,
  withSpring
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { COLORS } from "../theme/colors";
import NeatifyLogo from "../../assets/images/neatifylogo.png";

export default function ComingSoonScreen() {
  const navigation = useNavigation<any>();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  // Animation values
  const buttonScale = useSharedValue(1);
  const characterBob = useSharedValue(0);

  useEffect(() => {
    // 3D character bobbing animation (6-10px)
    characterBob.value = withRepeat(
      withSequence(
        withTiming(-8, { duration: 1800 }),
        withTiming(0, { duration: 1800 })
      ),
      -1,
      true
    );
  }, []);

  const characterAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: characterBob.value }],
    };
  });

  const buttonAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: buttonScale.value }],
    };
  });

  const handlePressIn = () => { buttonScale.value = withSpring(0.96); };
  const handlePressOut = () => { buttonScale.value = withSpring(1); };

  const handleCheckAgain = () => {
    // Go back to the LocationAccessScreen to trigger a fresh GPS check
    navigation.replace("LocationAccess");
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Background Decorators */}
      <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
        <View style={styles.bgCircleTop} />
        <View style={styles.bgCircleBottom} />
      </View>

      <View style={[styles.content, isDesktop && styles.desktopContent]}>
        
        {/* LOGO */}
        <Animated.View entering={FadeInUp.duration(600).delay(100)} style={styles.logoContainer}>
          <Image source={NeatifyLogo} style={styles.logo} contentFit="contain" />
        </Animated.View>

        {/* HERO SECTION */}
        <View style={styles.heroSection}>
          
          {/* 3D Character */}
          <Animated.View entering={FadeInDown.duration(600).delay(200)} style={characterAnimatedStyle}>
            <Image 
              source={require("../../assets/images/heroimg.png")} 
              style={styles.characterImage}
              contentFit="contain"
            />
          </Animated.View>

          {/* Coming Soon UI */}
          <Animated.View entering={FadeInDown.duration(600).delay(400)} style={styles.textContainer}>
            <Text style={styles.title}>We're coming soon! 📍</Text>
            <Text style={styles.subtitle}>
              Neatify isn't available in your area yet.
            </Text>
            <Text style={styles.desc}>
              We're rapidly expanding our services across Hyderabad and hope to reach you very soon.
            </Text>
          </Animated.View>
        </View>

        {/* ACTIONS */}
        <View style={styles.actionContainer}>
          <Animated.View entering={FadeInDown.duration(600).delay(600)}>
            <TouchableOpacity 
              activeOpacity={0.8}
              onPressIn={handlePressIn} 
              onPressOut={handlePressOut} 
              onPress={handleCheckAgain}
            >
              <Animated.View style={[styles.primaryBtn, buttonAnimatedStyle]}>
                <Text style={styles.primaryText}>Check Again</Text>
              </Animated.View>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  desktopContent: {
    maxWidth: 500,
    alignSelf: "center",
    width: "100%",
  },
  bgCircleTop: {
    position: "absolute",
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: COLORS.saffron + "15",
    top: -100,
    right: -100,
  },
  bgCircleBottom: {
    position: "absolute",
    width: 400,
    height: 400,
    borderRadius: 200,
    backgroundColor: COLORS.saffron + "10",
    bottom: -150,
    left: -150,
  },
  logoContainer: {
    alignItems: "center",
    marginTop: 40,
    marginBottom: 10,
  },
  logo: {
    width: 140,
    height: 40,
  },
  heroSection: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -40,
  },
  characterImage: {
    width: 220,
    height: 200,
    marginBottom: 40,
  },
  textContainer: {
    alignItems: "center",
    paddingHorizontal: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#111",
    marginBottom: 12,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#444",
    marginBottom: 8,
    textAlign: "center",
  },
  desc: {
    fontSize: 15,
    color: "#666",
    textAlign: "center",
    lineHeight: 22,
    fontWeight: "500",
  },
  actionContainer: {
    marginTop: 20,
  },
  primaryBtn: {
    backgroundColor: COLORS.saffron,
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: COLORS.saffron,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
  },
  primaryText: {
    color: "#111",
    fontWeight: "800",
    fontSize: 16,
    letterSpacing: 0.5,
  },
});
