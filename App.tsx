import { NavigationContainer } from "@react-navigation/native";
import * as Linking from "expo-linking";
import React, { useEffect, useState } from "react";
import { StatusBar, StyleSheet } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { LanguageProvider } from "./src/context/LanguageContext";
import { NotificationProvider } from "./src/context/NotificationContext";
import { supabase } from "./src/lib/supabase";
import AppNavigator from "./src/navigation/AppNavigator";

export default function App() {
  const [initialRoute, setInitialRoute] = useState<"Login" | "Home" | "CompleteProfile">("Login");
  const [loading, setLoading] = useState(true);
  const navigationRef = React.useRef<any>(null);
  const skipAuthRedirect = React.useRef(false);

  useEffect(() => {
    // Helper: check DB + Auth completeness
    // Returns false and redirects if profile is incomplete
    // useNav=true  → reset live navigation (post-mount, e.g. deep links)
    // useNav=false → return result so caller can set initialRoute before mount
    const checkCompleteness = async (userId: string, useNav = true): Promise<boolean> => {
      if (!userId) return true;
      try {
        // Always fetch fresh user data from server
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return true;

        const { data: profile } = await supabase
          .from("profile")
          .select("full_name, email, phone")
          .eq("id", user.id)
          .maybeSingle();

        // Profile DB must have all 3 fields
        const hasFullProfile =
          !!(profile?.full_name && profile?.email && profile?.phone);

        // Auth must have confirmed email (covers both email and Google users)
        const hasConfirmedIdentity = !!user.email_confirmed_at;

        const isComplete = hasFullProfile && hasConfirmedIdentity;

        if (!isComplete) {
          if (useNav) {
            navigationRef.current?.reset({
              index: 0,
              routes: [{ name: "CompleteProfile" }],
            });
          }
          return false;
        }
        return true;
      } catch (err) {
        console.error("Onboarding check error:", err);
        return true;
      }
    };

    // 1. Initial Launch Check (cold start / app kill recovery)
    // Navigation is NOT mounted yet here, so we set initialRoute instead of resetting nav
    const initApp = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const isComplete = await checkCompleteness(session.user.id, false);
        if (!isComplete) {
          setInitialRoute("CompleteProfile");
          setLoading(false);
          return;
        }
      }
      setInitialRoute(session ? "Home" : "Home");
      setLoading(false);
    };
    initApp();

    // 2. Auth state changes — only handle SIGNED_IN once per session
    // Use a flag to prevent re-triggering on token refreshes
    let hasCheckedOnce = false;
    const { data: listener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // Reset skip flag when user signs out (after password reset completes)
        if (event === "SIGNED_OUT") {
          skipAuthRedirect.current = false;
          hasCheckedOnce = false;
          return;
        }
        // Skip auto-redirect during password reset flow
        if (skipAuthRedirect.current && event === "SIGNED_IN") {
          console.log("Skipping auth redirect (password reset in progress)");
          return;
        }
        if (event === "SIGNED_IN" && session?.user && !hasCheckedOnce) {
          hasCheckedOnce = true;
          setTimeout(async () => {
            const isComplete = await checkCompleteness(session.user.id);
            if (isComplete) {
              navigationRef.current?.reset({
                index: 0,
                routes: [{ name: "Home" }],
              });
            }
          }, 300);
        }
      }
    );

    // 3. Deep link handler
    const handleDeepLink = async ({ url }: { url: string }) => {
      console.log("Deep link received:", url);

      if (url.includes("google-auth")) {
        const fragment = url.split("#")[1];
        if (fragment) {
          const params = new URLSearchParams(fragment);
          const accessToken = params.get("access_token");
          const refreshToken = params.get("refresh_token");
          if (accessToken && refreshToken) {
            const { data, error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            if (!error && data.user) {
              setTimeout(async () => {
                const isComplete = await checkCompleteness(data.user!.id);
                if (isComplete) {
                  // Profile complete — go to Home
                  navigationRef.current?.reset({
                    index: 0,
                    routes: [{ name: "Home" }],
                  });
                }
                // If not complete, checkCompleteness already reset to CompleteProfile
              }, 500);
            }
          }
        }
      } else if (url.includes("reset-password")) {
        // Set flag to prevent onAuthStateChange from redirecting to Home
        skipAuthRedirect.current = true;
        const fragment = url.split("#")[1];
        if (fragment) {
          const params = new URLSearchParams(fragment);
          const accessToken = params.get("access_token");
          const refreshToken = params.get("refresh_token");
          if (accessToken && refreshToken) {
            navigationRef.current?.navigate("ResetPassword", {
              access_token: accessToken,
              refresh_token: refreshToken,
            });
          }
        }
      }
    };

    const subscription = Linking.addEventListener("url", handleDeepLink);

    return () => {
      listener.subscription.unsubscribe();
      subscription.remove();
    };
  }, []);



  const linking = {
    prefixes: [
      Linking.createURL("/"),
      "neatifynation://",
      "https://www.theneatifyteam.in",
      "https://theneatifyteam.in",
      "https://website-v2-swart-phi.vercel.app",
      "https://neatify-version2-hosting.vercel.app"
    ],
    config: {
      screens: {
        ServiceDetail: "service/:serviceId",
        Home: "*"
      },
    },
    // Handle unmatched URLs gracefully
    async getInitialURL() {
      const url = await Linking.getInitialURL();
      if (url) {
        console.log("Deep link opened app:", url);
        console.log("Parsing serviceId from URL:", url.match(/service\/([^/?]+)/)?.[1]);
      }
      return url;
    },
    subscribe(listener: (url: string) => void) {
      const linkingSubscription = Linking.addEventListener("url", ({ url }) => {
        console.log("Deep link received:", url);
        const serviceIdMatch = url.match(/service\/([^/?]+)/);
        if (serviceIdMatch) {
          console.log("Extracted serviceId:", serviceIdMatch[1]);
        } else {
          console.log("Deep link: No serviceId found, will navigate to Home");
        }
        listener(url);
      });

      return () => {
        linkingSubscription.remove();
      };
    },
  };


  if (loading) return null;

  return (
    <SafeAreaProvider>
      <NotificationProvider>
        <LanguageProvider>
          <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
          <NavigationContainer linking={linking} ref={navigationRef}>
            <AppNavigator initialRouteName={initialRoute} />
          </NavigationContainer>
        </LanguageProvider>
      </NotificationProvider>
    </SafeAreaProvider>
  );
}

// Force rebuild 1


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
});