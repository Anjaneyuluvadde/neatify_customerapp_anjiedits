import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Modal, Pressable, StyleSheet, Text, Vibration, View } from "react-native";
import { COLORS } from "../theme/colors";
import { useTheme } from "../context/ThemeContext";
import AnimatedGradientBorder from "./AnimatedGradientBorder";

type AlertType = "success" | "error" | "warning" | "info";

interface CustomAlertProps {
    visible: boolean;
    type?: AlertType;
    title: string;
    message: string;
    onClose: () => void;
    confirmText?: string;
    onConfirm?: () => void;
    cancelText?: string;
    showCancel?: boolean;
}

export default function CustomAlert({
    visible,
    type = "info",
    title,
    message,
    onClose,
    confirmText = "OK",
    onConfirm,
    cancelText = "Cancel",
    showCancel = false,
}: CustomAlertProps) {
    const { theme } = useTheme();
    const handleConfirm = () => {
        if (type === "success") {
            Vibration.vibrate(50);
        }
        onConfirm ? onConfirm() : onClose();
    };

    const getIconName = (): keyof typeof Ionicons.glyphMap => {
        switch (type) {
            case "success":
                return "checkmark-circle";
            case "error":
                return "close-circle";
            case "warning":
                return "alert-circle";
            default:
                return "information-circle";
        }
    };

    const getIconColor = (): string => {
        switch (type) {
            case "success":
                return COLORS.success;
            case "error":
                return COLORS.error;
            case "warning":
                return "#F4C430";
            default:
                // Use app theme color (Saffron) for info
                return COLORS.saffron;
        }
    };

    const getButtonStyle = () => {
        switch (type) {
            case "success":
                return styles.confirmButtonSuccess;
            case "error":
                return styles.confirmButtonError;
            case "warning":
                return styles.confirmButtonWarning;
            default:
                return styles.confirmButtonInfo;
        }
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <AnimatedGradientBorder
                    borderRadius={20}
                    borderWidth={2}
                    animationSpeed={3}
                    style={{ width: "100%", maxWidth: 360 }}
                >
                    <View style={[styles.content, { width: "100%", maxWidth: undefined, backgroundColor: theme.background }]}>
                        {/* Icon */}
                        <View style={styles.iconContainer}>
                            <Ionicons name={getIconName()} size={64} color={getIconColor()} />
                        </View>

                        {/* Title and Message */}
                        <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
                        <Text style={[styles.message, { color: theme.textLight }]}>{message}</Text>

                        {/* Buttons */}
                        <View style={styles.buttonContainer}>
                            {showCancel && (
                                <Pressable
                                    style={[styles.button, styles.cancelButton, { backgroundColor: theme.surfaceVariant }]}
                                    onPress={onClose}
                                >
                                    <Text style={[styles.cancelButtonText, { color: theme.textLight }]}>{cancelText}</Text>
                                </Pressable>
                            )}
                            <Pressable
                                style={[
                                    styles.button,
                                    styles.confirmButton,
                                    getButtonStyle(),
                                    showCancel && { flex: 1 },
                                ]}
                                onPress={handleConfirm}
                            >
                                <Text style={[styles.confirmButtonText, { color: theme.background }]}>{confirmText}</Text>
                            </Pressable>
                        </View>
                    </View>
                </AnimatedGradientBorder>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        justifyContent: "center",
        alignItems: "center",
        padding: 20,
    },
    content: {
        backgroundColor: "#fff",
        borderRadius: 20,
        padding: 24,
        width: "100%",
        alignItems: "center",
    },
    iconContainer: {
        marginBottom: 16,
    },
    title: {
        fontSize: 20,
        fontWeight: "700",
        color: "#333",
        marginBottom: 8,
        textAlign: "center",
    },
    message: {
        fontSize: 16,
        color: "#666",
        textAlign: "center",
        marginBottom: 24,
        lineHeight: 22,
    },
    buttonContainer: {
        flexDirection: "row",
        width: "100%",
        gap: 12,
    },
    button: {
        paddingVertical: 14,
        paddingHorizontal: 24,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
    },
    confirmButton: {
        flex: 1,
    },
    confirmButtonSuccess: {
        backgroundColor: COLORS.success,
    },
    confirmButtonError: {
        backgroundColor: COLORS.error,
    },
    confirmButtonWarning: {
        backgroundColor: "#F4C430",
    },
    confirmButtonInfo: {
        // Use app theme color (Saffron)
        backgroundColor: COLORS.saffron,
    },
    confirmButtonText: {
        color: COLORS.black,
        fontSize: 16,
        fontWeight: "700",
    },
    cancelButton: {
        backgroundColor: "#f3f4f6",
        flex: 1,
    },
    cancelButtonText: {
        color: "#666",
        fontSize: 16,
        fontWeight: "600",
    },
});
