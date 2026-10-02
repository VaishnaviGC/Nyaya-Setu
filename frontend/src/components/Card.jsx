import { View, Text, StyleSheet } from "react-native";
import { COLORS } from "../theme";

export default function Card({ title, children, style }) {
  return (
    <View style={[styles.card, style]}>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      {typeof children === "string" ? <Text style={styles.body}>{children}</Text> : children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 16,
    marginBottom: 14,
  },
  title: { fontSize: 15, fontWeight: "700", color: COLORS.navy, marginBottom: 6 },
  body: { fontSize: 13.5, color: "#4a5568", lineHeight: 20 },
});
