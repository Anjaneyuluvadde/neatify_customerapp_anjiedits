import { supabase } from "../lib/supabase";

type NotificationFn = (config: {
  type: "success" | "error" | "warning" | "info";
  title: string;
  message: string;
}) => void;

export async function resetPassword(
  email: string,
  setLoading: (v: boolean) => void,
  showAlert: NotificationFn,
  showToast: (msg: string, type?: "success" | "error" | "info") => void
) {
  if (!email.trim()) {
    showAlert({
      type: "warning",
      title: "Email Required",
      message: "Please enter your email."
    });
    return;
  }

  setLoading(true);

  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) throw error;

    showToast("Check your inbox for the reset link! 📧", "success");
  } catch (err: any) {
    showAlert({
      type: "error",
      title: "Error",
      message: err.message
    });
  } finally {
    setLoading(false);
  }
}