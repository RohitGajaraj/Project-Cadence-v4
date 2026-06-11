import { createServerFn } from "@tanstack/react-start";

// Server-side proxy for the Open-Meteo forecast endpoint. The browser
// preview iframe blocks api.open-meteo.com (ERR_CONNECTION_CLOSED), but
// the server runtime can reach it fine, so we proxy through here to keep
// the ambient weather chip reliable everywhere.
export const fetchWeather = createServerFn({ method: "GET" })
  .inputValidator((input: { lat: number; lon: number }) => input)
  .handler(async ({ data }) => {
    const { lat, lon } = data;
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,is_day`;
    try {
      const res = await fetch(url);
      if (!res.ok) {
        console.warn(`Weather lookup failed (${res.status})`);
        return { tempC: 0, code: 0, isDay: true, unavailable: true as const };
      }
      const j = (await res.json()) as {
        current?: { temperature_2m?: number; weather_code?: number; is_day?: number };
      };
      return {
        tempC: Math.round(j.current?.temperature_2m ?? 0),
        code: j.current?.weather_code ?? 0,
        isDay: (j.current?.is_day ?? 1) === 1,
      };
    } catch (err) {
      console.warn("Weather lookup error", err);
      return { tempC: 0, code: 0, isDay: true, unavailable: true as const };
    }
  });