import { useEffect, useState } from "react";
import { fetchWeather } from "@/lib/ambient.functions";
import { Cloud, CloudRain, CloudSnow, CloudLightning, Sun, CloudSun, CloudFog } from "lucide-react";

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
  if (code === 45 || code === 48)
    return { label: "Fog", Icon: CloudFog, tone: "ambient-weather--fog" };
  if (code >= 51 && code <= 67)
    return { label: "Drizzle", Icon: CloudRain, tone: "ambient-weather--rain" };
  if (code >= 71 && code <= 77)
    return { label: "Snow", Icon: CloudSnow, tone: "ambient-weather--snow" };
  if (code >= 80 && code <= 82)
    return { label: "Showers", Icon: CloudRain, tone: "ambient-weather--showers" };
  if (code >= 95)
    return { label: "Thunderstorm", Icon: CloudLightning, tone: "ambient-weather--storm" };
  return { label: "Weather", Icon: Cloud, tone: "ambient-weather--neutral" };
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
  // Open-Meteo forecast host is blocked from sandboxed previews, so we
  // call our server proxy. The browser geocoders below stay client-side.
  const weather = await fetchWeather({ data: { lat, lon } });
  if ((weather as { unavailable?: boolean }).unavailable) {
    return { place, weather: null as unknown as Weather };
  }
  return { place, weather };
}

async function loadFromBrowserPosition(coords: GeolocationCoordinates): Promise<AmbientPayload> {
  const { latitude: lat, longitude: lon } = coords;
  const gJson = await fetchJson(
    `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`,
  );
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
  if (!Number.isFinite(lat) || !Number.isFinite(lon))
    throw new Error("Network location unavailable");
  return weatherFor(lat, lon, {
    city: gJson.city || "Local",
    country: gJson.country_name || "",
    countryCode: gJson.country_code || "",
  });
}

async function loadFromTimeZone(): Promise<AmbientPayload> {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const city = timeZone?.split("/").pop()?.replace(/_/g, " ") || "Local";
  const geo = await fetchJson(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`,
  );
  const match = geo.results?.[0];
  if (!match) throw new Error("Timezone location unavailable");
  return weatherFor(Number(match.latitude), Number(match.longitude), {
    city: match.name || city,
    country: match.country || "",
    countryCode: match.country_code || "",
  });
}

// Reference contract (shell.jsx TopBar + DESIGN.md "Status placement":
// topbar = breadcrumbs + date + weather ONLY): one mono-label run —
// [condition icon 12] CITY · TEMP° — styled exactly like the date span.
// The clock, pin icon, country chip, and tinted pill of the previous
// generation are gone; the real WMO condition picks the icon.
export function AmbientChip({ inline: _inline = true }: { inline?: boolean } = {}) {
  const [place, setPlace] = useState<Place | null>(null);
  const [weather, setWeather] = useState<Weather | null>(null);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const CACHE_KEY = "cadence.ambient.v4";
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
      } catch {
        /* stale cache — refetch below */
      }
    }
    try {
      localStorage.removeItem("cadence.ambient.v1");
      localStorage.removeItem("cadence.ambient.v2");
      localStorage.removeItem("cadence.ambient.v3");
    } catch {
      /* noop */
    }

    const fallback = () =>
      loadFromNetworkLocation()
        .catch(loadFromTimeZone)
        .then(applyPayload)
        .catch(() => setDenied(true));

    if (!("geolocation" in navigator)) {
      fallback();
      return;
    }

    // Sandboxed iframes (e.g. the in-app preview) often neither resolve nor
    // reject geolocation, leaving the strip stuck on "Locating…" with no
    // weather. Race the browser permission flow against a 2s timer that
    // triggers the network/timezone fallback so weather + temperature
    // always show up.
    let resolved = false;
    const settle = (fn: () => void) => {
      if (resolved) return;
      resolved = true;
      fn();
    };
    const timer = setTimeout(() => settle(fallback), 2000);

    navigator.geolocation.getCurrentPosition(
      ({ coords }) =>
        settle(() => {
          clearTimeout(timer);
          loadFromBrowserPosition(coords).then(applyPayload).catch(fallback);
        }),
      () =>
        settle(() => {
          clearTimeout(timer);
          fallback();
        }),
      { maximumAge: 15 * 60_000, timeout: 4500 },
    );
  }, []);

  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone?.split("/").pop()?.replace("_", " ");
  const city = place?.city ?? (denied ? tz || "Local" : "Locating…");
  const w = weather ? describe(weather.code, weather.isDay) : null;
  const Icon = w?.Icon ?? Cloud;

  return (
    <span
      className="mono-label"
      role="status"
      title={w ? `${city} · ${w.label}` : city}
      aria-label={`${city}${weather ? `, ${weather.tempC} degrees, ${w?.label}` : ""}`}
      style={{ display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}
    >
      {w && <Icon size={12} strokeWidth={1.75} />}
      {city}
      {weather && (
        <>
          {" "}
          · <span style={{ fontVariantNumeric: "tabular-nums" }}>{Math.round(weather.tempC)}°</span>
        </>
      )}
    </span>
  );
}
