import { useEffect, useState } from "react";
import { Cloud, CloudRain, CloudSnow, CloudLightning, Sun, CloudSun, CloudFog, MapPin } from "lucide-react";

type Place = { city: string; country: string; countryCode: string };
type Weather = { tempC: number; code: number; isDay: boolean };
type AmbientPayload = { place: Place; weather: Weather };

// WMO weather code → { label, Icon, icon color, pill bg gradient, ring }
// Playful, weather-app-y tints kept subtle so the strip still reads as chrome.
type WxStyle = {
  label: string;
  Icon: typeof Sun;
  tone: string;
};
function describe(code: number, isDay: boolean): WxStyle {
  if (code === 0)
    return isDay
      ? { label: "Clear", Icon: Sun, tone: "ambient-weather--sunny" }
      : { label: "Clear night", Icon: Cloud, tone: "ambient-weather--night" };
  if (code <= 2) return { label: "Partly cloudy", Icon: CloudSun, tone: "ambient-weather--partly" };
  if (code === 3) return { label: "Overcast", Icon: Cloud, tone: "ambient-weather--overcast" };
  if (code === 45 || code === 48) return { label: "Fog", Icon: CloudFog, tone: "ambient-weather--fog" };
  if (code >= 51 && code <= 67) return { label: "Drizzle", Icon: CloudRain, tone: "ambient-weather--rain" };
  if (code >= 71 && code <= 77) return { label: "Snow", Icon: CloudSnow, tone: "ambient-weather--snow" };
  if (code >= 80 && code <= 82) return { label: "Showers", Icon: CloudRain, tone: "ambient-weather--showers" };
  if (code >= 95) return { label: "Thunderstorm", Icon: CloudLightning, tone: "ambient-weather--storm" };
  return { label: "Weather", Icon: Cloud, tone: "ambient-weather--neutral" };
}

// Cold/hot temperature tint overrides icon color for extra "feel"
function tempTone(t: number) {
  if (t <= 0) return "ambient-weather--freezing";
  if (t >= 32) return "ambient-weather--hot";
  return null;
}

async function fetchJson(url: string, timeoutMs = 6000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error("Ambient request failed");
    return await res.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function weatherFor(lat: number, lon: number, place: Place): Promise<AmbientPayload> {
  const wJson = await fetchJson(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,is_day`);
  return {
    place,
    weather: {
      tempC: Math.round(wJson.current?.temperature_2m ?? 0),
      code: wJson.current?.weather_code ?? 0,
      isDay: (wJson.current?.is_day ?? 1) === 1,
    },
  };
}

async function loadFromBrowserPosition(coords: GeolocationCoordinates): Promise<AmbientPayload> {
  const { latitude: lat, longitude: lon } = coords;
  const gJson = await fetchJson(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`);
  return weatherFor(lat, lon, {
    city: gJson.city || gJson.locality || gJson.principalSubdivision || "Here",
    country: gJson.countryName || "",
    countryCode: gJson.countryCode || "",
  });
}

async function loadFromNetworkLocation(): Promise<AmbientPayload> {
  const gJson = await fetchJson("https://ipapi.co/json/");
  const lat = Number(gJson.latitude);
  const lon = Number(gJson.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) throw new Error("Network location unavailable");
  return weatherFor(lat, lon, {
    city: gJson.city || "Local",
    country: gJson.country_name || "",
    countryCode: gJson.country_code || "",
  });
}

async function loadFromTimeZone(): Promise<AmbientPayload> {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const city = timeZone?.split("/").pop()?.replace(/_/g, " ") || "Local";
  const geo = await fetchJson(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`);
  const match = geo.results?.[0];
  if (!match) throw new Error("Timezone location unavailable");
  return weatherFor(Number(match.latitude), Number(match.longitude), {
    city: match.name || city,
    country: match.country || "",
    countryCode: match.country_code || "",
  });
}

function fmtTime(d: Date) {
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function AmbientChip() {
  const [now, setNow] = useState(() => new Date());
  const [place, setPlace] = useState<Place | null>(null);
  const [weather, setWeather] = useState<Weather | null>(null);
  const [denied, setDenied] = useState(false);

  // tick clock every 30s
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const CACHE_KEY = "cadence.ambient.v3";
    const applyPayload = (payload: AmbientPayload) => {
      setPlace(payload.place);
      setWeather(payload.weather);
      setDenied(false);
      localStorage.setItem(CACHE_KEY, JSON.stringify({ ...payload, ts: Date.now() }));
    };
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        const fresh = Date.now() - parsed.ts < 15 * 60_000;
        const hasWeather = parsed.weather && typeof parsed.weather.tempC === "number";
        if (fresh && hasWeather) {
          applyPayload({ place: parsed.place, weather: parsed.weather });
          return;
        }
      } catch {}
    }
    try {
      localStorage.removeItem("cadence.ambient.v1");
      localStorage.removeItem("cadence.ambient.v2");
    } catch {}

    const fallback = () =>
      loadFromNetworkLocation()
        .catch(loadFromTimeZone)
        .then(applyPayload)
        .catch(() => setDenied(true));

    if (!("geolocation" in navigator)) {
      fallback();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => loadFromBrowserPosition(coords).then(applyPayload).catch(fallback),
      fallback,
      { maximumAge: 15 * 60_000, timeout: 4500 }
    );
  }, []);

  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone?.split("/").pop()?.replace("_", " ");

  const w = weather ? describe(weather.code, weather.isDay) : null;
  const Icon = w?.Icon ?? Cloud;

  return (
    <div
      className="sticky top-0 z-40 flex h-8 items-center justify-end gap-2 border-b border-border/40 bg-background/80 px-3 text-[11px] text-muted-foreground backdrop-blur-md"
      role="status"
      aria-label={`Local time ${fmtTime(now)}${place ? `, ${place.city}` : ""}${weather ? `, ${weather.tempC} degrees, ${w?.label}` : ""}`}
    >
      <span className="font-medium tabular-nums text-foreground/80">{fmtTime(now)}</span>
      <span className="h-3 w-px bg-border/60" />
      <MapPin className="h-3 w-3" />
      <span className="max-w-[12rem] truncate">
        {place ? (
          <>
            {place.city}
            {place.countryCode ? <span className="ml-1 rounded bg-muted/70 px-1 py-0.5 text-[9px] font-medium uppercase tracking-wide">{place.countryCode}</span> : null}
          </>
        ) : denied ? (
          tz || "Local"
        ) : (
          "Locating…"
        )}
      </span>
      {weather && w ? (
        <span
          className={`ambient-weather ml-1 ${tempTone(weather.tempC) ?? w.tone}`}
          title={w.label}
        >
          <Icon className="h-3 w-3" />
          <span className="font-medium tabular-nums">
            {weather.tempC}°
          </span>
        </span>
      ) : null}
      {needsCalendarConnect ? (
        <>
          <span className="h-3 w-px bg-border/60" />
          <Link
            to="/calendar"
            title="Connect your calendar"
            aria-label="Connect your calendar"
            className="ambient-connect group relative inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary transition-colors hover:bg-primary/20"
          >
            <span className="ambient-connect__ping absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
            <CalendarPlus className="h-3 w-3" />
            <span>Connect</span>
          </Link>
        </>
      ) : null}
    </div>
  );
}