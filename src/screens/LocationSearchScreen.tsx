import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, TextInput, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as Location from 'expo-location';

import { useTheme } from '../context/ThemeContext';
import { COLORS } from '../theme/colors';
import { supabase } from '../lib/supabase';
import LocationService, { LocationResult } from '../services/LocationService';

export default function LocationSearchScreen() {
  const navigation = useNavigation<any>();
  const { theme } = useTheme();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Location.LocationGeocodedLocation[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  
  const [savedProfile, setSavedProfile] = useState<{ address: string | null } | null>(null);
  
  const [isFetchingCurrent, setIsFetchingCurrent] = useState(false);
  const [fetchedLocation, setFetchedLocation] = useState<LocationResult | null>(null);

  useEffect(() => {
    fetchProfileAddress();
  }, []);

  const fetchProfileAddress = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const { data } = await supabase
        .from('profile')
        .select('address')
        .eq('id', session.user.id)
        .maybeSingle();
      if (data) {
        setSavedProfile(data);
      }
    }
  };

  const handleSearch = async (text: string) => {
    setSearchQuery(text);
    if (text.length > 2) {
      setIsSearching(true);
      try {
        const results = await Location.geocodeAsync(text);
        setSearchResults(results);
      } catch (error) {
        console.warn("Geocode error:", error);
      } finally {
        setIsSearching(false);
      }
    } else {
      setSearchResults([]);
    }
  };

  const selectSearchResult = async (coords: Location.LocationGeocodedLocation) => {
    try {
      const addressList = await Location.reverseGeocodeAsync({
        latitude: coords.latitude,
        longitude: coords.longitude
      });
      if (addressList.length > 0) {
        const addr = addressList[0];
        const locality = LocationService.getLocalityString(addr);
        const fullAddress = [addr.name, addr.street, locality, addr.region, addr.country]
          .filter(Boolean)
          .join(", ");
          
        const result: LocationResult = {
          locality,
          fullAddress,
          latitude: coords.latitude,
          longitude: coords.longitude,
          status: 'success',
          postalCode: addr.postalCode || null,
          isServiceable: true,
          rawAddress: addr
        };
        await LocationService.setSelectedLocation(result);
        navigation.goBack();
      }
    } catch (e) {
      console.warn("Reverse geocode error:", e);
    }
  };

  const handleUseCurrentLocation = async () => {
    setIsFetchingCurrent(true);
    setFetchedLocation(null);
    try {
      // Pass true to force GPS fetch, bypassing any cached manual location
      const result = await LocationService.fetchCurrentLocation(Location.Accuracy.High, true);
      
      if (result.status === 'success') {
        setFetchedLocation(result);
        await LocationService.setSelectedLocation(result);
        navigation.goBack();
      } else if (result.status === 'services_disabled') {
        Alert.alert("Location Disabled", "Please enable location services in your device settings.");
      } else if (result.status === 'permission_denied') {
        Alert.alert("Permission Denied", "Please grant location permissions to use this feature.");
      } else {
        Alert.alert("Error", "Failed to get current location. Please try searching manually.");
      }
    } catch (e) {
      console.warn("Error fetching current location:", e);
      Alert.alert("Error", "An unexpected error occurred while fetching location.");
    } finally {
      setIsFetchingCurrent(false);
    }
  };

  const handleAddAddress = () => {
    // Navigate to Profile tab for address entry
    navigation.navigate("MainTabs", { screen: "ProfileTab" });
  };

  const handleSelectSavedAddress = async () => {
    if (savedProfile?.address) {
      try {
        setIsSearching(true);
        const results = await Location.geocodeAsync(savedProfile.address);
        if (results.length > 0) {
           await selectSearchResult(results[0]);
        } else {
           // Fallback if geocoding fails
           const result: LocationResult = {
             locality: "Saved Address",
             fullAddress: savedProfile.address,
             latitude: 0,
             longitude: 0,
             status: 'success',
             postalCode: null,
             isServiceable: true,
             rawAddress: null
           };
           await LocationService.setSelectedLocation(result);
           navigation.goBack();
        }
      } catch (e) {
         console.warn(e);
      } finally {
         setIsSearching(false);
      }
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.background }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Search your location</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Search Input */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={COLORS.gray} style={styles.searchIcon} />
          <TextInput
            style={[styles.searchInput, { color: theme.text, backgroundColor: theme.surfaceVariant }]}
            placeholder="Search locality, sector, area"
            placeholderTextColor={theme.textMuted}
            value={searchQuery}
            onChangeText={handleSearch}
          />
          {isSearching && (
            <ActivityIndicator size="small" color={COLORS.saffron} style={{ position: 'absolute', right: 16 }} />
          )}
        </View>

        {/* Search Results */}
        {searchResults.length > 0 && (
          <View style={styles.searchResultsContainer}>
            {searchResults.map((result, index) => (
              <TouchableOpacity 
                key={index} 
                style={styles.searchResultItem} 
                onPress={() => selectSearchResult(result)}
              >
                <Ionicons name="location-outline" size={20} color={theme.textMuted} style={{ marginRight: 12 }} />
                <Text style={{ color: theme.text }}>Location at {result.latitude.toFixed(4)}, {result.longitude.toFixed(4)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Use current location */}
        <TouchableOpacity style={styles.actionRow} onPress={handleUseCurrentLocation} disabled={isFetchingCurrent}>
          <Ionicons name="locate" size={22} color={COLORS.saffron} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.actionText, { color: COLORS.saffron }]}>
              {isFetchingCurrent ? "Fetching location..." : "Use current location"}
            </Text>
          </View>
          {isFetchingCurrent ? (
            <ActivityIndicator size="small" color={COLORS.saffron} />
          ) : (
            <Ionicons name="chevron-forward" size={20} color={theme.textMuted} style={{ marginLeft: 'auto' }} />
          )}
        </TouchableOpacity>
        
        {/* Fetched Location Display */}
        {fetchedLocation && (
          <TouchableOpacity style={styles.fetchedLocationContainer} onPress={() => navigation.goBack()}>
            <Text style={[styles.fetchedLocationTitle, { color: theme.text }]}>
              Current Location Selected
            </Text>
            <Text style={[styles.fetchedLocationText, { color: theme.textMuted }]}>
              {fetchedLocation.fullAddress}
            </Text>
          </TouchableOpacity>
        )}

        {/* Add address */}
        <TouchableOpacity style={styles.actionRow} onPress={handleAddAddress}>
          <Ionicons name="add" size={22} color={COLORS.saffron} />
          <Text style={[styles.actionText, { color: COLORS.saffron }]}>Add address</Text>
          <Ionicons name="chevron-forward" size={20} color={theme.textMuted} style={{ marginLeft: 'auto' }} />
        </TouchableOpacity>

        {/* Saved Addresses Section */}
        {savedProfile?.address && (
          <View style={styles.savedAddressesSection}>
            <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>SAVED ADDRESSES</Text>
            
            <TouchableOpacity style={styles.addressItem} onPress={handleSelectSavedAddress}>
              <Ionicons name="home-outline" size={20} color={theme.text} style={styles.addressIcon} />
              <View style={styles.addressDetails}>
                <Text style={[styles.addressLabel, { color: theme.text }]}>Saved Address</Text>
                <Text style={[styles.addressText, { color: theme.textLight }]} numberOfLines={2}>
                  {savedProfile.address}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  backButton: {
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  content: {
    padding: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  searchIcon: {
    position: 'absolute',
    left: 16,
    zIndex: 1,
  },
  searchInput: {
    flex: 1,
    height: 48,
    borderRadius: 8,
    paddingLeft: 44,
    paddingRight: 40,
    fontSize: 15,
  },
  searchResultsContainer: {
    marginBottom: 24,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  actionText: {
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 12,
  },
  fetchedLocationContainer: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    marginTop: -8,
    marginBottom: 16,
  },
  fetchedLocationTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  fetchedLocationText: {
    fontSize: 13,
    lineHeight: 18,
  },
  savedAddressesSection: {
    marginTop: 32,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 16,
  },
  addressItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  addressIcon: {
    marginRight: 16,
  },
  addressDetails: {
    flex: 1,
  },
  addressLabel: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 4,
  },
  addressText: {
    fontSize: 13,
  }
});
