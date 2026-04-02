import { Component, type ReactNode } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error("ErrorBoundary caught:", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Noget gik galt</Text>
          <Text style={styles.subtitle}>{this.props.fallbackTitle ?? "Prøv igen eller genstart appen"}</Text>
          <Pressable style={styles.button} onPress={() => this.setState({ hasError: false })}>
            <Text style={styles.buttonText}>Prøv igen</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", padding: 32, backgroundColor: "#f5f5f0" },
  title: { fontSize: 20, fontWeight: "bold", color: "#1a3a2a", marginBottom: 8 },
  subtitle: { fontSize: 14, color: "#666", marginBottom: 24, textAlign: "center" },
  button: { paddingHorizontal: 24, paddingVertical: 12, backgroundColor: "#1a3a2a", borderRadius: 10 },
  buttonText: { color: "#fff", fontWeight: "600" },
});
