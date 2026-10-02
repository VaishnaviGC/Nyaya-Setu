import { useState } from "react";
import { View, Text, TextInput, StyleSheet, ActivityIndicator } from "react-native";
import { COLORS } from "../theme";
import Button from "../components/Button";
import { useAuth } from "../AuthContext";

export default function LoginScreen({ navigation }) {
  const { login } = useAuth();
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!phoneNumber.trim() || !password) {
      setError("Please enter your phone number and password.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await login(phoneNumber.trim(), password);
      // AuthProvider updates `token`, which flips the navigator to the main app automatically.
    } catch (err) {
      setError(err.message || "Could not log in.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.screen}>
      <Text style={styles.badge}>NYAYA AI</Text>
      <Text style={styles.title}>Welcome back</Text>
      <Text style={styles.subtitle}>Log in to see your saved rights, complaints, and case.</Text>

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
        placeholder="Password"
        placeholderTextColor={COLORS.grey}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      {loading ? (
        <ActivityIndicator color={COLORS.navy} style={{ marginVertical: 12 }} />
      ) : (
        <Button title="Log In" onPress={handleLogin} style={{ marginBottom: 14 }} />
      )}

      <Text style={styles.switchText}>
        New here?{" "}
        <Text style={styles.switchLink} onPress={() => navigation.navigate("Register")}>
          Create an account
        </Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#fff", padding: 24, justifyContent: "center" },
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
