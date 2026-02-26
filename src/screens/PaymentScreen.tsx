// import { RouteProp, useNavigation } from "@react-navigation/native";
// import React, { useMemo, useState } from "react";
// import {
//   Pressable,
//   ScrollView,
//   StyleSheet,
//   Text,
//   TextInput,
//   View,
// } from "react-native";

// import { COLORS } from "../theme/colors";


// import {
//   RootStackParamList,
//   SelectedService,
// } from "../navigation/AppNavigator";

// /* ================= TYPES ================= */

// type PaymentRouteProp = RouteProp<RootStackParamList, "Payment">;

// type Props = {
//   route: PaymentRouteProp;
// };

// /* ================= CONSTANTS ================= */

// const FULL_DAYS = [
//   "Sunday",
//   "Monday",
//   "Tuesday",
//   "Wednesday",
//   "Thursday",
//   "Friday",
//   "Saturday",
// ];

// const MONTHS = [
//   "January",
//   "February",
//   "March",
//   "April",
//   "May",
//   "June",
//   "July",
//   "August",
//   "September",
//   "October",
//   "November",
//   "December",
// ];

// /* ================= COMPONENT ================= */

// export default function PaymentScreen({ route }: Props) {
//   const navigation = useNavigation<any>();

//   const { services, date, month, year, time } = route.params;

//   /* ================= CLIENT DETAILS ================= */

//   const [firstName, setFirstName] = useState("");
//   const [lastName, setLastName] = useState("");
//   const [email, setEmail] = useState("");
//   const [phone, setPhone] = useState("");
//   const [address, setAddress] = useState("");
//   const [city, setCity] = useState("");
//   const [region, setRegion] = useState("Telangana");
//   const [zip, setZip] = useState("");

//   /* ================= TOTAL ================= */

//   const totalAmount = useMemo(() => {
//     return services.reduce((sum: number, s: SelectedService) => {
//       const numericPrice = Number(
//         s.price.replace("₹", "").replace(",", "").trim(),
//       );
//       return sum + numericPrice;
//     }, 0);
//   }, [services]);

//   /* ================= FORM VALIDATION ================= */

//   const isFormValid = useMemo(() => {
//     return (
//       firstName.trim() &&
//       lastName.trim() &&
//       email.trim() &&
//       phone.trim() &&
//       address.trim() &&
//       city.trim() &&
//       region.trim() &&
//       zip.trim()
//     );
//   }, [firstName, lastName, email, phone, address, city, region, zip]);

//   /* ================= FULL DATE TEXT ================= */

//   const bookingDateText = useMemo(() => {
//     const d = new Date(year, month, date);
//     return `${FULL_DAYS[d.getDay()]}, ${date} ${MONTHS[d.getMonth()]
//       } ${year} at ${time}`;
//   }, [date, month, year, time]);

//   /* ================= UI ================= */

//   return (
//     <ScrollView contentContainerStyle={styles.container}>
//       <Text style={styles.pageTitle}>Booking Form</Text>

//       {/* ================= BOOKING DETAILS ================= */}
//       <View style={styles.section}>
//         <Text style={styles.sectionTitle}>Booking Details</Text>

//         {services.map((s) => (
//           <View key={s.id} style={styles.serviceBlock}>
//             <Text style={styles.serviceName}>{s.title}</Text>
//             <Text>{s.duration}</Text>
//             <Text>{s.price}</Text>
//           </View>
//         ))}

//         <Text style={styles.meta}>{bookingDateText}</Text>
//         <Text style={styles.meta}>Client&apos;s place</Text>

//         <View style={styles.divider} />

//         <View style={styles.totalRow}>
//           <Text>Total</Text>
//           <Text style={styles.total}>₹{totalAmount}</Text>
//         </View>
//       </View>

//       {/* ================= CLIENT DETAILS ================= */}
//       <View style={styles.section}>
//         <Text style={styles.sectionTitle}>Client Details</Text>

