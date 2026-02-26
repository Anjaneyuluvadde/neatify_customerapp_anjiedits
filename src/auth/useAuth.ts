import { supabase } from "../lib/supabase";

type NotificationFn = (config: {
  type: "success" | "error" | "warning" | "info";
  title: string;
  message: string;
}) => void;

export async function handleAuth({
  isLogin,
  email,
  password,
  fullName,
  phone,
  setLoading,
  setIsLogin,
  showAlert,
  showToast,
}: any & { showAlert: NotificationFn; showToast: (msg: string, type?: "success" | "error" | "info") => void }) {
  if (!email.trim() || !password.trim()) {
    showAlert({
      type: "warning",
      title: "Missing Information",
      message: "Please fill in your email and password."
    });
    return;
  }

  if (!isLogin && (!fullName.trim() || !phone.trim())) {
    showAlert({
      type: "warning",
      title: "Missing Information",
      message: "Name and Phone are required."
    });
    return;
  }

  setLoading(true);

  try {
    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
    } else {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) throw error;
      if (!data.user) throw new Error("User creation failed");

      const { error: insertError } = await supabase.from("signup").insert({
        id: data.user.id,
        full_name: fullName,
        email,
        phone,
      });

      if (insertError) throw insertError;

      showToast("Account created successfully! 🎉", "success");
      setIsLogin(true);
    }
  } catch (err: any) {
    showAlert({
      type: "error",
      title: "Authentication Failed",
      message: err.message
    });
  } finally {
    setLoading(false);
  }
}