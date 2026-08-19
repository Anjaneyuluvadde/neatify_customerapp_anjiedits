import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * Calculates the exact bottom padding required for scrollable content
 * to scroll completely above the absolute-positioned custom bottom navigation bar.
 * 
 * Includes the bar height (70), bar bottom padding (15), safe area, and extra spacing.
 */
export function useBottomNavPadding(extraPadding: number = 24) {
    const insets = useSafeAreaInsets();
    
    // CustomTabBar height (70) + tab bar bottom padding (15)
    const BOTTOM_NAV_HEIGHT = 85; 
    
    return {
        paddingBottom: BOTTOM_NAV_HEIGHT + insets.bottom + extraPadding,
    };
}
