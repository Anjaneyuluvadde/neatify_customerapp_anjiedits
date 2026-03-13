import { RouteProp, useNavigation } from "@react-navigation/native";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Linking, Modal, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLanguage } from "../context/LanguageContext";
import { useNotification } from "../hooks/useNotification";
import { supabase } from "../lib/supabase";
import { RootStackParamList } from "../navigation/AppNavigator";

type Props = {
  route: RouteProp<RootStackParamList, "BookingDetails">;
};


import ReviewModal from "../components/ReviewModal"; // Import ReviewModal

export default function BookingDetailsScreen({ route }: Props) {
  const { booking: initialBooking } = route.params;
  const { t } = useLanguage();
  const { showAlert, showToast } = useNotification();
  const [booking, setBooking] = useState(initialBooking);
  const [isEligibleToCancel, setIsEligibleToCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const navigation = useNavigation();

  // Review State
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [review, setReview] = useState<{ rating: number; comment: string } | null>(null);
  const [submittingReview, setSubmittingReview] = useState(false);

  // Fetch fresh booking data on mount
  useEffect(() => {
    if (!initialBooking?.id) return;
    const fetchLatest = async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("*")
        .eq("id", initialBooking.id)
        .maybeSingle();
      if (data && !error) {
        setBooking(data as typeof initialBooking);
      }
    };
    fetchLatest();
  }, [initialBooking?.id]);



  // Safely parse services if it's a JSON string
  const services = React.useMemo(() => {
    if (!booking.services) return [];
    if (typeof booking.services === 'string') {
      try {
        return JSON.parse(booking.services);
      } catch {
        return [];
      }
    }
    return Array.isArray(booking.services) ? booking.services : [];
  }, [booking.services]);

  // Real-time subscription for booking updates (OTPs, staff assignment, etc.)
  useEffect(() => {
    if (!booking.id) return;

    const subscription = supabase
      .channel(`booking:${booking.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'bookings',
          filter: `id=eq.${booking.id}`,
        },
        (payload) => {
          console.log('Booking updated:', payload.new);
          setBooking(payload.new as typeof booking);
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [booking.id]);

  // Check Cancellation Eligibility
  useEffect(() => {
    const checkEligibility = async () => {
      if (!booking.id) return;

      const { data, error } = await supabase.rpc('check_cancellation_eligibility', {
        booking_uuid: booking.id,
      });

      if (!error && data) {
        setIsEligibleToCancel(data);
      }
    };

    checkEligibility();
  }, [booking, booking.id]);

  const handleCancelBooking = () => {
    setShowCancelModal(true);
  };

  const confirmCancellation = async () => {
    if (!cancelReason.trim()) {
      showAlert({
        type: "warning",
        title: t("notifications.reasonRequired"),
        message: t("notifications.reasonMessage")
      });
      return;
    }

    setCancelling(true);

    try {
      // 🔐 Re-check eligibility (6-hour rule)
      const { data: eligible } = await supabase.rpc(
        "check_cancellation_eligibility",
        { booking_uuid: booking.id }
      );

      if (!eligible) {
        showAlert({
          type: "info",
          title: t("notifications.cancellationClosed"),
          message: t("notifications.cancellationClosedMessage")
        });
        setCancelling(false);
        return;
      }

      // Update booking with cancellation + refund tracking
      const { error } = await supabase
        .from('bookings')
        .update({
          work_status: 'CANCELLED',
          cancel_requested: true,
          cancel_reason: cancelReason,
          cancel_time: new Date().toISOString(),
          refund_status: 'PENDING',  // Set to PENDING for admin to process
        })
        .eq('id', booking.id);

      if (error) throw error;

      setShowCancelModal(false);
      showToast(t("notifications.bookingCancelled"), "success");
    } catch (err) {
      showAlert({
        type: "error",
        title: t("common.error"),
        message: t("notifications.cancellationFailed")
      });
      console.error(err);
    } finally {
      setCancelling(false);
    }
  };

  /* ================= REVIEW SYSTEM ================= */

  // Fetch existing review
  useEffect(() => {
    if (booking.work_status === "COMPLETED") {
      fetchReview();
    }
  }, [booking.id, booking.work_status]);

  const fetchReview = async () => {
    try {
      const { data, error } = await supabase
        .from("reviews")
        .select("rating, comment")
        .eq("booking_id", booking.id)
        .single(); // Assuming one review per booking

      if (data) {
        setReview(data);
      }
    } catch (err) {
      console.log("No review found or error fetching:", err);
    }
  };

  const handleRateService = () => {
    setShowReviewModal(true);
  };

  const handleSubmitReview = async (rating: number, comment: string) => {
    setSubmittingReview(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      // Check if review exists to update or insert
      const { data: existingReview } = await supabase
        .from("reviews")
        .select("id")
        .eq("booking_id", booking.id)
        .single();

      let error;
      if (existingReview) {
        // Update
        const { error: updateError } = await supabase
          .from("reviews")
          .update({ rating, comment })
          .eq("id", existingReview.id);
        error = updateError;
      } else {
        // Insert
        const { error: insertError } = await supabase
          .from("reviews")
          .insert({
            booking_id: booking.id,
            user_id: user.id,
            rating,
            comment,
          });
        error = insertError;
      }

      if (error) throw error;

      setReview({ rating, comment });
      setShowReviewModal(false);
      showToast(t("review.submitSuccess"), "success");

    } catch (err) {
      console.error(err);
      showAlert({
        type: "error",
        title: t("common.error"),
        message: t("review.submitError"),
      });
    } finally {
      setSubmittingReview(false);
    }
  };


  /* ================= STAFF DETAILS ================= */

  const [staffName, setStaffName] = useState<string | null>(null);
  const [staffPhone, setStaffPhone] = useState<string | null>(null);

  useEffect(() => {
    const fetchStaffDetails = async () => {
      if (!booking.assigned_staff_email) return;

      const { data, error } = await supabase
        .from("staff_profile")
        .select("name, phone")
        .eq("email", booking.assigned_staff_email)
        .single();

      if (data) {
        if (data.name) setStaffName(data.name);
        if (data.phone) setStaffPhone(data.phone);
      }
    };

    fetchStaffDetails();
  }, [booking.assigned_staff_email]);

  // Pull to refresh handler
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      // Fetch fresh booking data
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('id', booking.id)
        .single();

      if (data && !error) {
        setBooking(data);

        // Re-check cancellation eligibility
        const { data: eligible } = await supabase.rpc(
          'check_cancellation_eligibility',
          { booking_uuid: booking.id }
        );
        if (eligible !== null) {
          setIsEligibleToCancel(eligible);
        }
      }
    } catch (err) {
      console.error('Error refreshing booking:', err);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }} edges={["top"]}>
      <ScrollView
        style={{ flex: 1, backgroundColor: "#fff" }}
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#EF4444"]} // Android
            tintColor="#EF4444" // iOS
          />
        }
      >
        {/* HEADER */}
        <View style={styles.header}>
          <Text style={styles.title}>{t("bookingDetails.title")}</Text>
        </View>

        <Text style={styles.section}>{t("bookingDetails.customerDetails")}</Text>
        <View style={styles.card}>
          <Text style={styles.bold}>{booking.customer_name || 'N/A'}</Text>
          <Text>{booking.email || 'N/A'}</Text>
          <Text>{booking.phone_number || 'N/A'}</Text>
        </View>

        <Text style={styles.section}>{t("bookingDetails.serviceAddress")}</Text>
        <View style={styles.card}>
          <Text>{booking.full_address || 'No address provided'}</Text>
        </View>

        {/* SERVICES */}
        <Text style={styles.section}>{t("bookingDetails.services")}</Text>
        <View style={styles.card}>
          {services.length > 0 ? (
            services.map((s: any, index: number) => (
              <View key={s.id || index} style={styles.serviceRow}>
                <View style={{ flex: 1, marginRight: 12 }}>
                  <Text style={styles.bold}>{s.title || s.service_name || 'Service'}</Text>
                  <Text style={{ color: "#555", marginTop: 2 }}>{s.duration || 'N/A'}</Text>
                </View>
                <Text style={{ fontWeight: "700", flexShrink: 0 }}>
                  {String(s.price || '0').startsWith('₹') ? s.price : `₹${s.price || 0}`}
                </Text>
              </View>
            ))
          ) : (
            <Text>{t("bookingDetails.noServices")}</Text>
          )}
        </View>

        <Text style={styles.section}>{t("bookingDetails.schedule")}</Text>
        <View style={styles.card}>
          <Text>
            {booking.booking_date || 'N/A'} at {booking.booking_time || 'N/A'}
          </Text>
        </View>

        {/* PAYMENT */}
        <Text style={styles.section}>{t("bookingDetails.payment")}</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.bold}>{t("bookingDetails.total")}</Text>
            <Text style={styles.bold}>₹{booking.total_amount}</Text>
          </View>
          <Text>{t("bookingDetails.status")}: {booking.payment_status}</Text>
        </View>

        {/* STAFF ASSIGNMENT - Only show for non-completed bookings */}
        {booking.work_status !== "COMPLETED" && booking.work_status !== "CANCELLED" && booking.payment_status !== "failed" && (
          <>
            <Text style={styles.section}>{t("bookingDetails.staffAssignment")}</Text>
            <View style={styles.card}>
              {!booking.assigned_staff_email ? (
                <View style={styles.pendingContainer}>
                  <Text style={styles.pendingText}>
                    {t("bookingDetails.staffPending")}
                  </Text>
                </View>
              ) : (
                <>
                  <View style={styles.assignedHeader}>
                    <Text style={styles.assignedLabel}>{t("bookingDetails.staffAssigned")}</Text>
                  </View>

                  {/* Staff Name & Phone */}
                  {staffName ? (
                    <Text style={styles.staffNameText}>
                      {staffName}
                    </Text>
                  ) : null}

                  {staffPhone ? (
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => {
                        const url = `tel:${staffPhone}`;
                        Linking.canOpenURL(url).then((supported) => {
                          if (supported) {
                            Linking.openURL(url);
                          }
                        });
                      }}
                      style={styles.staffPhoneCard}
                    >
                      <View style={styles.staffPhoneIcon}>
                        <Text style={{ fontSize: 18 }}>📞</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.staffPhoneLabel}>Call Staff</Text>
                        <Text style={styles.staffPhoneNumber}>
                          {staffPhone.replace(/^\+?91/, '')}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ) : null}

                  <View style={{ borderBottomWidth: 1, borderBottomColor: "#e5e7eb", marginBottom: 16, marginTop: 4 }} />

                  <View style={styles.otpContainer}>
                    <View style={styles.otpBox}>
                      <Text style={styles.otpLabel}>{t("bookingDetails.startOtp")}</Text>
                      <Text style={styles.otpCode}>{booking.startotp || "N/A"}</Text>
                      <Text style={styles.otpSubtext}>{t("bookingDetails.startOtpHelp")}</Text>
                    </View>
                    <View style={styles.otpBox}>
                      <Text style={styles.otpLabel}>{t("bookingDetails.endOtp")}</Text>
                      <Text style={styles.otpCode}>{booking.endotp || "N/A"}</Text>
                      <Text style={styles.otpSubtext}>{t("bookingDetails.endOtpHelp")}</Text>
                    </View>
                  </View>

                  <Text style={styles.otpHint}>
                    {t("bookingDetails.otpInstruction")}
                  </Text>
                </>
              )}
            </View>
          </>
        )}

        {/* CANCEL BUTTON */}
        {isEligibleToCancel && booking.work_status !== 'CANCELLED' && booking.payment_status !== 'failed' ? (
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={handleCancelBooking}
            disabled={cancelling}
          >
            {cancelling ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.cancelButtonText}>{t("bookingDetails.cancelBooking")}</Text>
            )}
          </TouchableOpacity>
        ) : null}

        {/* CANCELLED STATUS */}
        {booking.work_status === 'CANCELLED' && (
          <View style={[
            styles.cancelButton,
            styles.disabledButton,
            booking.refund_status === 'REFUNDED' ? styles.refundCompletedButton : null,
            booking.refund_status === 'PENDING' ? styles.refundPendingButton : null
          ]}>
            <Text style={styles.cancelButtonText}>
              {booking.refund_status === 'REFUNDED' ? t("bookingDetails.refundCompleted") :
                booking.refund_status === 'PENDING' ? t("bookingDetails.refundPending") :
                  t("bookingDetails.bookingCancelled")}
            </Text>
            {booking.refund_status === 'PENDING' && (
              <Text style={{ color: '#f1f5f9', fontSize: 13, marginTop: 6, fontWeight: '500' }}>
                {t("bookingDetails.refundNote")}
              </Text>
            )}
          </View>
        )}

        {/* REVIEW SECTION (Only if Completed) */}
        {booking.work_status === "COMPLETED" && (
          <View style={styles.reviewContainer}>
            <Text style={styles.section}>{t("serviceDetail.reviews")}</Text>
            <View style={styles.card}>
              {review ? (
                <View>
                  <Text style={styles.reviewLabel}>{t("review.yourRating")}</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
                    <Text style={{ fontSize: 24, fontWeight: "bold", color: "#F59E0B", marginRight: 8 }}>
                      {review.rating} ★
                    </Text>
                    <Text style={{ color: "#64748b" }}>
                      {review.rating >= 4 ? "Extremely Good! 🤩" : review.rating >= 3 ? "Good 🙂" : "Could be better 😐"}
                    </Text>
                  </View>
                  {review.comment ? (
                    <Text style={{ fontStyle: "italic", color: "#334155", marginBottom: 12 }}>
                      "{review.comment}"
                    </Text>
                  ) : null}

                  <TouchableOpacity
                    style={styles.editReviewBtn}
                    onPress={handleRateService}
                  >
                    <Text style={styles.editReviewText}>{t("review.editReview")}</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={{ alignItems: "center", padding: 10 }}>
                  <Text style={{ color: "#64748b", marginBottom: 12 }}>
                    Rate your experience with us!
                  </Text>
                  <TouchableOpacity
                    style={styles.rateButton}
                    onPress={handleRateService}
                  >
                    <Text style={styles.rateButtonText}>{t("review.rateService")}</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        )}

        {/* CANCEL REASON MODAL */}
        <Modal
          visible={showCancelModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowCancelModal(false)}
          statusBarTranslucent={true}
        >
          <KeyboardAvoidingView
            behavior="padding"
            style={styles.modalOverlay}
          >
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>{t("bookingDetails.cancelModalTitle")}</Text>
              <Text style={styles.modalSubtitle}>
                {t("bookingDetails.cancelModalSubtitle")}
              </Text>

              <TextInput
                style={styles.reasonInput}
                placeholder={t("bookingDetails.cancelReasonPlaceholder")}
                value={cancelReason}
                onChangeText={setCancelReason}
                multiline
                textAlignVertical="top"
              />

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.modalCancelBtn]}
                  onPress={() => setShowCancelModal(false)}
                  disabled={cancelling}
                >
                  <Text style={styles.modalCancelText}>{t("bookingDetails.dontCancel")}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalBtn, styles.modalConfirmBtn]}
                  onPress={confirmCancellation}
                  disabled={cancelling}
                >
                  {cancelling ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.modalConfirmText}>{t("bookingDetails.confirmCancel")}</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* REVIEW MODAL */}
        <ReviewModal
          visible={showReviewModal}
          onClose={() => setShowReviewModal(false)}
          onSubmit={handleSubmitReview}
          initialRating={review?.rating}
          initialComment={review?.comment}
          isSubmitting={submittingReview}
        />

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingBottom: 40 },
  header: { marginBottom: 20 },
  title: { fontSize: 26, fontWeight: "800" },

  section: {
    fontSize: 16,
    fontWeight: "700",
    marginTop: 20,
    marginBottom: 8,
  },

  card: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 12,
    padding: 15,
  },

  serviceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
  },

  row: {
    flexDirection: "row",
    justifyContent: "space-between",
  },

  bold: { fontWeight: "700" },

  // Staff Assignment Styles
  pendingContainer: {
    padding: 15,
    backgroundColor: "#f3f4f6",
    borderRadius: 8,
    alignItems: "center",
  },
  pendingText: {
    fontSize: 14,
    color: "#6b7280",
    fontWeight: "600",
  },
  assignedHeader: {
    marginBottom: 12,
  },
  assignedLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: "#16a34a",
  },
  otpContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12,
  },
  otpBox: {
    flex: 1,
    backgroundColor: "#fef3c7",
    borderWidth: 2,
    borderColor: "#fbbf24",
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
  },
  otpLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#92400e",
    marginBottom: 6,
  },
  otpCode: {
    fontSize: 24,
    fontWeight: "800",
    color: "#78350f",
    letterSpacing: 2,
  },
  otpSubtext: {
    fontSize: 11,
    fontWeight: "600",
    color: "#92400e",
    marginTop: 6,
    textAlign: "center",
  },
  otpHint: {
    fontSize: 12,
    color: "#6b7280",
    fontStyle: "italic",
    marginTop: 8,
  },
  cancelButton: {
    marginTop: 30,
    backgroundColor: "#EF4444",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 20,
    shadowColor: "#EF4444",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
  disabledButton: {
    backgroundColor: "#94a3b8", // Gray for cancelled
    shadowColor: "#94a3b8",
    elevation: 0,
  },
  refundPendingButton: {
    backgroundColor: "#F59E0B", // Orange for pending refund
    shadowColor: "#F59E0B",
    elevation: 4,
  },
  refundCompletedButton: {
    backgroundColor: "#10B981", // Green for refund completed
    shadowColor: "#10B981",
    elevation: 4,
  },
  cancelButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },

  /* MODAL STYLES */
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
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1e293b",
    textAlign: "center",
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
    marginBottom: 20,
  },
  reasonInput: {
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
  modalConfirmBtn: {
    backgroundColor: "#EF4444",
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#64748b",
  },
  modalConfirmText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
  },
  reviewContainer: {
    marginBottom: 20,
  },
  reviewLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#64748b",
    marginBottom: 4,
  },
  rateButton: {
    backgroundColor: "#F59E0B",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  rateButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
  editReviewBtn: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#F59E0B",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  editReviewText: {
    color: "#F59E0B",
    fontWeight: "600",
    fontSize: 14,
  },
  staffNameText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#000",
    marginBottom: 8,
  },
  staffPhoneCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f0fdf4",
    borderRadius: 12,
    padding: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: "#bbf7d0",
  },
  staffPhoneIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#16a34a",
    alignItems: "center",
    justifyContent: "center",
  },
  staffPhoneLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#16a34a",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  staffPhoneNumber: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
  },
});
