import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Mapbox from "@rnmapbox/maps";

interface OfflineRegion {
  name: string;
  bounds: [[number, number], [number, number]]; // SW, NE
  minZoom: number;
  maxZoom: number;
}

const OFFLINE_REGIONS: OfflineRegion[] = [
  { name: "Jylland Nord", bounds: [[8.0, 56.5], [11.0, 57.8]], minZoom: 8, maxZoom: 14 },
  { name: "Jylland Syd", bounds: [[8.0, 54.8], [11.0, 56.5]], minZoom: 8, maxZoom: 14 },
  { name: "Fyn", bounds: [[9.5, 54.9], [11.0, 55.7]], minZoom: 8, maxZoom: 14 },
  { name: "Sjælland", bounds: [[11.0, 54.9], [12.8, 56.2]], minZoom: 8, maxZoom: 14 },
  { name: "Bornholm", bounds: [[14.6, 54.9], [15.2, 55.4]], minZoom: 8, maxZoom: 14 },
];

interface DownloadState {
  downloaded: Record<string, boolean>;
  downloading: string | null;
  progress: number;
  regions: OfflineRegion[];
  startDownload: (regionName: string) => Promise<void>;
  deleteRegion: (regionName: string) => Promise<void>;
}

export const useDownloadStore = create<DownloadState>()(
  persist(
    (set, get) => ({
      downloaded: {},
      downloading: null,
      progress: 0,
      regions: OFFLINE_REGIONS,

      startDownload: async (regionName) => {
        const region = OFFLINE_REGIONS.find((r) => r.name === regionName);
        if (!region) return;

        set({ downloading: regionName, progress: 0 });

        await Mapbox.offlineManager.createPack(
          {
            name: regionName,
            styleURL: Mapbox.StyleURL.Outdoors,
            bounds: region.bounds,
            minZoom: region.minZoom,
            maxZoom: region.maxZoom,
          },
          (_pack, status) => {
            if (status.percentage) {
              set({ progress: status.percentage });
            }
            if (status.percentage === 100) {
              set((state) => ({
                downloaded: { ...state.downloaded, [regionName]: true },
                downloading: null,
                progress: 0,
              }));
            }
          },
          (_pack, error) => {
            console.error("Download error:", error);
            set({ downloading: null, progress: 0 });
          }
        );
      },

      deleteRegion: async (regionName) => {
        await Mapbox.offlineManager.deletePack(regionName);
        set((state) => {
          const downloaded = { ...state.downloaded };
          delete downloaded[regionName];
          return { downloaded };
        });
      },
    }),
    {
      name: "shelterdk-downloads",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ downloaded: state.downloaded }),
    }
  )
);
