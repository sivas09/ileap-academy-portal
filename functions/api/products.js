const defaultApiBaseUrl = "https://english.ileapacademy.com";

export async function onRequestGet({ env }) {
  const apiBaseUrl = env.ILEAP_API_BASE_URL || defaultApiBaseUrl;
  const upstreamUrl = new URL("/api/products", apiBaseUrl);

  const upstream = await fetch(upstreamUrl.toString(), {
    headers: { Accept: "application/json" }
  });
  const body = await upstream.text();

  return new Response(body, {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("Content-Type") || "application/json; charset=utf-8",
      "Cache-Control": upstream.ok ? "public, max-age=60" : "no-store"
    }
  });
}
