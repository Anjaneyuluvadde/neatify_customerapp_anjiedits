import { Star } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Modal,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { useLanguage } from "../context/LanguageContext";

type ReviewModalProps = {
    visible: boolean;
    onClose: () => void;
    onSubmit: (rating: number, comment: string) => Promise<void>;
    initialRating?: number;
    initialComment?: string;
    isSubmitting?: boolean;
};

export default function ReviewModal({
    visible,
    onClose,
    onSubmit,
    initialRating = 5,
    initialComment = "",
    isSubmitting = false,
}: ReviewModalProps) {
    const { t } = useLanguage();
    const [rating, setRating] = useState(initialRating);
    const [comment, setComment] = useState(initialComment);

    useEffect(() => {
        if (visible) {
            setRating(initialRating || 5);
            setComment(initialComment || "");
        }
    }, [visible, initialRating, initialComment]);

    const handleSubmit = async () => {
        await onSubmit(rating, comment);
    };

    const renderStars = () => {
        return (
            <View style={styles.starsContainer}>
                {[1, 2, 3, 4, 5].map((star) => (
                    <TouchableOpacity
                        key={star}
                        onPress={() => setRating(star)}
                        activeOpacity={0.7}
                    >
                        <Star
                            size={32}
                            color={star <= rating ? "#F59E0B" : "#E2E8F0"}
                            fill={star <= rating ? "#F59E0B" : "none"}
                            style={{ marginHorizontal: 4 }}
                        />
                    </TouchableOpacity>
                ))}
            </View>
        );
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
            statusBarTranslucent={true}
        >
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={styles.modalOverlay}
            >
                <View style={styles.modalContent}>
                    <Text style={styles.modalTitle}>{t("review.title") || "Rate Experience"}</Text>
                    <Text style={styles.modalSubtitle}>
                        {t("review.subtitle") || "How was the service provided?"}
                    </Text>

                    {renderStars()}

                    <Text style={styles.ratingLabel}>
                        {rating}/5 {rating >= 4 ? "Extremely Good! 🤩" : rating >= 3 ? "Good 🙂" : "Could be better 😐"}
                    </Text>

                    <TextInput
                        style={styles.commentInput}
                        placeholder={t("review.placeholder") || "Share your experience..."}
                        value={comment}
                        onChangeText={setComment}
                        multiline
                        textAlignVertical="top"
                    />

                    <View style={styles.modalActions}>
                        <TouchableOpacity
                            style={[styles.modalBtn, styles.modalCancelBtn]}
                            onPress={onClose}
                            disabled={isSubmitting}
                        >
                            <Text style={styles.modalCancelText}>{t("common.cancel") || "Cancel"}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.modalBtn, styles.modalSubmitBtn]}
                            onPress={handleSubmit}
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.modalSubmitText}>{t("common.submit") || "Submit"}</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.5)",
        justifyContent: "center",
        alignItems: "center",
        padding: 20,
    },
    modalContent: {
        width: "100%",
        backgroundColor: "#fff",
        borderRadius: 20,
        padding: 24,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
        elevation: 10,
        alignItems: "center",
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: "700",
        color: "#1e293b",
        marginBottom: 8,
    },
    modalSubtitle: {
        fontSize: 14,
        color: "#64748b",
        marginBottom: 20,
    },
    starsContainer: {
        flexDirection: "row",
        marginBottom: 10,
    },
    ratingLabel: {
        fontSize: 16,
        fontWeight: "600",
        color: "#334155",
        marginBottom: 20,
    },
    commentInput: {
        width: "100%",
        backgroundColor: "#f8fafc",
        borderWidth: 1,
        borderColor: "#e2e8f0",
        borderRadius: 12,
        padding: 14,
        height: 100,
        fontSize: 15,
        color: "#333",
        marginBottom: 24,
    },
    modalActions: {
        flexDirection: "row",
        gap: 12,
        width: "100%",
    },
    modalBtn: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
    },
    modalCancelBtn: {
        backgroundColor: "#fff",
        borderWidth: 1,
        borderColor: "#e2e8f0",
    },
    modalSubmitBtn: {
        backgroundColor: "#EF4444", // Primary Red
    },
    modalCancelText: {
        fontSize: 15,
        fontWeight: "600",
        color: "#64748b",
    },
    modalSubmitText: {
        fontSize: 15,
        fontWeight: "700",
        color: "#fff",
    },
});
