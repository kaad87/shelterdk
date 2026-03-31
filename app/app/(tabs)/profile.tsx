import { View, Text, StyleSheet } from "react-native";

export default function ProfileTab() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Profil</Text>
      <Text style={styles.subtitle}>Indstillinger og profil</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#f5f5f0" },
  title: { fontSize: 24, fontWeight: "bold", color: "#1a3a2a" },
  subtitle: { fontSize: 16, color: "#666", marginTop: 8 },
});
