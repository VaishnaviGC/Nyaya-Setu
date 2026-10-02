import { useState } from "react";
import { View, Text, TextInput, StyleSheet, ActivityIndicator, ScrollView } from "react-native";
import { COLORS } from "../theme";
import Button from "../components/Button";
import { useAuth } from "../AuthContext";

export default function RegisterScreen({ navigation }) {
  const { register } = useAuth();
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [caseNumber, setCaseNumber] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!phoneNumber.trim() || !password) {
      setError("Please enter a phone number and password.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await register(phoneNumber.trim(), password, caseNumber.trim());
    } catch (err) {
      setError(err.message || "Could not create account.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <Text style={styles.badge}>NYAYA AI</Text>
      <Text style={styles.title}>Create your account</Text>
      <Text style={styles.subtitle}>
        Keep your rights explanations and complaints saved, and see how Nyaya Setu has helped you
        over time.
      </Text>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <TextInput
        style={styles.input}
        placeholder="Phone number"
        placeholderTextColor={COLORS.grey}
        keyboardType="phone-pad"
        value={phoneNumber}
        onChangeText={setPhoneNumber}
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        placeholder="Password (min. 6 characters)"
        placeholderTextColor={COLORS.grey}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <TextInput
        style={styles.input}
        placeholder="Court case number (optional)"
        placeholderTextColor={COLORS.grey}
        value={caseNumber}
        onChangeText={setCaseNumber}
        autoCapitalize="characters"
      />
      <Text style={styles.hint}>
        Don't have a case number yet? Leave this blank — you can add it any time from your profile
        once you have one.
      </Text>

      {loading ? (
        <ActivityIndicator color={COLORS.navy} style={{ marginVertical: 12 }} />
      ) : (
        <Button title="Create Account" onPress={handleRegister} style={{ marginBottom: 14 }} />
      )}

      <Text style={styles.switchText}>
        Already have an account?{" "}
        <Text style={styles.switchLink} onPress={() => navigation.navigate("Login")}>
          Log in
        </Text>
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flexGrow: 1, backgroundColor: "#fff", padding: 24, justifyContent: "center" },
  badge: { color: COLORS.gold, fontSize: 12, fontWeight: "700", letterSpacing: 1, marginBottom: 8 },
  title: { fontSize: 24, fontWeight: "700", color: COLORS.navy, marginBottom: 6 },
  subtitle: { fontSize: 13.5, color: COLORS.grey, marginBottom: 24, lineHeight: 19 },
  input: {
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 14,
    fontSize: 15,
    marginBottom: 14,
    color: COLORS.navy,
  },
  hint: { fontSize: 12, color: COLORS.grey, marginBottom: 18, lineHeight: 17, marginTop: -6 },
  switchText: { textAlign: "center", color: COLORS.grey, fontSize: 13.5 },
  switchLink: { color: COLORS.gold, fontWeight: "700" },
  errorBox: {
    backgroundColor: "#fdecea",
    borderWidth: 1,
    borderColor: "#f5b7b1",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: { color: COLORS.red, fontSize: 13 },
});
