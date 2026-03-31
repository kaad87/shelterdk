import { ScrollView, View, Text, Image, StyleSheet, Pressable, Linking } from "react-native";
import { useLocalSearchParams, Stack } from "expo-router";
import { useShelterDetail } from "../../hooks/use-shelter-detail";
import { getFeatures, getCapacity, getAddress, getLocationCoords } from "@shared/lib/shelter-detail";
import { MapPin, ExternalLink } from "lucide-react-native";

export default function ShelterDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { data: shelter, isLoading, error } = useShelterDetail(slug);

  if (isLoading) return <View style={styles.center}><Text>Henter...</Text></View>;
  if (error || !shelter) return <View style={styles.center}><Text>Shelter ikke fundet</Text></View>;

  const features = getFeatures(shelter);
  const capacity = getCapacity(shelter);
  const address = getAddress(shelter);
  const coords = getLocationCoords(shelter);

  return (
    <>
      <Stack.Screen options={{ title: shelter.title }} />
      <ScrollView style={styles.container}>
        {shelter.image_url && (
          <Image source={{ uri: shelter.image_url }} style={styles.hero} />
        )}

        <View style={styles.content}>
          <Text style={styles.title}>{shelter.title}</Text>

          {address && (
            <View style={styles.row}>
              <MapPin size={16} color="#666" />
              <Text style={styles.address}>{address}</Text>
            </View>
          )}

          {capacity && (
            <Text style={styles.capacity}>Kapacitet: {capacity} pladser</Text>
          )}

          {features.length > 0 && (
            <View style={styles.chips}>
              {features.map((f) => (
                <View key={f.label} style={styles.featureChip}>
                  <Text style={styles.featureText}>{f.label}{f.value ? `: ${f.value}` : ""}</Text>
                </View>
              ))}
            </View>
          )}

          {shelter.description && (
            <Text style={styles.description}>{shelter.description}</Text>
          )}

          {shelter.booking_url && (
            <Pressable
              style={styles.bookingButton}
              onPress={() => Linking.openURL(shelter.booking_url)}
            >
              <ExternalLink size={16} color="#fff" />
              <Text style={styles.bookingText}>Book shelter</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f0" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  hero: { width: "100%", height: 250 },
  content: { padding: 16 },
  title: { fontSize: 22, fontWeight: "bold", color: "#1a3a2a", marginBottom: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  address: { fontSize: 14, color: "#666" },
  capacity: { fontSize: 14, color: "#666", marginBottom: 12 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  featureChip: { backgroundColor: "#e8f0e8", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  featureText: { fontSize: 12, color: "#1a3a2a" },
  description: { fontSize: 15, color: "#333", lineHeight: 22, marginBottom: 16 },
  bookingButton: {
    backgroundColor: "#1a3a2a",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 10,
    marginBottom: 24,
  },
  bookingText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
