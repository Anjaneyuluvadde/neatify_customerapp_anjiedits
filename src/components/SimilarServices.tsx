import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Image } from 'expo-image';
import React, { useMemo } from 'react';
import { Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useBookingCart } from '../context/BookingCartContext';
import { useTheme } from '../context/ThemeContext';
import { Service } from '../types/service';

const { width } = Dimensions.get('window');
const CARD_WIDTH = 140;

interface SimilarServicesProps {
  currentService: Service | null;
  availableServices: Service[];
}

export default function SimilarServices({ currentService, availableServices }: SimilarServicesProps) {
  const { theme, isDark } = useTheme();
  const { cartItems: selectedServices, addService: addToGlobalCart, removeService, updateQuantity } = useBookingCart();
  const navigation = useNavigation<any>();

  const handleOpenService = (service: Service) => {
    navigation.push('ServiceDetail', {
      serviceId: service.id,
      service: service
    });
  };

  const similarServices = useMemo(() => {
    if (!currentService || !availableServices || !availableServices.length) return [];

    // We try to match by main_category_id first if available, otherwise fallback to service_type
    const currentCategory = currentService.service_type?.toString().toUpperCase().trim();
    const currentMainCategoryId = (currentService as any).main_category_id;

    if (!currentCategory && !currentMainCategoryId) return [];

    return availableServices.filter(s => {
      if (s.id === currentService.id) return false;

      // 1. If both have main_category_id, use that for an exact structural match
      if (currentMainCategoryId && (s as any).main_category_id) {
        if ((s as any).main_category_id === currentMainCategoryId) return true;
      }

      // 2. Fallback to service_type string matching
      const sCategory = s.service_type?.toString().toUpperCase().trim();
      if (sCategory && currentCategory && sCategory === currentCategory) {
        return true;
      }

      return false;
    });
  }, [currentService, availableServices]);

  if (similarServices.length === 0) {
    return null;
  }

  const formatPrice = (value: any) => {
    if (value === null || value === undefined) return "";
    return value.toString().replace(/^₹\s*/, "").replace(/,/g, "");
  };

  const displayRupee = (value: any) => {
    const cleaned = formatPrice(value);
    if (!cleaned) return "";
    return `₹${Number(cleaned).toLocaleString("en-IN")}`;
  };

  const handleAdd = (service: Service) => {
    addToGlobalCart({
      id: service.id,
      title: service.title,
      duration: service.duration,
      price: service.price,
      service_type: service.service_type,
      original_price: service.original_price,
      discount_percent: service.discount_percent,
      discount_label: service.discount_label,
      tax_percent: service.tax_percent,
      image: service.image,
      quantity: 1,
    });
  };

  const handleIncrement = (id: string) => {
    updateQuantity(id, 1);
  };

  const handleDecrement = (id: string, currentQty: number) => {
    if (currentQty <= 1) {
      removeService(id);
    } else {
      updateQuantity(id, -1);
    }
  };

  const handleRemove = (id: string) => {
    removeService(id);
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: theme.text }]}>Similar Services</Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {similarServices.map((service) => {
          const cartItem = selectedServices.find(item => item.id === service.id);
          const quantity = cartItem ? cartItem.quantity || 1 : 0;

          const cleanPrice = formatPrice(service.price);
          const cleanOriginal = formatPrice(service.original_price);
          const hasOld = cleanOriginal && Number(cleanOriginal) > Number(cleanPrice);

          return (
            <Pressable 
              key={service.id} 
              style={[styles.card, { backgroundColor: theme.surface }]}
              onPress={() => handleOpenService(service)}
            >
              {/* Image */}
              <View style={styles.imageContainer}>
                <Image
                  source={{ uri: service.image }}
                  style={styles.image}
                  contentFit="cover"
                />
                {service.discount_percent && service.discount_percent > 0 ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{service.discount_percent}% OFF</Text>
                  </View>
                ) : null}
              </View>

              {/* Content */}
              <View style={styles.content}>
                <Text style={[styles.serviceTitle, { color: theme.text }]} numberOfLines={2}>
                  {service.title}
                </Text>

                <Text style={styles.duration}>
                  {service.duration}
                </Text>

                <View style={styles.priceRow}>
                  <Text style={[styles.price, { color: theme.text }]}>
                    {displayRupee(service.price)}
                  </Text>
                  {hasOld && (
                    <Text style={styles.originalPrice}>
                      {displayRupee(service.original_price)}
                    </Text>
                  )}
                </View>

                {/* Add / Quantity Controls */}
                <View style={styles.controlsContainer}>
                  {quantity === 0 ? (
                    <Pressable
                      style={styles.addButton}
                      onPress={(e) => {
                        e.stopPropagation();
                        handleAdd(service);
                      }}
                    >
                      <Text style={styles.addButtonText}>+ Add</Text>
                    </Pressable>
                  ) : (
                    <View style={styles.quantityRow}>
                      <View style={styles.quantityControl}>
                        <Pressable
                          style={styles.qtyBtn}
                          onPress={(e) => {
                            e.stopPropagation();
                            handleDecrement(service.id, quantity);
                          }}
                        >
                          <Ionicons name="remove" size={14} color="#000" />
                        </Pressable>

                        <Text style={[styles.qtyText, { color: theme.text }]}>{quantity}</Text>

                        <Pressable
                          style={styles.qtyBtn}
                          onPress={(e) => {
                            e.stopPropagation();
                            handleIncrement(service.id);
                          }}
                        >
                          <Ionicons name="add" size={14} color="#000" />
                        </Pressable>
                      </View>
                    </View>
                  )}
                </View>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 24,
    marginBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 12,
  },
  card: {
    width: CARD_WIDTH,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  imageContainer: {
    width: '100%',
    height: 90,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  badge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#E9F7EF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    color: '#1E7E34',
    fontSize: 10,
    fontWeight: '700',
  },
  content: {
    padding: 8,
  },
  serviceTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
    height: 36, // fix height for 2 lines
  },
  duration: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 6,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  price: {
    fontSize: 14,
    fontWeight: '700',
  },
  originalPrice: {
    fontSize: 11,
    color: '#94A3B8',
    textDecorationLine: 'line-through',
  },
  controlsContainer: {
    height: 32,
    justifyContent: 'center',
  },
  addButton: {
    backgroundColor: '#FFD700',
    borderRadius: 6,
    paddingVertical: 6,
    alignItems: 'center',
  },
  addButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#000'
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quantityControl: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FFD700',
    borderRadius: 6,
    overflow: 'hidden',
    width: '100%',
  },
  qtyBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
  },
  qtyText: {
    flex: 1,
    textAlign: 'center',
    fontWeight: '700',
    fontSize: 13,
  },
});
