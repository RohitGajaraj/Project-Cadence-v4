import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";

/**
 * Localized + time-of-day greeting.
 *
 * - Country comes from Cloudflare's `cf-ipcountry` request header (set by the
 *   Worker edge for every request). Falls back to `x-vercel-ip-country` and
 *   then `accept-language` if the header is missing.
 * - Time-of-day bucket is derived from the user's local hour, which the
 *   client passes in (the server has no reliable local clock). Defaults to
 *   server UTC if absent.
 * - Pure greeting string assembled server-side so the hero doesn't need to
 *   ship a country-→-phrase map to the client bundle.
 */

type Bucket = "morning" | "afternoon" | "evening" | "night";

function bucketFor(hour: number): Bucket {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 22) return "evening";
  return "night";
}

// Curated per-country greetings. Keys are ISO-3166 alpha-2 (uppercase).
// Only the morning/afternoon/evening/night buckets the language actually
// distinguishes — many languages share a single all-day greeting (Hola,
// Namaste, Ciao) so we reuse it across buckets.
const COUNTRY_GREETINGS: Record<string, Record<Bucket, string>> = {
  IN: { morning: "Namaste", afternoon: "Namaste", evening: "Namaste", night: "Namaste" },
  ES: {
    morning: "Buenos días",
    afternoon: "Buenas tardes",
    evening: "Buenas noches",
    night: "Buenas noches",
  },
  MX: {
    morning: "Buenos días",
    afternoon: "Buenas tardes",
    evening: "Buenas noches",
    night: "Buenas noches",
  },
  AR: {
    morning: "Buenos días",
    afternoon: "Buenas tardes",
    evening: "Buenas noches",
    night: "Buenas noches",
  },
  DE: {
    morning: "Guten Morgen",
    afternoon: "Guten Tag",
    evening: "Guten Abend",
    night: "Gute Nacht",
  },
  AT: {
    morning: "Guten Morgen",
    afternoon: "Guten Tag",
    evening: "Guten Abend",
    night: "Gute Nacht",
  },
  CH: {
    morning: "Guten Morgen",
    afternoon: "Guten Tag",
    evening: "Guten Abend",
    night: "Gute Nacht",
  },
  FR: { morning: "Bonjour", afternoon: "Bonjour", evening: "Bonsoir", night: "Bonne nuit" },
  IT: {
    morning: "Buongiorno",
    afternoon: "Buon pomeriggio",
    evening: "Buonasera",
    night: "Buonanotte",
  },
  PT: { morning: "Bom dia", afternoon: "Boa tarde", evening: "Boa noite", night: "Boa noite" },
  BR: { morning: "Bom dia", afternoon: "Boa tarde", evening: "Boa noite", night: "Boa noite" },
  NL: {
    morning: "Goedemorgen",
    afternoon: "Goedemiddag",
    evening: "Goedenavond",
    night: "Goedenacht",
  },
  BE: {
    morning: "Goedemorgen",
    afternoon: "Goedemiddag",
    evening: "Goedenavond",
    night: "Goedenacht",
  },
  JP: { morning: "Ohayō", afternoon: "Konnichiwa", evening: "Konbanwa", night: "Oyasumi" },
  CN: { morning: "Zǎoshang hǎo", afternoon: "Nǐ hǎo", evening: "Wǎnshàng hǎo", night: "Wǎn'ān" },
  KR: { morning: "Annyeong", afternoon: "Annyeong", evening: "Annyeong", night: "Annyeong" },
  RU: {
    morning: "Dobroe utro",
    afternoon: "Dobryy den'",
    evening: "Dobryy vecher",
    night: "Spokoynoy nochi",
  },
  TR: {
    morning: "Günaydın",
    afternoon: "İyi günler",
    evening: "İyi akşamlar",
    night: "İyi geceler",
  },
  SE: { morning: "God morgon", afternoon: "God dag", evening: "God kväll", night: "God natt" },
  NO: { morning: "God morgen", afternoon: "God dag", evening: "God kveld", night: "God natt" },
  DK: { morning: "Godmorgen", afternoon: "Goddag", evening: "Godaften", night: "Godnat" },
  FI: { morning: "Huomenta", afternoon: "Päivää", evening: "Iltaa", night: "Hyvää yötä" },
  PL: {
    morning: "Dzień dobry",
    afternoon: "Dzień dobry",
    evening: "Dobry wieczór",
    night: "Dobranoc",
  },
  GR: { morning: "Kaliméra", afternoon: "Kaliméra", evening: "Kalispéra", night: "Kaliníchta" },
  IL: {
    morning: "Boker tov",
    afternoon: "Tzohorayim tovim",
    evening: "Erev tov",
    night: "Layla tov",
  },
  SA: {
    morning: "Sabah al-khair",
    afternoon: "Masa al-khair",
    evening: "Masa al-khair",
    night: "Tusbih ‘ala khair",
  },
  AE: {
    morning: "Sabah al-khair",
    afternoon: "Masa al-khair",
    evening: "Masa al-khair",
    night: "Tusbih ‘ala khair",
  },
  TH: { morning: "Sawasdee", afternoon: "Sawasdee", evening: "Sawasdee", night: "Ratri sawat" },
  VN: {
    morning: "Chào buổi sáng",
    afternoon: "Chào buổi chiều",
    evening: "Chào buổi tối",
    night: "Chúc ngủ ngon",
  },
  ID: {
    morning: "Selamat pagi",
    afternoon: "Selamat siang",
    evening: "Selamat malam",
    night: "Selamat malam",
  },
  MY: {
    morning: "Selamat pagi",
    afternoon: "Selamat tengah hari",
    evening: "Selamat petang",
    night: "Selamat malam",
  },
};

// English fallback by bucket.
const EN: Record<Bucket, string> = {
  morning: "Good morning",
  afternoon: "Good afternoon",
  evening: "Good evening",
  night: "Good evening",
};

function countryFromAcceptLanguage(value: string | undefined): string | null {
  if (!value) return null;
  // e.g. "en-IN,en;q=0.9,hi;q=0.8" -> "IN"
  const match = value.match(/[a-z]{2,3}-([A-Z]{2})/);
  return match ? match[1] : null;
}

export const getGreeting = createServerFn({ method: "GET" })
  .inputValidator((data: { localHour?: number } | undefined) => data ?? {})
  .handler(async ({ data }) => {
    const cf = getRequestHeader("cf-ipcountry");
    const vercel = getRequestHeader("x-vercel-ip-country");
    const accept = getRequestHeader("accept-language");

    const country = (cf || vercel || countryFromAcceptLanguage(accept) || "")
      .toUpperCase()
      .slice(0, 2);

    const hour =
      typeof data.localHour === "number" && data.localHour >= 0 && data.localHour <= 23
        ? data.localHour
        : new Date().getUTCHours();
    const bucket = bucketFor(hour);

    const localized =
      country && COUNTRY_GREETINGS[country] ? COUNTRY_GREETINGS[country][bucket] : EN[bucket];

    return {
      greeting: localized, // e.g. "Namaste" / "Buenos días" / "Good morning"
      bucket, // morning | afternoon | evening | night
      country: country || null, // ISO-2 or null
      localized: country !== "" && !!COUNTRY_GREETINGS[country],
    };
  });
