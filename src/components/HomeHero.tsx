import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Animated,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";

const { width } = Dimensions.get("window");

const WavyText = ({ text, style, delayOffset = 0 }: { text: string, style: any, delayOffset?: number }) => {
  const chars = text.split('');
  const animatedValues = useRef(chars.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    const animations = chars.map((_, i) =>
      Animated.sequence([
        Animated.timing(animatedValues[i], {
          toValue: 1,
          duration: 350,
          useNativeDriver: true,
        }),
        Animated.timing(animatedValues[i], {
          toValue: 0,
          duration: 350,
          useNativeDriver: true,
        }),
      ])
    );

    // Initial delay for staggered entry if needed
    setTimeout(() => {
      Animated.loop(
        Animated.stagger(50, animations)
      ).start();
    }, delayOffset);
  }, []);

  const words = text.split(' ');
  let charIndex = 0;

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
      {words.map((word, wIndex) => {
        const wordNode = (
          <View key={`word-${wIndex}`} style={{ flexDirection: 'row' }}>
            {word.split('').map((char) => {
              const currentIdx = charIndex;
              charIndex++;
              return (
                <Animated.Text
                  key={`char-${currentIdx}`}
                  style={[
                    style,
                    {
                      transform: [
                        {
                          translateY: animatedValues[currentIdx].interpolate({
                            inputRange: [0, 1],
                            outputRange: [0, -6],
                          }),
                        },
                      ],
                    },
                  ]}
                >
                  {char}
                </Animated.Text>
              );
            })}
            {wIndex < words.length - 1 && <Text style={style}>{' '}</Text>}
          </View>
        );
        charIndex++; // Increment for space
        return wordNode;
      })}
    </View>
  );
};

export default function HomeHero() {
  return (
    <View style={styles.container}>

      <View style={styles.content}>

        <WavyText text="Professional Home" style={styles.title} />
        
        <WavyText text="Cleaning in Hyderabad" style={styles.title} delayOffset={900} />

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
