import { useRef } from "react";
import { StyleSheet, View } from "react-native";
import Mapbox from "@rnmapbox/maps";
import type { Shelter } from "@shared/types/shelter";
import { getLocationCoords } from "@shared/lib/shelter-detail";

Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN!);

interface Props {
  shelters: Shelter[];
  onShelterPress?: (shelter: Shelter) => void;
  userLocation?: { lat: number; lon: number } | null;
}

export function ShelterMap({ shelters, onShelterPress, userLocation }: Props) {
  const cameraRef = useRef<Mapbox.Camera>(null);

  const features: GeoJSON.FeatureCollection = {
    type: "FeatureCollection",
    features: shelters
      .map((s) => {
        const coords = getLocationCoords(s);
        if (!coords) return null;
        return {
          type: "Feature" as const,
          geometry: { type: "Point" as const, coordinates: [coords.lon, coords.lat] },
          properties: { id: s.id, title: s.title, slug: s.slug },
        };
      })
      .filter(Boolean) as GeoJSON.Feature[],
  };

  return (
    <View style={styles.container}>
      <Mapbox.MapView style={styles.map} styleURL={Mapbox.StyleURL.Outdoors}>
        <Mapbox.Camera
          ref={cameraRef}
          defaultSettings={{
            centerCoordinate: [10.0, 56.0], // Center of Denmark
            zoomLevel: 6,
          }}
        />

        {userLocation && (
          <Mapbox.UserLocation visible animated />
        )}

        <Mapbox.ShapeSource
          id="shelters"
          shape={features}
          cluster
          clusterRadius={50}
          clusterMaxZoomLevel={14}
          onPress={(e) => {
            const feature = e.features[0];
            if (feature?.properties?.slug) {
              const shelter = shelters.find((s) => s.slug === feature.properties!.slug);
              if (shelter) onShelterPress?.(shelter);
            }
          }}
        >
          <Mapbox.CircleLayer
            id="clusters"
            filter={["has", "point_count"]}
            style={{
              circleColor: "#1a3a2a",
              circleRadius: ["step", ["get", "point_count"], 20, 10, 25, 50, 30],
              circleOpacity: 0.85,
            }}
          />
          <Mapbox.SymbolLayer
            id="cluster-count"
            filter={["has", "point_count"]}
            style={{
              textField: ["get", "point_count_abbreviated"],
              textSize: 14,
              textColor: "#ffffff",
            }}
          />
          <Mapbox.CircleLayer
            id="unclustered-point"
            filter={["!", ["has", "point_count"]]}
            style={{
              circleColor: "#1a3a2a",
              circleRadius: 8,
              circleStrokeWidth: 2,
              circleStrokeColor: "#ffffff",
            }}
          />
        </Mapbox.ShapeSource>
      </Mapbox.MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
});
