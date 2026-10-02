import { useCallback, useState } from "react";
import { View, Text, TextInput, ScrollView, StyleSheet, ActivityIndicator, Alert } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { COLORS } from "../theme";
import Button from "../components/Button";
import Card from "../components/Card";
import { useAuth } from "../AuthContext";
import { getHistorySummary } from "../api";

export default function ProfileScreen({ navigation }) {
  const { user, token, logout, updateCaseNumber } = useAuth();
  const [caseNumberInput, setCaseNumberInput] = useState(user?.case_number || "");
  const [savingCase, setSavingCase] = useState(false);
  const [caseError, setCaseError] = useState("");
  const [summary, setSummary] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(true);

  useFocusEffect(
    useCallback(() => {
      setLoadingSummary(true);
      getHistorySummary(token)
        .then(setSummary)
        .catch(() => setSummary(null))
        .finally(() => setLoadingSummary(false));
    }, [token])
  );

  const handleSaveCaseNumber = async () => {
    setCaseError("");
    setSavingCase(true);
    try {
      await updateCaseNumber(caseNumberInput.trim());
      Alert.alert("Saved", "Your case number has been linked to your account.");
    } catch (err) {
      setCaseError(err.message || "Could not save case number.");
    } finally {
      setSavingCase(false);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: 40 }}>
      <Card title="Account">
        <Text style={styles.row}>📱 {user?.phone_number}</Text>
      </Card>

      <Card title="Court case number">
        <Text style={styles.hint}>
          Add this once you have a case, so LitiTrack can find your hearings and orders.
        </Text>
        {caseError ? <Text style={styles.errorText}>{caseError}</Text> : null}
        <TextInput
          style={styles.input}
          placeholder="e.g. CASE-2026-001"
          placeholderTextColor={COLORS.grey}
          value={caseNumberInput}
          onChangeText={setCaseNumberInput}
          autoCapitalize="characters"
        />
        <Button
          title={savingCase ? "Saving…" : "Save case number"}
          variant="secondary"
          onPress={handleSaveCaseNumber}
          disabled={savingCase}
        />
      </Card>

      <Card title="How Nyaya Setu has helped you">
        {loadingSummary ? (
          <ActivityIndicator color={COLORS.navy} />
        ) : summary ? (
          <View>
            <Text style={styles.statLine}>📊 {summary.total_interactions} total interactions</Text>
            <Text style={styles.statLine}>📝 {summary.complaints_generated} complaint letter(s) drafted</Text>
            <Text style={styles.statLine}>🔎 {summary.rights_explained} rights explanation(s) received</Text>
            {Object.keys(summary.categories).length > 0 && (
              <Text style={styles.statLine}>
                🏷️ Categories: {Object.entries(summary.categories).map(([c, n]) => `${c} (${n})`).join(", ")}
              </Text>
            )}
            {summary.first_interaction && (
              <Text style={styles.statLineMuted}>
                Since {new Date(summary.first_interaction).toLocaleDateString()}
              </Text>
            )}
          </View>
        ) : (
          <Text style={styles.hint}>No activity yet.</Text>
        )}
      </Card>

      <Button
        title="View full history →"
        variant="secondary"
        onPress={() => navigation.navigate("History")}
        style={{ marginBottom: 14 }}
      />

      <Button title="Log Out" variant="danger" onPress={logout} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#fff", padding: 20 },
  row: { fontSize: 14.5, color: COLORS.navy },
  hint: { fontSize: 12.5, color: COLORS.grey, marginBottom: 10, lineHeight: 18 },
  input: {
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    marginBottom: 12,
    color: COLORS.navy,
  },
  errorText: { color: COLORS.red, fontSize: 12.5, marginBottom: 8 },
  statLine: { fontSize: 13.5, color: "#4a5568", marginBottom: 6, lineHeight: 19 },
  statLineMuted: { fontSize: 11.5, color: COLORS.grey, marginTop: 4 },
});
