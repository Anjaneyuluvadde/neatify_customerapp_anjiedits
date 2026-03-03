import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { Image } from "expo-image";
import { TextInput, TouchableOpacity, View } from "react-native";

import { useLanguage } from "../context/LanguageContext";
import { useAuthGuard } from "../hooks/useAuthGuard";
import { COLORS } from "../theme/colors";

type HeaderProps = {
  searchText?: string;
  onSearchChange?: (text: string) => void;
};

export default function Header({ searchText, onSearchChange }: HeaderProps) {
  const navigation = useNavigation<any>();
  const { checkAuth } = useAuthGuard();
  const { t } = useLanguage();

  const handleMyBookingsPress = async () => {
    const isAuth = await checkAuth("view your bookings");
    if (isAuth) {
      navigation.navigate("MyBookings");
    }
  };

  const handleProfilePress = async () => {
    const isAuth = await checkAuth("access your profile");
    if (isAuth) {
      navigation.navigate("Profile");
    }
  };

  return (
    <View
      style={{
        backgroundColor: "#fff",
        paddingTop: 10,
        paddingHorizontal: 16,
        paddingBottom: 12,
      }}
    >
      {/* ✅ TOP ROW */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {/* ✅ LOGO LEFT */}
        <View style={{ flex: 1 }}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => navigation.reset({ index: 0, routes: [{ name: "Home" }] })}
          >
            <Image
              source={require("../../assets/images/neatifylogo.png")}
              contentFit="contain"
              style={{
                width: 160,
                height: 40,
                marginLeft: "-8%",
              }}
            />
          </TouchableOpacity>
        </View>

        {/* ✅ ICONS RIGHT */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 16,
          }}
        >
          {/* <View style={{ transform: [{ scale: 0.9 }] }}>
            <LanguageSelector />
          </View> */}

          <TouchableOpacity
            onPress={handleMyBookingsPress}
            activeOpacity={0.8}
            style={{ position: "relative" }}
          >
            <Ionicons name="calendar-outline" size={24} color={COLORS.black} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleProfilePress}
            activeOpacity={0.8}
          >
            <Ionicons name="person-outline" size={24} color={COLORS.black} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ✅ SEARCH BOX (RENDER ONLY IF SEARCH FUNCTION PROVIDED) */}
      {onSearchChange && (
        <View
          style={{
            marginTop: 10,
            backgroundColor: "#F8FAFC",
            borderWidth: 1,
            borderColor: "#E2E8F0",
            borderRadius: 14,
            paddingHorizontal: 12,
            height: 46,
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
          }}
        >
          <Ionicons name="search-outline" size={18} color={COLORS.gray} />

          <TextInput
            value={searchText}
            onChangeText={onSearchChange}
            placeholder={t("home.searchPlaceholder")}
            placeholderTextColor={COLORS.gray}
            style={{
              flex: 1,
              fontSize: 14,
              color: COLORS.black,
            }}
            returnKeyType="search"
          />
        </View>
      )}
    </View>
  );
}
