"use client";

import { useEffect, useState } from "react";
import {
  Cloud,
  CloudRain,
  CloudSnow,
  CloudLightning,
  Sun,
  CloudSun,
  CloudFog,
  CloudDrizzle,
} from "lucide-react";

const OPEN_METEO_BASE = "https://api.open-meteo.com/v1/forecast";

interface WeatherWidgetProps {
  latitude: number;
  longitude: number;
}

interface DailyForecast {
  time: string;
  weather_code: number;
  temperature_2m_max: number;
  temperature_2m_min: number;
}

interface ForecastResponse {
  daily?: {
    time: string[];
    weather_code: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
  };
}

/** WMO weather code → Lucide icon + beskrivelse. */
function getWeatherIcon(code: number): { Icon: typeof Sun; label: string } {
  if (code === 0) return { Icon: Sun, label: "Klart" };
  if (code >= 1 && code <= 3) return { Icon: CloudSun, label: "Let skyet" };
  if (code >= 45 && code <= 48) return { Icon: CloudFog, label: "Tåge" };
  if (code >= 51 && code <= 57) return { Icon: CloudDrizzle, label: "Støvregn" };
  if (code >= 61 && code <= 67) return { Icon: CloudRain, label: "Regn" };
  if (code >= 71 && code <= 77) return { Icon: CloudSnow, label: "Sne" };
  if (code >= 80 && code <= 82) return { Icon: CloudRain, label: "Byger" };
  if (code >= 85 && code <= 86) return { Icon: CloudSnow, label: "Snebyger" };
  if (code >= 95 && code <= 99) return { Icon: CloudLightning, label: "Torden" };
  return { Icon: Cloud, label: "Skyet" };
}

function formatDay(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  const now = new Date();
  const todayLocal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowLocal = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;
  if (dateStr === todayLocal) return "I dag";
  if (dateStr === tomorrowLocal) return "I morgen";
  return d.toLocaleDateString("da-DK", { weekday: "short", day: "numeric", month: "short" });
}

function SkeletonCard() {
  return (
    <div className="flex items-center gap-3 py-3 first:pt-0 border-b border-primary/5 last:border-0 last:pb-0">
      <div className="h-10 w-10 rounded-full bg-primary/10 animate-pulse shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="h-4 w-16 bg-primary/10 rounded animate-pulse mb-2" />
        <div className="h-3 w-20 bg-primary/10 rounded animate-pulse" />
      </div>
    </div>
  );
}

export function WeatherWidget({ latitude, longitude }: WeatherWidgetProps) {
  const [forecast, setForecast] = useState<DailyForecast[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({
      latitude: String(latitude),
      longitude: String(longitude),
      daily: "weather_code,temperature_2m_max,temperature_2m_min",
      forecast_days: "3",
      timezone: "auto",
    });

    fetch(`${OPEN_METEO_BASE}?${params.toString()}`)
      .then((res) => {
        if (!res.ok) throw new Error("Kunne ikke hente vejrudsigt");
        return res.json();
      })
      .then((data: ForecastResponse) => {
        if (cancelled) return;
        const daily = data.daily;
        if (!daily?.time?.length) {
          setForecast([]);
          return;
        }
        const list: DailyForecast[] = daily.time.slice(0, 3).map((time, i) => ({
          time,
          weather_code: daily.weather_code?.[i] ?? 0,
          temperature_2m_max: daily.temperature_2m_max?.[i] ?? 0,
          temperature_2m_min: daily.temperature_2m_min?.[i] ?? 0,
        }));
        setForecast(list);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Fejl");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [latitude, longitude]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-primary/10 bg-white shadow-sm p-6">
        <h2 className="font-serif text-lg font-bold text-primary mb-3">
          Vejrudsigt
        </h2>
        <div className="space-y-0">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    );
  }

  if (error || !forecast?.length) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-primary/10 bg-white shadow-sm p-6">
      <h2 className="font-serif text-lg font-bold text-primary mb-3">
        Vejrudsigt
      </h2>
      <ul className="space-y-0" aria-label="Vejrudsigt næste 3 dage">
        {forecast.map((day) => {
          const { Icon, label } = getWeatherIcon(day.weather_code);
          return (
            <li
              key={day.time}
              className="flex items-center gap-3 py-3 first:pt-0 border-b border-primary/5 last:border-0 last:pb-0"
            >
              <span
                className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/5 text-primary shrink-0"
                aria-hidden
              >
                <Icon size={22} strokeWidth={1.8} />
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-primary text-sm">
                  {formatDay(day.time)}
                </p>
                <p className="text-primary/60 text-xs">{label}</p>
              </div>
              <div className="text-right shrink-0">
                <span className="font-semibold text-primary tabular-nums">
                  {Math.round(day.temperature_2m_max)}°
                </span>
                <span className="text-primary/50 text-sm tabular-nums ml-1">
                  {Math.round(day.temperature_2m_min)}°
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
