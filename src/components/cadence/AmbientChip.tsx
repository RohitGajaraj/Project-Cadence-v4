import { useEffect, useState } from "react";
import { Cloud, CloudRain, CloudSnow, CloudLightning, Sun, CloudSun, CloudFog, MapPin } from "lucide-react";

type Place = { city: string; country: string; countryCode: string };
type Weather = { tempC: number; code: number; isDay: boolean };

// WMO weather code → { label, Icon, icon color, pill bg gradient, ring }
// Playful, weather-app-y tints kept subtle so the strip still reads as chrome.
type WxStyle = {
  label: string;
  Icon: typeof Sun;
  icon: string;   // icon + temp text color
  bg: string;     // pill background (gradient + transparency)
  ring: string;   // pill border
};
function describe(code: number, isDay: boolean): WxStyle {
  if (code === 0)
    return isDay
      ? { label: "Clear", Icon: Sun, icon: "text-amber-300", bg: "bg-gradient-to-r from-amber-400/25 to-orange-400/15", ring: "ring-1 ring-amber-300/30" }
      : { label: "Clear night", Icon: Cloud, icon: "text-indigo-200", bg: "bg-gradient-to-r from-indigo-500/25 to-violet-500/15", ring: "ring-1 ring-indigo-300/30" };
  if (code <= 2) return { label: "Partly cloudy", Icon: CloudSun, icon: "text-amber-200", bg: "bg-gradient-to-r from-amber-300/20 to-sky-400/15", ring: "ring-1 ring-amber-200/25" };
  if (code === 3) return { label: "Overcast", Icon: Cloud, icon: "text-slate-200", bg: "bg-gradient-to-r from-slate-400/20 to-slate-500/15", ring: "ring-1 ring-slate-300/25" };
  if (code === 45 || code === 48) return { label: "Fog", Icon: CloudFog, icon: "text-slate-200", bg: "bg-gradient-to-r from-slate-300/20 to-zinc-400/15", ring: "ring-1 ring-slate-200/25" };
  if (code >= 51 && code <= 67) return { label: "Drizzle", Icon: CloudRain, icon: "text-sky-300", bg: "bg-gradient-to-r from-sky-500/25 to-blue-500/15", ring: "ring-1 ring-sky-300/30" };
  if (code >= 71 && code <= 77) return { label: "Snow", Icon: CloudSnow, icon: "text-cyan-100", bg: "bg-gradient-to-r from-cyan-300/25 to-sky-200/15", ring: "ring-1 ring-cyan-200/30" };
  if (code >= 80 && code <= 82) return { label: "Showers", Icon: CloudRain, icon: "text-blue-300", bg: "bg-gradient-to-r from-blue-500/25 to-indigo-500/15", ring: "ring-1 ring-blue-300/30" };
  if (code >= 95) return { label: "Thunderstorm", Icon: CloudLightning, icon: "text-violet-300", bg: "bg-gradient-to-r from-violet-500/30 to-fuchsia-500/15", ring: "ring-1 ring-violet-300/30" };
  return { label: "Weather", Icon: Cloud, icon: "text-muted-foreground", bg: "bg-accent/40", ring: "" };
}

// Cold/hot temperature tint overrides icon color for extra "feel"
function tempTone(t: number) {
  if (t <= 0) return "text-cyan-200";
  if (t >= 32) return "text-orange-300";
  return null;
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
    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      setDenied(true);
      return;
    }
    const CACHE_KEY = "cadence.ambient.v2";
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        const fresh = Date.now() - parsed.ts < 15 * 60_000;
        const hasWeather = parsed.weather && typeof parsed.weather.tempC === "number";
        if (fresh && hasWeather) {
          setPlace(parsed.place);
          setWeather(parsed.weather);
          return;
        }
      } catch {}
    }
    // Clean up any stale v1 cache that may have stored a null weather
    try { localStorage.removeItem("cadence.ambient.v1"); } catch {}
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const { latitude: lat, longitude: lon } = coords;
          const [wRes, gRes] = await Promise.all([
            fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,is_day`),
            fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`),
          ]);
          const wJson = await wRes.json();
          const gJson = await gRes.json();
          const w: Weather = {
            tempC: Math.round(wJson.current?.temperature_2m ?? 0),
            code: wJson.current?.weather_code ?? 0,
            isDay: (wJson.current?.is_day ?? 1) === 1,
          };
          const p: Place = {
            city: gJson.city || gJson.locality || gJson.principalSubdivision || "Here",
            country: gJson.countryName || "",
            countryCode: gJson.countryCode || "",
          };
          setWeather(w);
          setPlace(p);
          localStorage.setItem(CACHE_KEY, JSON.stringify({ place: p, weather: w, ts: Date.now() }));
        } catch {
          setDenied(true);
        }
      },
      () => setDenied(true),
      { maximumAge: 15 * 60_000, timeout: 8000 }
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
          className={`ml-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${w.bg} ${w.ring}`}
          title={w.label}
        >
          <Icon className={`h-3 w-3 ${tempTone(weather.tempC) ?? w.icon}`} />
          <span className={`font-medium tabular-nums ${tempTone(weather.tempC) ?? w.icon}`}>
            {weather.tempC}°
          </span>
        </span>
      ) : null}
    </div>
  );
}