import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView } from "react-native";

import { useNotification } from "../hooks/useNotification";
import { handleAuth } from "./useAuth";
import { resetPassword } from "./usePasswordReset";

import LoginScreenUI from "../screens/LoginScreen";

export default function AuthScreen() {
  const { showAlert, showToast } = useNotification();
  const [isLogin, setIsLogin] = useState(true);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1 }}
    >
      <ScrollView keyboardShouldPersistTaps="handled">
        <LoginScreenUI
          isLogin={isLogin}
          setIsLogin={setIsLogin}
          fullName={fullName}
          setFullName={setFullName}
          email={email}
          setEmail={setEmail}
          password={password}
          setPassword={setPassword}
          phone={phone}
          setPhone={setPhone}
          loading={loading}
          resetLoading={resetLoading}
          onSubmit={() =>
            handleAuth({
              isLogin,
              email,
              password,
              fullName,
              phone,
              setLoading,
              setIsLogin,
            })
          }
          onReset={() => resetPassword(email, setResetLoading, showAlert, showToast)}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}