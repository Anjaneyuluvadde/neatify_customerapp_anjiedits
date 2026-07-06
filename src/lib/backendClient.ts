import { supabase } from "./supabase";

const RENDER_BACKEND_URL = process.env.EXPO_PUBLIC_RENDER_BACKEND_URL || "https://neatify-backend-6hd4.onrender.com";

const MIGRATED_FUNCTIONS = [
  "create-razorpay-order",
  "verify-payment",
  "send-booking-confirmation",
  "send-payment-confirmation",
  "send-booking-confirmation-whatsapp",
  "booking-cancelled-whatsapp",
];

export const invokeFunction = async (functionName: string, options: any = {}) => {
  if (MIGRATED_FUNCTIONS.includes(functionName)) {
    try {
      const url = `${RENDER_BACKEND_URL}/api/${functionName}`;
      console.log(`📡 [Render Backend Client] Invoking: ${functionName} at ${url}`);

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...options.headers,
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
      });

      const responseData = await response.json().catch(() => ({}));

      if (!response.ok) {
        return { data: null, error: new Error(responseData.error || `HTTP error! status: ${response.status}`) };
      }

      return { data: responseData, error: null };
    } catch (err) {
      console.error(`❌ [Render Backend Client] Error calling ${functionName}:`, err);
      return { data: null, error: err };
    }
  } else {
    console.log(`⚡ [Supabase Edge Function] Invoking: ${functionName}`);
    return supabase.functions.invoke(functionName, options);
  }
};
