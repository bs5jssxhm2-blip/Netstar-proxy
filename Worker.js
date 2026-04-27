/**
 * Netstar Proxy — Cloudflare Worker
 * 
 * Routes:
 *   GET  /                          → serves the PAYD Risk Scorer HTML from GitHub
 *   GET  /health                    → health check
 *   GET  /fleetai/vehicles          → proxy: FleetAI vehicle list (active fleet)
 *   GET  /fleetai/trips             → proxy: FleetAI trip summary for date range
 *   GET  /fleetai/fuel              → proxy: FleetAI fuel records for date range
 *   GET  /fleetai/ftc-summary       → proxy: combined FTC-ready payload (vehicles + trips + fuel)
 *
 * Environment variables (set in Cloudflare dashboard → Workers → Settings → Variables):
 *   FLEETAI_API_KEY   — Bearer token for FleetAI API
 *   GITHUB_RAW_URL    — Raw URL for the PAYD scorer HTML (existing)
 *
 * CORS: allowed from any origin so the FTC tool artifact can call this directly.
 */

const FLEETAI_BASE = "https://fleetai-api.netstaraus.com.au";

// ─── CORS HEADERS ─────────────────────────────────────────────────────────────
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function corsResponse(body, status = 200, extraHeaders = {}) {
  return new Response(body, {
    status,
    headers: { "Content-Type": "application/json", ...CORS, ...extraHeaders },
  });
}

function errorResponse(message, status = 500) {
  return corsResponse(JSON.stringify({ error: message }), status);
}

// ─── FLEETAI PROXY HELPER ─────────────────────────────────────────────────────
async function proxyFleetAI(path, env) {
  const url = `${FLEETAI_BASE}${path}`;
  const res = await fetch(url, {
    headers: {
      "Authorization": `Bearer ${env.FLEETAI_API_KEY}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
  });

  const text = await res.text();
  if (!res.ok) {
    return errorResponse(
      `FleetAI returned ${res.status}: ${text.slice(0, 200)}`,
      res.status
    );
  }
  return corsResponse(text, 200);
}

// ─── FTC SUMMARY — combines vehicles + trip summary into one payload ──────────
// The FTC tool calls this single endpoint to get everything it needs.
// We attempt multiple FleetAI endpoint shapes to handle API version differences.
async function ftcSummary(dateFrom, dateTo, env) {
  const headers = {
    "Authorization": `Bearer ${env.FLEETAI_API_KEY}`,
    "Content-Type": "application/json",
    "Accept": "application/json",
  };

  // Candidate endpoint patterns — FleetAI has varied these across versions.
  // We try each in order and return the first successful response with data.
  const candidates = [
    // v2 summary endpoint
    `${FLEETAI_BASE}/api/v2/fleet/summary?date_from=${dateFrom}&date_to=${dateTo}`,
    // v1 vehicles with trip aggregation
    `${FLEETAI_BASE}/api/v1/vehicles/trips/summary?start=${dateFrom}&end=${dateTo}`,
    // older flat endpoint
    `${FLEETAI_BASE}/api/vehicles/report?from=${dateFrom}&to=${dateTo}&include_fuel=true`,
    // vehicle list with date-scoped stats
    `${FLEETAI_BASE}/api/v1/vehicles?active=true&stats_from=${dateFrom}&stats_to=${dateTo}`,
    // minimal vehicle list — no trip data, will need separate fuel call
    `${FLEETAI_BASE}/api/v1/vehicles?active=true`,
  ];

  let lastStatus = null;
  let lastBody = null;

  for (const url of candidates) {
    try {
      const res = await fetch(url, { headers });
      const body = await res.text();

      if (res.status === 401) {
        return errorResponse("FleetAI API key invalid or expired.", 401);
      }
      if (res.status === 403) {
        return errorResponse("FleetAI API key does not have fleet read permission.", 403);
      }

      if (res.ok) {
        let data;
        try { data = JSON.parse(body); } catch { continue; }

        // Validate we got something usable — at minimum an array or object with vehicles
        const vehicles = data?.vehicles || data?.data?.vehicles || data?.data || (Array.isArray(data) ? data : null);
        if (vehicles && (Array.isArray(vehicles) ? vehicles.length > 0 : Object.keys(vehicles).length > 0)) {
          // Wrap in a consistent envelope for the FTC tool to consume
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

  return errorResponse(
    `No FleetAI endpoint returned vehicle data. Last status: ${lastStatus}. Body: ${lastBody}`,
    502
  );
}

// ─── MAIN HANDLER ─────────────────────────────────────────────────────────────
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }

    // ── Health check ──────────────────────────────────────────────────────────
    if (path === "/health") {
      return corsResponse(JSON.stringify({
        status: "ok",
        worker: "netstar-proxy",
        timestamp: new Date().toISOString(),
        fleetai_key_set: !!env.FLEETAI_API_KEY,
      }));
    }

    // ── FleetAI: FTC summary (main endpoint for FTC tool) ─────────────────────
    if (path === "/fleetai/ftc-summary") {
      const dateFrom = url.searchParams.get("date_from") || url.searchParams.get("from");
      const dateTo   = url.searchParams.get("date_to")   || url.searchParams.get("to");
      if (!dateFrom || !dateTo) {
        return errorResponse("Missing required params: date_from and date_to (YYYY-MM-DD)", 400);
      }
      return ftcSummary(dateFrom, dateTo, env);
    }

    // ── FleetAI: vehicle list ─────────────────────────────────────────────────
    if (path === "/fleetai/vehicles") {
      const qs = url.searchParams.toString();
      return proxyFleetAI(`/api/v1/vehicles${qs ? `?${qs}` : "?active=true"}`, env);
    }

    // ── FleetAI: trip summary ─────────────────────────────────────────────────
    if (path === "/fleetai/trips") {
      const dateFrom = url.searchParams.get("date_from");
      const dateTo   = url.searchParams.get("date_to");
      if (!dateFrom || !dateTo) return errorResponse("Missing date_from / date_to", 400);
      return proxyFleetAI(
        `/api/v1/trips/summary?date_from=${dateFrom}&date_to=${dateTo}`,
        env
      );
    }

    // ── FleetAI: fuel records ─────────────────────────────────────────────────
    if (path === "/fleetai/fuel") {
      const dateFrom = url.searchParams.get("date_from");
      const dateTo   = url.searchParams.get("date_to");
      if (!dateFrom || !dateTo) return errorResponse("Missing date_from / date_to", 400);
      return proxyFleetAI(
        `/api/v1/fuel?date_from=${dateFrom}&date_to=${dateTo}`,
        env
      );
    }

    // ── PAYD Risk Scorer HTML (existing route) ─────────────────────────────────
    if (path === "/" || path === "/index.html") {
      if (!env.GITHUB_RAW_URL) {
        return new Response("GITHUB_RAW_URL not configured", { status: 500 });
      }
      try {
        const res = await fetch(env.GITHUB_RAW_URL);
        const html = await res.text();
        return new Response(html, {
          headers: { "Content-Type": "text/html;charset=UTF-8", ...CORS },
        });
      } catch (e) {
        return new Response(`Failed to fetch from GitHub: ${e.message}`, { status: 502 });
      }
    }

    return errorResponse(`Unknown route: ${path}`, 404);
  },
};
