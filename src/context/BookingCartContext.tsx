import React, { createContext, useContext, useMemo, useState } from "react";
import { SelectedService } from "../navigation/AppNavigator";
import { Service } from "../types/service";

type BookingCartContextType = {
  cartItems: SelectedService[];
  addService: (service: Service | SelectedService) => void;
  removeService: (serviceId: string) => void;
  updateQuantity: (serviceId: string, delta: number) => void;
  clearCart: () => void;
  totalPrice: number;
  totalUnits: number;
  totalServices: number;
};

const BookingCartContext = createContext<BookingCartContextType | null>(null);

export function BookingCartProvider({ children }: { children: React.ReactNode }) {
  const [cartItems, setCartItems] = useState<SelectedService[]>([]);

  const addService = (service: Service | SelectedService) => {
    setCartItems((prev) => {
      const existing = prev.find((s) => s.id === service.id);
      if (existing) {
        return prev.map((s) =>
          s.id === service.id ? { ...s, quantity: (s.quantity || 1) + 1 } : s
        );
      }
      
      // Map Service to SelectedService if not already
      let quantity = (service as SelectedService).quantity || 1;
      
      return [
        ...prev,
        {
          id: service.id,
          title: service.title,
          duration: service.duration,
          price: service.price,
          service_type: service.service_type,
          original_price: (service as any).original_price,
          discount_percent: (service as any).discount_percent,
          discount_label: (service as any).discount_label,
          tax_percent: (service as any).tax_percent,
          image: (service as any).image,
          quantity: quantity,
        } as SelectedService,
      ];
    });
  };

  const removeService = (serviceId: string) => {
    setCartItems((prev) => prev.filter((s) => s.id !== serviceId));
  };

  const updateQuantity = (serviceId: string, delta: number) => {
    setCartItems((prev) => {
      return prev.map((s) => {
        if (s.id === serviceId) {
          const newQuantity = (s.quantity || 1) + delta;
          return { ...s, quantity: newQuantity };
        }
        return s;
      }).filter(s => (s.quantity || 1) > 0);
    });
  };

  const clearCart = () => {
    setCartItems([]);
  };

  const totalPrice = useMemo(() => {
    return cartItems.reduce((sum, item) => {
      const cleanPrice = String(item.price).replace(/[^\d.]/g, '');
      const priceVal = parseFloat(cleanPrice) || 0;
      return sum + (priceVal * (item.quantity || 1));
    }, 0);
  }, [cartItems]);

  const totalUnits = useMemo(() => {
    return cartItems.reduce((sum, item) => sum + (item.quantity || 1), 0);
  }, [cartItems]);

  const totalServices = cartItems.length;

  const value = useMemo(
    () => ({
      cartItems,
      addService,
      removeService,
      updateQuantity,
      clearCart,
      totalPrice,
      totalUnits,
      totalServices,
    }),
    [cartItems, totalPrice, totalUnits, totalServices]
  );

  return (
    <BookingCartContext.Provider value={value}>
      {children}
    </BookingCartContext.Provider>
  );
}

export function useBookingCart() {
  const ctx = useContext(BookingCartContext);
  if (!ctx) {
    throw new Error("useBookingCart must be used inside BookingCartProvider");
  }
  return ctx;
}
