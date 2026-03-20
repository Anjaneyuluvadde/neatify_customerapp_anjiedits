import { Ionicons } from "@expo/vector-icons";
import { useNavigation, DrawerActions } from "@react-navigation/native";
import { Image } from "expo-image";
import { TextInput, TouchableOpacity, View, StyleSheet } from "react-native";

import { useLanguage } from "../context/LanguageContext";
import { useAuthGuard } from "../hooks/useAuthGuard";
import { useTheme } from "../context/ThemeContext";
import { COLORS } from "../theme/colors";

type HeaderProps = {
  searchText?: string;
  onSearchChange?: (text: string) => void;
};

export default function Header({ searchText, onSearchChange }: HeaderProps) {
  const navigation = useNavigation<any>();
  const { checkAuth } = useAuthGuard();
  const { t } = useLanguage();
  const { theme, isDark } = useTheme();


  const handleMenuPress = () => {
    const drawerNav = navigation.getParent("root-drawer") || navigation;
    drawerNav.dispatch(DrawerActions.toggleDrawer());
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]} pointerEvents="box-none">
      {/* ✅ TOP ROW */}
      <View style={styles.topRow} pointerEvents="box-none">
        {/* ✅ LOGO LEFT */}
        <View style={{ flex: 1 }} pointerEvents="box-none">
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => navigation.reset({ index: 0, routes: [{ name: "HomeDrawer" }] })}
          >
            <Image
              source={require("../../assets/images/neatifylogo.png")}
              contentFit="contain"
              style={styles.logo}
              pointerEvents="none"
            />
          </TouchableOpacity>
        </View>

        {/* ✅ ICONS RIGHT */}
        <View style={styles.iconContainer}>
          <TouchableOpacity
            onPress={handleMenuPress}
            activeOpacity={0.8}
            style={styles.iconButton}
          >
            <Ionicons name="menu-outline" size={30} color={theme.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ✅ SEARCH BOX */}
      {onSearchChange && (
        <View style={[styles.searchContainer, { backgroundColor: theme.surfaceVariant, borderColor: theme.border }]}>
          <Ionicons name="search" size={20} color={theme.textLight} />

          <TextInput
            value={searchText}
            onChangeText={onSearchChange}
            placeholder={t("home.searchPlaceholder") || "Search for services..."}
            placeholderTextColor={theme.textLight}
            style={[styles.searchInput, { color: theme.text }]}
            returnKeyType="search"
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 10,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  logo: {
    width: 160,
    height: 40,
    marginLeft: "-8%",
  },
  iconContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconButton: {
    padding: 6,
    borderRadius: 12,
    backgroundColor: "transparent",
  },
  searchContainer: {
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
  },
});
