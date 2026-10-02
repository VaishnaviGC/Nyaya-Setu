import { Pressable, Text, StyleSheet } from "react-native";
import { COLORS } from "../theme";

const VARIANTS = {
  primary: { bg: COLORS.navy, text: COLORS.white, border: COLORS.navy },
  secondary: { bg: COLORS.white, text: COLORS.navy, border: COLORS.navy },
  gold: { bg: COLORS.gold, text: COLORS.navy, border: COLORS.gold },
  danger: { bg: COLORS.white, text: COLORS.red, border: COLORS.red },
};

export default function Button({ title, onPress, variant = "primary", disabled, style }) {
  const v = VARIANTS[variant] || VARIANTS.primary;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: v.bg, borderColor: v.border, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
        style,
      ]}
    >
      <Text style={[styles.text, { color: v.text }]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 1.5,
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: "center",
    width: "100%",
  },
  text: { fontSize: 15, fontWeight: "700" },
});