//         <View style={styles.row}>
//           <TextInput
//             placeholder="First name *"
//             placeholderTextColor={COLORS.placeholder}
//             style={styles.input}
//             value={firstName}
//             onChangeText={setFirstName}
//           />
//           <TextInput
//             placeholder="Last name *"
//             placeholderTextColor={COLORS.placeholder}
//             style={styles.input}
//             value={lastName}
//             onChangeText={setLastName}
//           />
//         </View>

//         <TextInput
//           placeholder="Email address *"
//           placeholderTextColor={COLORS.placeholder}
//           style={styles.inputFull}
//           value={email}
//           onChangeText={setEmail}
//           keyboardType="email-address"
//           autoCapitalize="none"
//         />

//         <TextInput
//           placeholder="Phone *"
//           placeholderTextColor={COLORS.placeholder}
//           style={styles.inputFull}
//           value={phone}
//           onChangeText={setPhone}
//           keyboardType="phone-pad"
//         />

//         <TextInput
//           placeholder="Address *"
//           placeholderTextColor={COLORS.placeholder}
//           style={styles.inputFull}
//           value={address}
//           onChangeText={setAddress}
//         />

//         <TextInput
//           placeholder="City *"
//           placeholderTextColor={COLORS.placeholder}
//           style={styles.inputFull}
//           value={city}
//           onChangeText={setCity}
//         />

//         <TextInput
//           placeholder="Region *"
//           placeholderTextColor={COLORS.placeholder}
//           style={styles.inputFull}
//           value={region}
//           onChangeText={setRegion}
//         />

//         <TextInput
//           placeholder="Zip / Postal Code *"
//           placeholderTextColor={COLORS.placeholder}
//           style={styles.inputFull}
//           value={zip}
//           onChangeText={setZip}
//         />

//         {/* ================= BOOK NOW ================= */}
//         <Pressable
//           disabled={!isFormValid}
//           style={[styles.bookBtn, !isFormValid && styles.disabledBtn]}
//           onPress={() =>
//             navigation.navigate("Checkout", {
//               services,
//               total: totalAmount,
//               bookingDateText,
//               customer: {
//                 firstName,
//                 lastName,
//                 email,
//                 phone,
//                 address,
//                 city,
//                 region,
//                 zip,
//               },
//             })
//           }
//         >
//           <Text style={styles.bookText}>Book Now</Text>
//         </Pressable>
//       </View>
//     </ScrollView>
//   );
// }

// /* ================= STYLES ================= */

// const styles = StyleSheet.create({
//   container: { padding: 20, paddingBottom: 80 },
//   pageTitle: { fontSize: 28, fontWeight: "bold", marginBottom: 20 },

//   section: { marginBottom: 30 },
//   sectionTitle: { fontSize: 18, fontWeight: "bold", marginBottom: 15 },

//   serviceBlock: { marginBottom: 10 },
//   serviceName: { fontWeight: "600" },
//   meta: { color: "#555", marginTop: 5 },

//   divider: { height: 1, backgroundColor: "#ddd", marginVertical: 15 },

//   totalRow: {
//     flexDirection: "row",
//     justifyContent: "space-between",
//   },

//   total: { fontWeight: "bold", fontSize: 16 },

//   row: { flexDirection: "row", gap: 10 },

//   input: {
//     borderWidth: 1,
//     borderColor: COLORS.inputBorder,
//     padding: 12,
//     flex: 1,
//     color: COLORS.text,
//     backgroundColor: COLORS.white,
//     borderRadius: 8,
//   },

//   inputFull: {
//     borderWidth: 1,
//     borderColor: COLORS.inputBorder,
//     padding: 12,
//     marginTop: 12,
//     color: COLORS.text,
//     backgroundColor: COLORS.white,
//     borderRadius: 8,
//   },

//   bookBtn: {
//     backgroundColor: COLORS.saffron,
//     padding: 15,
//     marginTop: 25,
//     alignItems: "center",
//     borderRadius: 8,
//   },

//   disabledBtn: {
//     backgroundColor: COLORS.disabled,
//   },

//   bookText: { color: COLORS.buttonText, fontWeight: "bold", fontSize: 16 },
// });
