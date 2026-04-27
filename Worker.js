/**
 * Netstar Proxy — Cloudflare Worker
 *
 * Routes:
 *   GET  /                          → serves the PAYD Risk Scorer HTML from GitHub
 *   GET  /health                    → health check
 *   GET  /fleetai/probe             → diagnostic: tests all known FleetAI endpoints
 *   GET  /fleetai/vehicles          → proxy: FleetAI vehicle list
 *   GET  /fleetai/trips             → proxy: FleetAI trip summary for date range
 *   GET  /fleetai/fuel              → proxy: FleetAI fuel records for date range
 *   GET  /fleetai/ftc-summary       → proxy: combined FTC-ready payload
 *
 * Env vars (Cloudflare → Workers → Settings → Variables):
 *   FLEETAI_API_KEY   — Bearer token (fallback hardcoded below)
 *   GITHUB_RAW_URL    — Raw URL for PAYD scorer HTML
 */

const FLEETAI_BASE = "https://fleetai-api.netstaraus.com.au";
const FALLBACK_KEY = "aROAW0rN00qS3Ar5iOnog";

function getKey(env) {
  return env.FLEETAI_API_KEY || FALLBACK_KEY;
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function corsResponse(body, status = 200) {
  return new Response(body, {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

function errorResponse(message, status = 500) {
  return corsResponse(JSON.stringify({ error: message }), status);
}

async function proxyFleetAI(path, env) {
  const url = `${FLEETAI_BASE}${path}`;
  const res = await fetch(url, {
    headers: {
      "Authorization": `Bearer ${getKey(env)}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
  });
  const text = await res.text();
  if (!res.ok) return errorResponse(`FleetAI ${res.status}: ${text.slice(0, 300)}`, res.status);
  return corsResponse(text, 200);
}

async function probe(dateFrom, dateTo, env) {
  const headers = {
    "Authorization": `Bearer ${getKey(env)}`,
    "Content-Type": "application/json",
    "Accept": "application/json",
  };
  const from = dateFrom || "2025-04-01";
  const to   = dateTo   || "2025-04-30";

  const candidates = [
    `${FLEETAI_BASE}/api/v2/fleet/summary?date_from=${from}&date_to=${to}`,
    `${FLEETAI_BASE}/api/v1/vehicles/trips/summary?start=${from}&end=${to}`,
    `${FLEETAI_BASE}/api/v1/vehicles?active=true&stats_from=${from}&stats_to=${to}`,
    `${FLEETAI_BASE}/api/v1/vehicles?active=true`,
    `${FLEETAI_BASE}/api/vehicles?start_date=${from}&end_date=${to}&include_trips=true`,
    `${FLEETAI_BASE}/api/vehicles`,
    `${FLEETAI_BASE}/api/v1/vehicles/report?from=${from}&to=${to}`,
    `${FLEETAI_BASE}/api/v1/trips?date_from=${from}&date_to=${to}`,
    `${FLEETAI_BASE}/api/v1/trips/summary?date_from=${from}&date_to=${to}`,
    `${FLEETAI_BASE}/api/v1/fuel?date_from=${from}&date_to=${to}`,
    `${FLEETAI_BASE}/api/v1/fleet`,
    `${FLEETAI_BASE}/api/v1/fleet/vehicles`,
    `${FLEETAI_BASE}/v1/fleet/report?from=${from}&to=${to}`,
    `${FLEETAI_BASE}/api/v1/drivers`,
    `${FLEETAI_BASE}/api/v1/assets`,
    `${FLEETAI_BASE}/api/v1/units`,
    `${FLEETAI_BASE}/api/v1/devices`,
  ];

  const results = await Promise.allSettled(
    candidates.map(async (url) => {
      const res = await fetch(url, { headers });
      let preview = null;
      try { preview = (await res.text()).slice(0, 400); } catch {}
      return { url, status: res.status, ok: res.ok, preview };
    })
  );

  const report = results.map((r, i) =>
    r.status === "fulfilled" ? r.value : { url: candidates[i], status: "fetch_error", ok: false, preview: r.reason?.message }
  );

  return corsResponse(JSON.stringify({
    key_used: getKey(env).slice(0,4) + "***" + getKey(env).slice(-4),
    date_range: { from, to },
    summary: {
      accessible: report.filter(r => r.ok).length,
      denied:     report.filter(r => r.status === 401 || r.status === 403).length,
      not_found:  report.filter(r => r.status === 404).length,
      errors:     report.filter(r => !r.ok && ![401,403,404].includes(r.status)).length,
    },
    accessible: report.filter(r => r.ok),
    denied:     report.filter(r => r.status === 401 || r.status === 403),
    not_found:  report.filter(r => r.status === 404),
    errors:     report.filter(r => !r.ok && ![401,403,404].includes(r.status)),
  }, null, 2), 200);
}

async function ftcSummary(dateFrom, dateTo, env) {
  const headers = {
    "Authorization": `Bearer ${getKey(env)}`,
    "Content-Type": "application/json",
    "Accept": "application/json",
  };

  const candidates = [
    `${FLEETAI_BASE}/api/v2/fleet/summary?date_from=${dateFrom}&date_to=${dateTo}`,
    `${FLEETAI_BASE}/api/v1/vehicles/trips/summary?start=${dateFrom}&end=${dateTo}`,
    `${FLEETAI_BASE}/api/v1/vehicles?active=true&stats_from=${dateFrom}&stats_to=${dateTo}`,
    `${FLEETAI_BASE}/api/vehicles?start_date=${dateFrom}&end_date=${dateTo}&include_trips=true`,
    `${FLEETAI_BASE}/api/v1/vehicles?active=true`,
    `${FLEETAI_BASE}/api/v1/fleet/vehicles`,
    `${FLEETAI_BASE}/api/v1/assets`,
  ];

  let lastStatus = null;
  let lastBody = null;

  for (const url of candidates) {
    try {
      const res = await fetch(url, { headers });
      const body = await res.text();
      if (res.status === 401) return errorResponse("FleetAI API key invalid or expired.", 401);
      if (res.status === 403) return errorResponse("FleetAI API key lacks fleet read permission.", 403);
      if (res.ok) {
        let data;
        try { data = JSON.parse(body); } catch { continue; }
        const vehicles = data?.vehicles || data?.data?.vehicles || data?.data || (Array.isArray(data) ? data : null);
        if (vehicles && (Array.isArray(vehicles) ? vehicles.length > 0 : Object.keys(vehicles).length > 0)) {
          return corsResponse(JSON.stringify({
            source_endpoint: url,
            date_from: dateFrom,
            date_to: dateTo,
            vehicles: Array.isArray(vehicles) ? vehicles : [vehicles],
            _raw: data,
          }), 200);
        }
      }
      lastStatus = res.status;
      lastBody = body?.slice(0, 300);
    } catch (e) {
      lastBody = e.message;
    }
  }

  return errorResponse(`No FleetAI endpoint returned vehicle data. Last status: ${lastStatus}. Body: ${lastBody}`, 502);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

    if (path === "/health") {
      return corsResponse(JSON.stringify({
        status: "ok",
        worker: "netstar-proxy",
        timestamp: new Date().toISOString(),
        key_preview: getKey(env).slice(0,4) + "***",
      }));
    }

    if (path === "/fleetai/probe") {
      return probe(url.searchParams.get("date_from"), url.searchParams.get("date_to"), env);
    }

    if (path === "/fleetai/ftc-summary") {
      const dateFrom = url.searchParams.get("date_from") || url.searchParams.get("from");
      const dateTo   = url.searchParams.get("date_to")   || url.searchParams.get("to");
      if (!dateFrom || !dateTo) return errorResponse("Missing date_from and date_to (YYYY-MM-DD)", 400);
      return ftcSummary(dateFrom, dateTo, env);
    }

    if (path === "/fleetai/vehicles") {
      const qs = url.searchParams.toString();
      return proxyFleetAI(`/api/v1/vehicles${qs ? `?${qs}` : "?active=true"}`, env);
    }

    if (path === "/fleetai/trips") {
      const dateFrom = url.searchParams.get("date_from");
      const dateTo   = url.searchParams.get("date_to");
      if (!dateFrom || !dateTo) return errorResponse("Missing date_from / date_to", 400);
      return proxyFleetAI(`/api/v1/trips/summary?date_from=${dateFrom}&date_to=${dateTo}`, env);
    }

    if (path === "/fleetai/fuel") {
      const dateFrom = url.searchParams.get("date_from");
      const dateTo   = url.searchParams.get("date_to");
      if (!dateFrom || !dateTo) return errorResponse("Missing date_from / date_to", 400);
      return proxyFleetAI(`/api/v1/fuel?date_from=${dateFrom}&date_to=${dateTo}`, env);
    }

    if (path === "/" || path === "/index.html") {
      if (!env.GITHUB_RAW_URL) return new Response("GITHUB_RAW_URL not configured", { status: 500 });
      try {
        const res = await fetch(env.GITHUB_RAW_URL);
        const html = await res.text();
        return new Response(html, { headers: { "Content-Type": "text/html;charset=UTF-8", ...CORS } });
      } catch (e) {
        return new Response(`Failed to fetch from GitHub: ${e.message}`, { status: 502 });
      }
    }

    return errorResponse(`Unknown route: ${path}`, 404);
  },
};
