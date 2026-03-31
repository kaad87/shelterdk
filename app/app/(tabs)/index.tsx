import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { ShelterMap } from "../../components/ShelterMap";
import { useShelters } from "../../hooks/use-shelters";

export default function MapTab() {
  const { data: shelters } = useShelters();
  const router = useRouter();

  return (
    <View style={styles.container}>
      <ShelterMap
        shelters={shelters ?? []}
        onShelterPress={(s) => router.push(`/shelter/${s.slug}`)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
