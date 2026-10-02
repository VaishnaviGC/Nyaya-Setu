import { useState, useCallback } from "react";
import { View, Text, ScrollView, StyleSheet, Alert } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { COLORS } from "../theme";
import Button from "../components/Button";
import { getSavedComplaints, deleteComplaint } from "../storage";
import { downloadAndShareComplaintPdf } from "../pdfDownload";

export default function SavedScreen() {
  const [complaints, setComplaints] = useState([]);
  const [expandedId, setExpandedId] = useState(null);

  // Reload every time this tab gains focus, so a newly-saved complaint shows up.
  useFocusEffect(
    useCallback(() => {
      getSavedComplaints().then(setComplaints);
    }, [])
  );

  const handleDelete = async (id) => {
    await deleteComplaint(id);
    setComplaints(await getSavedComplaints());
  };

  const handleShare = async (c) => {
    try {
      await downloadAndShareComplaintPdf(c.category, c.text);
    } catch {
      Alert.alert("Could not share PDF", "Is the backend running?");
    }
  };

  if (complaints.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>
          🗂️ No saved complaints yet.{"\n"}Generate one from "I have a legal problem" and tap Save.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={styles.title}>Saved Complaints</Text>
      {complaints.map((c) => {
        const isOpen = expandedId === c.id;
        return (
          <View style={styles.item} key={c.id}>
            <Text style={styles.meta}>
              {c.category} • {new Date(c.createdAt).toLocaleDateString()}
            </Text>
            {isOpen ? (
              <View style={styles.letterBox}>
                <Text style={styles.letterText}>{c.letter}</Text>
              </View>
            ) : (
              <Text style={styles.snippet}>
                {c.text.slice(0, 90)}
                {c.text.length > 90 ? "…" : ""}
              </Text>
            )}
            <View style={styles.row}>
              <Button
                title={isOpen ? "Collapse" : "View letter"}
                variant="secondary"
                onPress={() => setExpandedId(isOpen ? null : c.id)}
                style={{ flex: 1 }}
              />
              <Button title="📄 Share" variant="secondary" onPress={() => handleShare(c)} style={{ flex: 1 }} />
              <Button title="Delete" variant="danger" onPress={() => handleDelete(c.id)} style={{ flex: 1 }} />
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#fff", padding: 20 },
  title: { fontSize: 20, fontWeight: "700", color: COLORS.navy, marginBottom: 16 },
  item: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
  },
  meta: { fontSize: 11.5, color: COLORS.grey, marginBottom: 6 },
  snippet: { fontSize: 13, color: COLORS.navy },
  letterBox: {
    backgroundColor: "#fafbfc",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 12,
    marginBottom: 4,
  },
  letterText: { fontSize: 11.5, color: COLORS.navy, fontFamily: "monospace", lineHeight: 17 },
  row: { flexDirection: "row", gap: 8, marginTop: 10 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 30 },
  emptyText: { textAlign: "center", color: COLORS.grey, fontSize: 14, lineHeight: 22 },
});
