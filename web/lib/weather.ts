const OPEN_METEO_BASE = "https://api.open-meteo.com/v1/forecast";

export interface DailyForecast {
  time: string;
  weather_code: number;
  temperature_2m_max: number;
  temperature_2m_min: number;
}

/**
 * Henter 3-dages vejrudsigt server-side fra Open-Meteo.
 * Bruges til at pre-populate WeatherWidget så der ikke vises skeleton ved første load.
 * Caches 1 time via Next.js fetch-cache.
 */
export async function getWeatherForecast(
  latitude: number,
  longitude: number
): Promise<DailyForecast[] | null> {
  const params = new URLSearchParams({
    latitude: latitude.toFixed(4),
    longitude: longitude.toFixed(4),
    daily: "weather_code,temperature_2m_max,temperature_2m_min",
    forecast_days: "3",
    timezone: "auto",
  });

  try {
    const res = await fetch(`${OPEN_METEO_BASE}?${params.toString()}`, {
      next: { revalidate: 3600 }, // cache 1 time
    });
    if (!res.ok) return null;
    const data = await res.json();
    const daily = data?.daily;
    if (!daily?.time?.length) return null;
    return daily.time.slice(0, 3).map(
      (time: string, i: number): DailyForecast => ({
        time,
        weather_code: daily.weather_code?.[i] ?? 0,
        temperature_2m_max: daily.temperature_2m_max?.[i] ?? 0,
        temperature_2m_min: daily.temperature_2m_min?.[i] ?? 0,
      })
    );
  } catch {
    return null;
  }
}
