import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import apiService from "../../services/api";

export default function LoginScreen() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const validatePhone = (value: string) => /^[0-9]{10}$/.test(value);

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

  const handleLogin = async () => {
    if (!otp || otp.length !== 6) {
      Alert.alert("Invalid OTP", "Please enter 6-digit OTP");
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
      setOtp("");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.logo}>Markt</Text>
          <Text style={styles.subtitle}>Delivery</Text>
        </View>

        {!showOtpInput ? (
          <View style={styles.form}>
            <Text style={styles.title}>Login</Text>
            <Text style={styles.desc}>Enter your phone number</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Phone</Text>
              <View style={styles.phoneInput}>
                <Text style={styles.prefix}>+234</Text>
                <TextInput
                  style={styles.input}
                  placeholder="10-digit number"
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
                styles.button,
                !validatePhone(phone) && styles.buttonDisabled,
              ]}
              onPress={handleSendOtp}
              disabled={!validatePhone(phone) || isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Send OTP</Text>
              )}
            </TouchableOpacity>

            <Text style={styles.hint}>Test: Any number + OTP 123456</Text>
          </View>
        ) : (
          <View style={styles.form}>
            <Text style={styles.title}>Verify OTP</Text>
            <Text style={styles.desc}>Enter OTP for +91 {phone}</Text>

            <TouchableOpacity
              onPress={() => {
                setShowOtpInput(false);
                setOtp("");
              }}
              style={styles.changeLink}
            >
              <Text style={styles.changeLinkText}>Change number</Text>
            </TouchableOpacity>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>OTP</Text>
              <TextInput
                style={styles.otpInput}
                placeholder="000000"
                keyboardType="number-pad"
                maxLength={6}
                value={otp}
                onChangeText={setOtp}
                editable={!isLoading}
              />
            </View>

            <TouchableOpacity
              style={[styles.button, otp.length !== 6 && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={otp.length !== 6 || isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Login</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.footer} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    justifyContent: "space-between",
  },
  header: {
    marginTop: 60,
    marginBottom: 40,
    alignItems: "center",
  },
  logo: {
    fontSize: 42,
    fontWeight: "800",
    color: "#2E7D32",
  },
  subtitle: {
    fontSize: 14,
    color: "#666",
    marginTop: 8,
  },
  form: {
    marginBottom: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: 8,
  },
  desc: {
    fontSize: 14,
    color: "#666",
    marginBottom: 30,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  phoneInput: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: "#fafafa",
  },
  prefix: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginRight: 8,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: "#333",
  },
  otpInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 12,
    fontSize: 24,
    fontWeight: "600",
    letterSpacing: 8,
    textAlign: "center",
    backgroundColor: "#fafafa",
    color: "#333",
  },
  button: {
    backgroundColor: "#2E7D32",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
  },
  buttonDisabled: {
    backgroundColor: "#ccc",
    opacity: 0.6,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  changeLink: {
    alignSelf: "flex-end",
    marginBottom: 20,
  },
  changeLinkText: {
    color: "#2E7D32",
    fontSize: 13,
    fontWeight: "600",
  },
  hint: {
    fontSize: 12,
    color: "#999",
    marginTop: 16,
    textAlign: "center",
  },
  footer: {
    height: 20,
  },
});
