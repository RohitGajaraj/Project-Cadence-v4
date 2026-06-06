import { useEffect, useState } from "react";
import { Cloud, CloudRain, CloudSnow, CloudLightning, Sun, CloudSun, CloudFog, MapPin } from "lucide-react";

type Place = { city: string; country: string; countryCode: string };
type Weather = { tempC: number; code: number; isDay: boolean };

// WMO weather code → { label, Icon, tone (semantic token class) }
function describe(code: number, isDay: boolean) {
  if (code === 0) return { label: isDay ? "Clear" : "Clear night", Icon: isDay ? Sun : Cloud, tone: "text-amber-400" };
  if (code <= 2) return { label: "Partly cloudy", Icon: CloudSun, tone: "text-amber-300" };
  if (code === 3) return { label: "Overcast", Icon: Cloud, tone: "text-muted-foreground" };
  if (code === 45 || code === 48) return { label: "Fog", Icon: CloudFog, tone: "text-slate-300" };
  if (code >= 51 && code <= 67) return { label: "Drizzle", Icon: CloudRain, tone: "text-sky-400" };
  if (code >= 71 && code <= 77) return { label: "Snow", Icon: CloudSnow, tone: "text-sky-200" };
  if (code >= 80 && code <= 82) return { label: "Showers", Icon: CloudRain, tone: "text-sky-500" };
  if (code >= 95) return { label: "Thunderstorm", Icon: CloudLightning, tone: "text-violet-400" };
  return { label: "Weather", Icon: Cloud, tone: "text-muted-foreground" };
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
    const cached = localStorage.getItem("cadence.ambient.v1");
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Date.now() - parsed.ts < 15 * 60_000) {
          setPlace(parsed.place);
          setWeather(parsed.weather);
          return;
        }
      } catch {}
    }
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
          localStorage.setItem("cadence.ambient.v1", JSON.stringify({ place: p, weather: w, ts: Date.now() }));
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
      className="pointer-events-auto fixed right-3 top-3 z-50 hidden items-center gap-2 rounded-full border border-border/60 bg-background/70 px-3 py-1.5 text-xs text-foreground shadow-sm backdrop-blur-md sm:flex"
      role="status"
      aria-label={`Local time ${fmtTime(now)}${place ? `, ${place.city}` : ""}${weather ? `, ${weather.tempC} degrees, ${w?.label}` : ""}`}
    >
      <span className="font-medium tabular-nums">{fmtTime(now)}</span>
      <span className="h-3 w-px bg-border" />
      <MapPin className="h-3 w-3 text-muted-foreground" />
      <span className="max-w-[10rem] truncate text-muted-foreground">
        {place ? (
          <>
            {place.city}
            {place.countryCode ? <span className="ml-1 rounded bg-muted px-1 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{place.countryCode}</span> : null}
          </>
        ) : denied ? (
          tz || "Local"
        ) : (
          "Locating…"
        )}
      </span>
      {weather ? (
        <>
          <span className="h-3 w-px bg-border" />
          <Icon className={`h-3.5 w-3.5 ${w?.tone ?? ""}`} />
          <span className="font-medium tabular-nums">{weather.tempC}°</span>
          <span className="text-muted-foreground">{w?.label}</span>
        </>
      ) : null}
    </div>
  );
}