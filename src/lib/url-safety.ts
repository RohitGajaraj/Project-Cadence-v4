// SSRF guard for user-supplied URLs (BYO base_url, webhook targets, etc.).
// Allows https:// for any host, and http:// only for localhost/127.0.0.1 (Ollama).
// Blocks RFC1918, link-local, loopback (over http with non-localhost host), and
// other private ranges to prevent probing internal infra.

function isPrivateIPv4(host: string): boolean {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true; // link-local (incl. AWS metadata)
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a >= 224) return true; // multicast / reserved
  return false;
}

function isLocalhost(host: string): boolean {
  const h = host.toLowerCase();
  return h === "localhost" || h === "127.0.0.1" || h === "::1" || h === "[::1]";
}

export function assertSafeBaseUrl(raw: string): string {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error("base_url must be a valid URL");
  }
  const proto = parsed.protocol;
  if (proto !== "https:" && proto !== "http:") {
    throw new Error("base_url must use http or https");
  }
  const host = parsed.hostname;
  if (proto === "http:" && !isLocalhost(host)) {
    throw new Error("http:// is only allowed for localhost");
  }
  // Block IP-literal access to private/internal ranges even over https.
  if (isPrivateIPv4(host) && !isLocalhost(host)) {
    throw new Error("base_url points to a private network address");
  }
  // Block IPv6 private/link-local (fc00::/7, fe80::/10) by simple prefix check.
  if (host.startsWith("[")) {
    const v6 = host.slice(1, -1).toLowerCase();
    if (v6.startsWith("fc") || v6.startsWith("fd") || v6.startsWith("fe8") || v6.startsWith("fe9") || v6.startsWith("fea") || v6.startsWith("feb")) {
      throw new Error("base_url points to a private network address");
    }
  }
  return parsed.toString();
}