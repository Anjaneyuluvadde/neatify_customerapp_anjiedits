import React, { createContext, ReactNode, useState } from "react";
import AppToast from "../components/AppToast";
import CustomAlert from "../components/CustomAlert";

type AlertType = "success" | "error" | "warning" | "info";

interface AlertConfig {
    type: AlertType;
    title: string;
    message: string;
    confirmText?: string;
    onConfirm?: () => void;
    cancelText?: string;
    showCancel?: boolean;
}

interface ToastConfig {
    message: string;
    type: "success" | "error" | "info";
}

interface NotificationContextType {
    showAlert: (config: AlertConfig) => void;
    showToast: (message: string, type?: "success" | "error" | "info") => void;
    hideAlert: () => void;
}

export const NotificationContext = createContext<NotificationContextType>({
    showAlert: () => { },
    showToast: () => { },
    hideAlert: () => { },
});

export function NotificationProvider({ children }: { children: ReactNode }) {
    const [alertConfig, setAlertConfig] = useState<AlertConfig | null>(null);
    const [toastConfig, setToastConfig] = useState<ToastConfig | null>(null);
    const [showAlertModal, setShowAlertModal] = useState(false);
    const [showToastModal, setShowToastModal] = useState(false);

    const showAlert = (config: AlertConfig) => {
        setAlertConfig(config);
        setShowAlertModal(true);
    };

    const showToast = (message: string, type: "success" | "error" | "info" = "success") => {
        setToastConfig({ message, type });
        setShowToastModal(true);
    };

    const hideAlert = () => {
        setShowAlertModal(false);
        setTimeout(() => setAlertConfig(null), 300);
    };

    const handleAlertConfirm = () => {
        if (alertConfig?.onConfirm) {
            alertConfig.onConfirm();
        }
        hideAlert();
    };

    return (
        <NotificationContext.Provider value={{ showAlert, showToast, hideAlert }}>
            {children}

            {/* Custom Alert Modal */}
            {alertConfig && (
                <CustomAlert
                    visible={showAlertModal}
                    type={alertConfig.type}
                    title={alertConfig.title}
                    message={alertConfig.message}
                    onClose={hideAlert}
                    confirmText={alertConfig.confirmText}
                    onConfirm={handleAlertConfirm}
                    cancelText={alertConfig.cancelText}
                    showCancel={alertConfig.showCancel}
                />
            )}

            {/* Toast Notification */}
            {toastConfig && (
                <AppToast
                    visible={showToastModal}
                    message={toastConfig.message}
                    type={toastConfig.type}
                    onHide={() => setShowToastModal(false)}
                />
            )}
        </NotificationContext.Provider>
    );
}
