import { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { COLORS } from "../theme";
import { getHistory } from "../api";
import { useAuth } from "../AuthContext";

const TYPE_LABELS = {
  rights_explained: "🔎 Rights explained",
  complaint_generated: "📝 Complaint generated",
};

export default function HistoryScreen() {
  const { token } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getHistory(token);
      setItems(data);
    } catch (err) {
      setError(err.message || "Could not load your history.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={COLORS.navy} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (items.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>
          No history yet.{"\n"}Use "I have a legal problem" to get started — every rights check and
          complaint you generate while logged in shows up here.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: 40 }}>
      {items.map((item) => (
        <View style={styles.item} key={item.id}>
          <View style={styles.itemHeader}>
            <Text style={styles.typeLabel}>{TYPE_LABELS[item.interaction_type] || item.interaction_type}</Text>
            <Text style={styles.date}>{new Date(item.created_at).toLocaleDateString()}</Text>
          </View>
          {item.category ? <Text style={styles.category}>{item.category}</Text> : null}
          {item.input_text ? (
            <Text style={styles.snippet} numberOfLines={2}>
              "{item.input_text}"
            </Text>
          ) : null}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#fff", padding: 20 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 30 },
  emptyText: { textAlign: "center", color: COLORS.grey, fontSize: 14, lineHeight: 22 },
  errorText: { color: COLORS.red, fontSize: 14, textAlign: "center" },
  item: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
  },
  itemHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  typeLabel: { fontSize: 13, fontWeight: "700", color: COLORS.navy },
  date: { fontSize: 11.5, color: COLORS.grey },
  category: {
    alignSelf: "flex-start",
    backgroundColor: COLORS.goldLight,
    color: "#5a4210",
    fontSize: 11,
    fontWeight: "700",
    paddingVertical: 2,
    paddingHorizontal: 9,
    borderRadius: 14,
    marginBottom: 6,
    overflow: "hidden",
  },
  snippet: { fontSize: 12.5, color: "#4a5568", fontStyle: "italic" },
});
