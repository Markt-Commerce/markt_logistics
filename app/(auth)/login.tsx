import { MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import apiService from "../../services/api";

const PRIMARY_COLOR = "#2f7f33";
const BG_LIGHT = "#f6f8f6";

export default function LoginScreen() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [otpValues, setOtpValues] = useState(["", "", "", "", "", ""]);
  const otpInputRefs = useRef<(TextInput | null)[]>([]);

  const validatePhone = (value: string) => /^[0-9]{10}$/.test(value);
  const otpComplete = otpValues.every((v) => v !== "");

  const handleSendOtp = async () => {
    if (!validatePhone(phone)) {
      Alert.alert("Invalid Phone", "Please enter a valid 10-digit phone number");
      return;
    }
    setIsLoading(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      Alert.alert(
        "OTP Sent",
        "Test OTP: 123456",
        [{ text: "OK", onPress: () => setShowOtpInput(true) }]
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    // Only allow digits
    const numValue = value.replace(/[^0-9]/g, '');
    
    const newValues = [...otpValues];
    newValues[index] = numValue;
    setOtpValues(newValues);
    setOtp(newValues.join(""));

    // Auto-focus to next input if value is entered
    if (numValue && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyPress = (index: number, key: string) => {
    // Handle backspace
    if (key === "Backspace" && !otpValues[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
      
      // Clear the previous field
      const newValues = [...otpValues];
      newValues[index - 1] = "";
      setOtpValues(newValues);
      setOtp(newValues.join(""));
    }
  };

  const handleLogin = async () => {
    if (!otpComplete) {
      Alert.alert("Invalid OTP", "Please enter all 6 digits");
      return;
    }
    setIsLoading(true);
    try {
      const response = await apiService.login(phone, otp);
      await AsyncStorage.setItem("sessionToken", response.sessionToken);
      await AsyncStorage.setItem("partner", JSON.stringify(response.partner));
      router.replace("/(delivery)/availability-toggle");
    } catch (error) {
      Alert.alert("Login Failed", "Invalid credentials");
      setOtpValues(["", "", "", "", "", ""]);
      setOtp("");
    } finally {
      setIsLoading(false);
    }
  };

  if (!showOtpInput) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Header with Logo */}
          <View style={styles.headerSection}>
            <View style={styles.logoBox}>
              <MaterialIcons name="delivery-dining" size={48} color="#fff" />
            </View>
            <Text style={styles.logoText}>Markt</Text>
            <Text style={styles.logoSubtext}>Delivery Partner</Text>
          </View>

          {/* Login Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Welcome Back</Text>
            <Text style={styles.cardDesc}>Enter your phone number to start earning.</Text>

            <View style={styles.formGroup}>
              <Text style={styles.label}>PHONE NUMBER</Text>
              <View style={styles.phoneInputWrapper}>
                <View style={styles.countryPicker}>
                  <Text style={styles.countryCode}>🇳🇬</Text>
                  <Text style={styles.countryCodeText}>+234</Text>
                  <MaterialIcons name="expand-more" size={16} color="#999" />
                </View>
                <TextInput
                  style={styles.phoneInput}
                  placeholder="0000000000"
                  placeholderTextColor="#ccc"
                  keyboardType="phone-pad"
                  maxLength={10}
                  value={phone}
                  onChangeText={setPhone}
                  editable={!isLoading}
                />
              </View>
            </View>

            <TouchableOpacity
              style={[
                styles.primaryButton,
                !validatePhone(phone) && styles.buttonDisabled,
              ]}
              onPress={handleSendOtp}
              disabled={!validatePhone(phone) || isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Text style={styles.primaryButtonText}>Send OTP</Text>
                  <MaterialIcons name="arrow-forward" size={18} color="#fff" />
                </>
              )}
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>Secure Login</Text>
              <View style={styles.dividerLine} />
            </View>
          </View>

          {/* Footer */}
          <View style={styles.footerSection}>
            <Text style={styles.footerText}>
              New to the platform?{" "}
              <Text style={styles.footerLink}>Register as Partner</Text>
            </Text>
            <View style={styles.footerLinks}>
              <TouchableOpacity>
                <Text style={styles.footerLinkSmall}>Help Center</Text>
              </TouchableOpacity>
              <TouchableOpacity>
                <Text style={styles.footerLinkSmall}>Privacy Policy</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // OTP Verification Screen
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Back Button */}
        <View style={styles.otpHeader}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => {
              setShowOtpInput(false);
              setPhone("");
              setOtpValues(["", "", "", "", "", ""]);
              setOtp("");
            }}
          >
            <MaterialIcons name="arrow-back-ios-new" size={20} color={PRIMARY_COLOR} />
          </TouchableOpacity>
        </View>

        {/* OTP Card */}
        <View style={styles.otpCard}>
          <Text style={styles.otpTitle}>Verify OTP</Text>
          <Text style={styles.otpDesc}>
            We've sent a 6-digit verification code to {"\n"}
            <Text style={styles.phoneHighlight}>+91 {phone}</Text>
          </Text>

          {/* OTP Input Fields */}
          <View style={styles.otpInputGrid}>
            {otpValues.map((value, index) => (
              <TextInput
                key={index}
                ref={(el) => {
                  if (el) otpInputRefs.current[index] = el;
                }}
                style={styles.otpInputBox}
                maxLength={1}
                keyboardType="number-pad"
                value={value}
                onChangeText={(text) => handleOtpChange(index, text)}
                onKeyPress={(e) => handleOtpKeyPress(index, e.nativeEvent.key)}
                placeholder="·"
                placeholderTextColor="#ccc"
              />
            ))}
          </View>

          {/* Resend Info */}
          <View style={styles.otpFooterInfo}>
            <Text style={styles.resendText}>
              Didn't receive the code?{" "}
              <Text style={styles.resendHighlight}>Resend in 00:45</Text>
            </Text>
            <TouchableOpacity>
              <Text style={styles.changePhoneText}>Change Phone Number</Text>
            </TouchableOpacity>
          </View>

          {/* Verify Button */}
          <TouchableOpacity
            style={[styles.primaryButton, !otpComplete && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={!otpComplete || isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Text style={styles.primaryButtonText}>Verify & Login</Text>
                <MaterialIcons name="login" size={18} color="#fff" />
              </>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.spacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG_LIGHT,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    justifyContent: "space-between",
    paddingVertical: 16,
  },
  headerSection: {
    alignItems: "center",
    paddingVertical: 32,
  },
  logoBox: {
    width: 80,
    height: 80,
    backgroundColor: PRIMARY_COLOR,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    shadowColor: PRIMARY_COLOR,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  logoText: {
    fontSize: 32,
    fontWeight: "800",
    color: PRIMARY_COLOR,
    letterSpacing: -1,
  },
  logoSubtext: {
    fontSize: 13,
    color: PRIMARY_COLOR,
    opacity: 0.7,
    marginTop: 4,
    fontWeight: "500",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 32,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
    borderWidth: 1,
    borderColor: PRIMARY_COLOR + "08",
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: 8,
  },
  cardDesc: {
    fontSize: 13,
    color: "#666",
    marginBottom: 24,
    lineHeight: 18,
  },
  formGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 11,
    fontWeight: "700",
    color: "#999",
    letterSpacing: 1,
    marginBottom: 8,
  },
  phoneInputWrapper: {
    flexDirection: "row",
    gap: 12,
  },
  countryPicker: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: BG_LIGHT,
    borderWidth: 1,
    borderColor: "#ddd",
    paddingHorizontal: 12,
    borderRadius: 8,
    paddingVertical: 4,
  },
  countryCode: {
    fontSize: 16,
  },
  countryCodeText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1a1a1a",
  },
  phoneInput: {
    flex: 1,
    backgroundColor: BG_LIGHT,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    fontWeight: "600",
    color: "#1a1a1a",
  },
  primaryButton: {
    backgroundColor: PRIMARY_COLOR,
    borderRadius: 8,
    paddingVertical: 14,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    shadowColor: PRIMARY_COLOR,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonDisabled: {
    backgroundColor: "#ccc",
    opacity: 0.6,
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 24,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#ddd",
  },
  dividerText: {
    fontSize: 11,
    color: "#999",
    fontWeight: "600",
    letterSpacing: 1,
  },
  footerSection: {
    alignItems: "center",
    paddingVertical: 24,
  },
  footerText: {
    fontSize: 13,
    color: "#666",
    marginBottom: 16,
  },
  footerLink: {
    color: PRIMARY_COLOR,
    fontWeight: "700",
  },
  footerLinks: {
    flexDirection: "row",
    gap: 24,
  },
  footerLinkSmall: {
    fontSize: 11,
    color: "#999",
  },
  otpHeader: {
    paddingVertical: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: PRIMARY_COLOR + "10",
    justifyContent: "center",
    alignItems: "center",
  },
  otpCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 32,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  otpTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#1a1a1a",
    marginBottom: 12,
  },
  otpDesc: {
    fontSize: 13,
    color: "#666",
    lineHeight: 18,
    marginBottom: 28,
  },
  phoneHighlight: {
    color: "#1a1a1a",
    fontWeight: "600",
  },
  otpInputGrid: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 28,
  },
  otpInputBox: {
    flex: 1,
    height: 56,
    backgroundColor: "#f0f0f0",
    borderWidth: 2,
    borderColor: "#ddd",
    borderRadius: 12,
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
    color: "#1a1a1a",
  },
  otpFooterInfo: {
    alignItems: "center",
    marginBottom: 24,
  },
  resendText: {
    fontSize: 12,
    color: "#666",
    marginBottom: 12,
  },
  resendHighlight: {
    color: PRIMARY_COLOR,
    fontWeight: "700",
  },
  changePhoneText: {
    fontSize: 12,
    color: PRIMARY_COLOR,
    fontWeight: "600",
  },
  spacer: {
    height: 20,
  },
});
