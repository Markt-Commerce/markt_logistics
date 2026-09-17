/**
 * Sign in: phone, then the code we send back.
 *
 * Rewritten onto the shared tokens in components/theme.ts. It had its own
 * orange (#e26136, not the brand's #E94C2A), its own spacing and its own
 * button, so the first screen a rider ever sees was the one screen that
 * looked like a different app.
 *
 * Several things on it were also decoration rather than function:
 *
 *  - "Resend in 00:45" was a hardcoded string. Nothing counted down and
 *    nothing resent, so a rider whose code never arrived had no way forward
 *    except killing the app.
 *  - "Change Phone Number", "Register as Partner", "Help Center" and
 *    "Privacy Policy" were all touchables with no handler.
 *  - Pasting the code did nothing useful: each box took one character, so a
 *    six-digit code from the SMS filled the first box and dropped the rest.
 *  - Failures arrived as system alerts, which cover the field you need to
 *    correct and say nothing about which one was wrong.
 *  - No keyboard avoidance, so on a short screen the keyboard sat on top of
 *    the code boxes.
 */

import { MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import Button from "../../components/Button";
import { colors, radius, shadow, spacing, typography } from "../../components/theme";
import { useAuth } from "../../contexts/auth";
import apiService from "../../services/api";

/** How long before the code can be sent again. */
const RESEND_SECONDS = 45;

const OTP_LENGTH = 6;

const COUNTRIES = [
  // Lengths are the national number *without* its leading zero, which is
  // what the backend expects appended to the dial code. A rider who types
  // the zero out of habit is not wrong, so it is stripped rather than
  // rejected -- see normalisePhone.
  { name: "Nigeria", code: "+234", flag: "🇳🇬", dialLength: 10 },
  { name: "Ghana", code: "+233", flag: "🇬🇭", dialLength: 9 },
  { name: "Kenya", code: "+254", flag: "🇰🇪", dialLength: 9 },
  { name: "Senegal", code: "+221", flag: "🇸🇳", dialLength: 9 },
  { name: "Ivory Coast", code: "+225", flag: "🇨🇮", dialLength: 8 },
  { name: "Cameroon", code: "+237", flag: "🇨🇲", dialLength: 9 },
  { name: "South Africa", code: "+27", flag: "🇿🇦", dialLength: 9 },
  { name: "Uganda", code: "+256", flag: "🇺🇬", dialLength: 9 },
  { name: "Tanzania", code: "+255", flag: "🇹🇿", dialLength: 9 },
  { name: "Ethiopia", code: "+251", flag: "🇪🇹", dialLength: 9 },
  { name: "Rwanda", code: "+250", flag: "🇷🇼", dialLength: 9 },
  { name: "Benin", code: "+229", flag: "🇧🇯", dialLength: 8 },
  { name: "Burkina Faso", code: "+226", flag: "🇧🇫", dialLength: 8 },
  { name: "Mali", code: "+223", flag: "🇲🇱", dialLength: 8 },
  { name: "Niger", code: "+227", flag: "🇳🇪", dialLength: 8 },
  { name: "Togo", code: "+228", flag: "🇹🇬", dialLength: 8 },
  { name: "Liberia", code: "+231", flag: "🇱🇷", dialLength: 8 },
  { name: "Sierra Leone", code: "+232", flag: "🇸🇱", dialLength: 8 },
  { name: "Guinea", code: "+224", flag: "🇬🇳", dialLength: 8 },
  { name: "DRC", code: "+243", flag: "🇨🇩", dialLength: 9 },
];

type Country = (typeof COUNTRIES)[number];

/** Digits only, without the leading zero people type out of habit. */
function normalisePhone(raw: string): string {
  return raw.replace(/\D/g, "").replace(/^0+/, "");
}

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function LoginScreen() {
  const router = useRouter();
  const { signIn } = useAuth();

  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState<Country>(COUNTRIES[0]);
  const [pickerOpen, setPickerOpen] = useState(false);

  const [step, setStep] = useState<"phone" | "code">("phone");
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const boxes = useRef<(TextInput | null)[]>([]);

  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);

  const phoneValid = phone.length === country.dialLength;
  const code = digits.join("");
  const codeComplete = code.length === OTP_LENGTH;
  const fullNumber = `${country.code}${phone}`.replace("+", "");

  // The resend countdown. A real one: it starts when a code is sent and the
  // button below is genuinely disabled until it reaches zero.
  useEffect(() => {
    if (secondsLeft <= 0) return;
    const id = setInterval(() => setSecondsLeft((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [secondsLeft]);

  const sendCode = useCallback(
    async ({ resend = false }: { resend?: boolean } = {}) => {
      setError(null);
      if (resend) setResending(true);
      else setBusy(true);
      try {
        const response = await apiService.sendOtp(fullNumber);
        if (response.status !== "success") {
          setError("We could not send the code. Try again in a moment.");
          return;
        }
        setSecondsLeft(RESEND_SECONDS);
        setStep("code");
        // Moving to the next screen is the confirmation. An alert saying
        // "code sent" only adds a tap between the rider and the box they
        // now have to type into.
      } catch {
        setError("We could not reach Markt. Check your connection and try again.");
      } finally {
        setResending(false);
        setBusy(false);
      }
    },
    [fullNumber]
  );

  /** Accepts one digit, or a whole pasted code. */
  const onDigitChange = (index: number, value: string) => {
    const incoming = value.replace(/\D/g, "");
    if (!incoming) {
      const next = [...digits];
      next[index] = "";
      setDigits(next);
      return;
    }

    const next = [...digits];
    // A paste (or an SMS autofill) arrives as several characters at once and
    // fills from here onwards, rather than being truncated to the first.
    for (let i = 0; i < incoming.length && index + i < OTP_LENGTH; i++) {
      next[index + i] = incoming[i];
    }
    setDigits(next);
    setError(null);

    const landed = Math.min(index + incoming.length, OTP_LENGTH - 1);
    boxes.current[landed]?.focus();
  };

  const onDigitKey = (index: number, key: string) => {
    if (key !== "Backspace" || digits[index] || index === 0) return;
    const next = [...digits];
    next[index - 1] = "";
    setDigits(next);
    boxes.current[index - 1]?.focus();
  };

  const verify = async () => {
    if (!codeComplete) return;
    setBusy(true);
    setError(null);
    try {
      const response = await apiService.login(fullNumber, code);
      await AsyncStorage.setItem("partner", JSON.stringify(response.partner));
      await signIn(response.access_token);
      router.replace("/(delivery)/availability-toggle");
    } catch {
      // Inline, next to the boxes, rather than an alert over them.
      setError("That code did not work. Check it, or send a new one.");
      setDigits(Array(OTP_LENGTH).fill(""));
      boxes.current[0]?.focus();
    } finally {
      setBusy(false);
    }
  };

  const backToPhone = () => {
    setStep("phone");
    setDigits(Array(OTP_LENGTH).fill(""));
    setError(null);
    setSecondsLeft(0);
  };

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {step === "phone" ? (
            <>
              <View style={styles.brand}>
                <View style={styles.mark}>
                  <MaterialIcons name="delivery-dining" size={30} color="#fff" />
                </View>
                <Text style={styles.wordmark}>Markt</Text>
                <Text style={styles.wordmarkSub}>Delivery Partner</Text>
              </View>

              <Text style={styles.heading}>Sign in to start earning</Text>
              <Text style={styles.sub}>
                We will text a six-digit code to this number.
              </Text>

              <Text style={styles.label}>PHONE NUMBER</Text>
              <View style={styles.phoneRow}>
                <Pressable
                  style={styles.countryButton}
                  onPress={() => setPickerOpen(true)}
                  accessibilityRole="button"
                  accessibilityLabel={`Country: ${country.name}`}
                >
                  <Text style={styles.flag}>{country.flag}</Text>
                  <Text style={styles.dial}>{country.code}</Text>
                  <MaterialIcons name="expand-more" size={18} color={colors.textMuted} />
                </Pressable>
                <TextInput
                  style={[styles.input, styles.flex]}
                  placeholder={"0".repeat(country.dialLength)}
                  placeholderTextColor={colors.textMuted}
                  keyboardType="phone-pad"
                  textContentType="telephoneNumber"
                  autoComplete="tel"
                  maxLength={country.dialLength + 1}
                  value={phone}
                  onChangeText={(v) => {
                    setPhone(normalisePhone(v).slice(0, country.dialLength));
                    setError(null);
                  }}
                  editable={!busy}
                  returnKeyType="go"
                  onSubmitEditing={() => phoneValid && sendCode()}
                />
              </View>

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <Button
                label="Send code"
                onPress={() => sendCode()}
                loading={busy}
                disabled={!phoneValid}
                style={styles.cta}
                icon={
                  <MaterialIcons name="arrow-forward" size={18} color="#fff" />
                }
              />

              <Text style={styles.legal}>
                By continuing you agree to Markt&apos;s partner terms.
              </Text>
            </>
          ) : (
            <>
              <Pressable
                style={styles.back}
                onPress={backToPhone}
                accessibilityRole="button"
                accessibilityLabel="Back to phone number"
                hitSlop={8}
              >
                <MaterialIcons name="arrow-back" size={22} color={colors.textPrimary} />
              </Pressable>

              <Text style={styles.heading}>Enter your code</Text>
              <Text style={styles.sub}>
                Sent to <Text style={styles.subStrong}>{country.code} {phone}</Text>
              </Text>

              <View style={styles.codeRow}>
                {digits.map((digit, index) => (
                  <TextInput
                    key={index}
                    ref={(el) => {
                      boxes.current[index] = el;
                    }}
                    style={[
                      styles.codeBox,
                      digit ? styles.codeBoxFilled : null,
                      error ? styles.codeBoxError : null,
                    ]}
                    keyboardType="number-pad"
                    // Long enough to receive a pasted code; onDigitChange
                    // spreads it across the boxes.
                    maxLength={OTP_LENGTH}
                    value={digit}
                    onChangeText={(v) => onDigitChange(index, v)}
                    onKeyPress={(e) => onDigitKey(index, e.nativeEvent.key)}
                    textContentType="oneTimeCode"
                    autoComplete="sms-otp"
                    autoFocus={index === 0}
                    selectTextOnFocus
                    editable={!busy}
                    accessibilityLabel={`Digit ${index + 1} of ${OTP_LENGTH}`}
                  />
                ))}
              </View>

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <Button
                label="Verify and continue"
                onPress={verify}
                loading={busy}
                disabled={!codeComplete}
                style={styles.cta}
              />

              <View style={styles.resendRow}>
                {secondsLeft > 0 ? (
                  <Text style={styles.resendWaiting}>
                    Didn&apos;t get it? You can resend in{" "}
                    {formatCountdown(secondsLeft)}
                  </Text>
                ) : (
                  <Pressable
                    onPress={() => sendCode({ resend: true })}
                    disabled={resending}
                    accessibilityRole="button"
                    hitSlop={8}
                  >
                    <Text style={styles.resendAction}>
                      {resending ? "Sending…" : "Send a new code"}
                    </Text>
                  </Pressable>
                )}
              </View>

              <Pressable onPress={backToPhone} hitSlop={8} accessibilityRole="button">
                <Text style={styles.changeNumber}>Use a different number</Text>
              </Pressable>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={pickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setPickerOpen(false)}
      >
        <Pressable style={styles.scrim} onPress={() => setPickerOpen(false)} />
        <SafeAreaView style={styles.sheet} edges={["bottom"]}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Country</Text>
            <Pressable onPress={() => setPickerOpen(false)} hitSlop={8}>
              <MaterialIcons name="close" size={22} color={colors.textPrimary} />
            </Pressable>
          </View>
          <FlatList
            data={COUNTRIES}
            keyExtractor={(item) => item.code}
            renderItem={({ item }) => {
              const selected = item.code === country.code;
              return (
                <Pressable
                  style={styles.countryRow}
                  onPress={() => {
                    setCountry(item);
                    setPhone("");
                    setPickerOpen(false);
                  }}
                >
                  <Text style={styles.flag}>{item.flag}</Text>
                  <Text style={styles.countryName}>{item.name}</Text>
                  <Text style={styles.countryDial}>{item.code}</Text>
                  {selected ? (
                    <MaterialIcons name="check" size={20} color={colors.primary} />
                  ) : null}
                </Pressable>
              );
            }}
          />
        </SafeAreaView>
      </Modal>

      {busy && step === "code" ? (
        <View style={styles.blocker} pointerEvents="none">
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: colors.background },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },

  brand: { alignItems: "flex-start", marginBottom: spacing.lg },
  mark: {
    width: 56,
    height: 56,
    borderRadius: radius,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  wordmark: {
    ...typography.title,
    fontSize: 26,
    color: colors.textPrimary,
    marginTop: spacing.sm,
  },
  wordmarkSub: {
    ...typography.secondary,
    color: colors.textSecondary,
    marginTop: 2,
  },

  heading: { ...typography.title, fontSize: 24, color: colors.textPrimary },
  sub: {
    ...typography.secondary,
    color: colors.textSecondary,
    marginTop: spacing.base,
    marginBottom: spacing.md,
    lineHeight: 20,
  },
  subStrong: { color: colors.textPrimary, fontWeight: "600" },

  label: {
    ...typography.label,
    color: colors.textMuted,
    marginBottom: spacing.base,
  },
  phoneRow: { flexDirection: "row", gap: spacing.base },
  countryButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 52,
    paddingHorizontal: spacing.sm,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  flag: { fontSize: 20 },
  dial: { ...typography.bodyBold, color: colors.textPrimary },
  input: {
    height: 52,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    fontSize: 17,
    fontWeight: "600",
    color: colors.textPrimary,
    letterSpacing: 0.5,
  },

  cta: { marginTop: spacing.md },
  legal: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.md,
    lineHeight: 18,
  },

  back: {
    width: 40,
    height: 40,
    justifyContent: "center",
    marginBottom: spacing.sm,
    marginLeft: -8,
  },
  codeRow: { flexDirection: "row", gap: spacing.base },
  codeBox: {
    flex: 1,
    height: 60,
    borderRadius: radius,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    textAlign: "center",
    fontSize: 22,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  codeBoxFilled: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryMuted,
  },
  codeBoxError: { borderColor: colors.error },

  error: {
    ...typography.secondary,
    color: colors.error,
    marginTop: spacing.sm,
  },

  resendRow: { alignItems: "center", marginTop: spacing.md },
  resendWaiting: { ...typography.secondary, color: colors.textSecondary },
  resendAction: {
    ...typography.bodyBold,
    fontSize: 14,
    color: colors.primary,
  },
  changeNumber: {
    ...typography.secondary,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: spacing.sm,
    textDecorationLine: "underline",
  },

  scrim: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)" },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: "70%",
    ...shadow,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  sheetTitle: { ...typography.subtitle, color: colors.textPrimary },
  countryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  countryName: { ...typography.body, color: colors.textPrimary, flex: 1 },
  countryDial: { ...typography.secondary, color: colors.textSecondary },

  blocker: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.4)",
  },
});
