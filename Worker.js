// Netstar Proxy — Cloudflare Worker
// Real endpoints discovered from original working code:
//   ubi-api.netstaraus.com.au  /vehicle/vehicles  (x-api-key auth)
//   fleetai-api.netstaraus.com.au  /external/drivers/driver-performance-summary  (x-api-key auth)
//   fleetai-api.netstaraus.com.au  /external/reports/object-status  (x-api-key auth)

const NETSTAR_BASE = "https://fleetai-api.netstaraus.com.au";
const UBI_BASE = "https://ubi-api.netstaraus.com.au";
const FALLBACK_KEY = "aROAW0rN00qS3Ar5iOnog";
const COMPANY = "Netstar Demo";
const LOCATION = "Netstar Demo";

function getKey(env) { return env.FLEETAI_API_KEY || FALLBACK_KEY; }

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-key",
};

function corsResponse(body, status = 200) {
  return new Response(body, { status, headers: { "Content-Type": "application/json", ...CORS } });
}
function errorResponse(msg, status = 500) {
  return corsResponse(JSON.stringify({ error: msg }), status);
}

// UBI API — vehicle list
async function ubiGET(path, env) {
  const res = await fetch(UBI_BASE + path, {
    method: "GET",
    headers: { "x-api-key": getKey(env), "Accept": "application/json" },
  });
  const text = await res.text();
  if (!res.ok) throw new Error("UBI " + res.status + ": " + text.slice(0, 200));
  return JSON.parse(text);
}

// FleetAI API — trip/driver performance data
async function netstarGET(path, env) {
  const res = await fetch(NETSTAR_BASE + path, {
    method: "GET",
    headers: { "x-api-key": getKey(env), "Accept": "application/json" },
  });
  const text = await res.text();
  if (!res.ok) throw new Error("FleetAI " + res.status + ": " + text.slice(0, 200));
  return JSON.parse(text);
}

// Get vehicle list from UBI API
async function getVehicleList(env) {
  const data = await ubiGET("/vehicle/vehicles", env);
  const list = Array.isArray(data) ? data : (data.data || []);
  return list.map(v => ({
    imei: String(v.Imei || v.imei || ""),
    id: String(v.Imei || v.imei || ""),
    registration: v.Registration || v.registration || v.Imei || "",
    make: v.Make || v.make || "—",
    model: v.Model || v.model || "—",
    year: v.Year || v.year || null,
    driver_name: v.DriverName || v.driver_name || v.Driver || "—",
    gvm_kg: parseFloat(v.GvmKg || v.gvm_kg || v.Gvm || 0) || 0,
    fuel_type: (v.FuelType || v.fuel_type || "diesel").toLowerCase(),
  }));
}

// Convert yyyy-MM-dd to dd-MM-yyyy HH:mm:ss as required by FleetAI API
function toFleetAIDate(isoDate, endOfDay = false) {
  const [y, m, d] = isoDate.split("-");
  return `${d}-${m}-${y} ${endOfDay ? "23:59:59" : "00:00:01"}`;
}

// Get driver performance summary for date range
async function getDriverPerf(dateFrom, dateTo, env) {
  const q = new URLSearchParams({
    company_names: COMPANY,
    location_names: LOCATION,
    start_date_time: toFleetAIDate(dateFrom, false),
    end_date_time: toFleetAIDate(dateTo, true),
  });
  const data = await netstarGET("/external/drivers/driver-performance-summary?" + q.toString(), env);
  return Array.isArray(data) ? data : (data.data || data.result || []);
}

// Get object status (odometer, fuel, speed) by IMEI
async function getObjectStatus(imei, env) {
  const data = await netstarGET("/external/reports/object-status?imei=" + imei, env);
  const list = Array.isArray(data) ? data : (data.data || []);
  return list.length > 0 ? list[0] : null;
}

// FTC summary — combines vehicles + trip data into one payload
async function ftcSummary(dateFrom, dateTo, env) {
  try {
    // Step 1: get vehicle list
    const vehicles = await getVehicleList(env);

    // Step 2: get driver performance for the period
    let driverPerf = [];
    try { driverPerf = await getDriverPerf(dateFrom, dateTo, env); } catch(e) {}

    // Step 3: enrich each vehicle with trip data and object status
    const enriched = await Promise.all(vehicles.map(async v => {
      // Match driver perf by registration or name
      const perf = driverPerf.find(d =>
        String(d.Registration || d.registration || "").toLowerCase() === v.registration.toLowerCase() ||
        String(d.Imei || d.imei || "") === v.imei
      );

      // Get live object status
      let status = null;
      if (v.imei) {
        try { status = await getObjectStatus(v.imei, env); } catch(e) {}
      }

      return {
        vehicle_id: v.id,
        registration: v.registration,
        make: v.make,
        model: v.model,
        year: v.year,
        gvm_kg: v.gvm_kg,
        fuel_type: v.fuel_type,
        driver: v.driver_name,
        odometer_start: parseFloat(perf?.OdometerStart || perf?.odometer_start || status?.OdomStart || 0),
        odometer_end: parseFloat(perf?.OdometerEnd || perf?.odometer_end || status?.Odometer || 0),
        fuel_litres: parseFloat(perf?.FuelConsumed || perf?.fuel_consumed || perf?.Fuel || 0),
        road_km: parseFloat(perf?.DistanceKm || perf?.distance_km || perf?.Distance || 0),
        offroad_km: parseFloat(perf?.OffRoadKm || perf?.off_road_km || 0),
        trips: parseInt(perf?.TripCount || perf?.trip_count || perf?.Trips || 0),
        period: new Date(dateFrom).toLocaleDateString("en-AU", { month: "short", year: "numeric" }),
        source: "fleetai",
        _perf: perf,
        _status: status,
      };
    }));

    return corsResponse(JSON.stringify({
      source_endpoint: UBI_BASE + "/vehicle/vehicles",
      date_from: dateFrom,
      date_to: dateTo,
      vehicles: enriched,
    }), 200);

  } catch (e) {
    return errorResponse("FTC summary failed: " + e.message, 502);
  }
}

// Probe — tests all known real endpoints
async function probe(dateFrom, dateTo, env) {
  const key = getKey(env);
  const from = dateFrom || "2025-04-01";
  const to = dateTo || "2025-04-30";
  const xApiHeaders = { "x-api-key": key, "Accept": "application/json" };
  const bearerHeaders = { "Authorization": "Bearer " + key, "Accept": "application/json" };

  const candidates = [
    // Real UBI endpoints
    { url: UBI_BASE + "/vehicle/vehicles", headers: xApiHeaders },
    { url: UBI_BASE + "/vehicle/vehicles", headers: bearerHeaders },
    { url: UBI_BASE + "/driver/drivers", headers: xApiHeaders },
    // Real FleetAI endpoints
    { url: NETSTAR_BASE + "/external/drivers/driver-performance-summary?company_names=" + COMPANY + "&location_names=" + LOCATION + "&start_date_time=" + toFleetAIDate(from, false) + "&end_date_time=" + toFleetAIDate(to, true), headers: xApiHeaders },
    { url: NETSTAR_BASE + "/external/reports/object-status?imei=all", headers: xApiHeaders },
    { url: NETSTAR_BASE + "/external/reports/object-status", headers: xApiHeaders },
    // Fallback guesses
    { url: UBI_BASE + "/vehicles", headers: xApiHeaders },
    { url: UBI_BASE + "/api/vehicles", headers: xApiHeaders },
    { url: NETSTAR_BASE + "/external/vehicles", headers: xApiHeaders },
  ];

  const results = await Promise.allSettled(
    candidates.map(async ({ url, headers }) => {
      const res = await fetch(url, { headers });
      let preview = "";
      try { preview = (await res.text()).slice(0, 300); } catch {}
      return { url, auth: headers["x-api-key"] ? "x-api-key" : "bearer", status: res.status, ok: res.ok, preview };
    })
  );

  const report = results.map((r, i) =>
    r.status === "fulfilled" ? r.value : { ...candidates[i], status: "error", ok: false, preview: r.reason?.message }
  );

  return corsResponse(JSON.stringify({
    key_preview: key.slice(0,4) + "***" + key.slice(-4),
    summary: { accessible: report.filter(r => r.ok).length, denied: report.filter(r => r.status === 401 || r.status === 403).length },
    accessible: report.filter(r => r.ok),
    denied: report.filter(r => r.status === 401 || r.status === 403),
    other: report.filter(r => !r.ok && r.status !== 401 && r.status !== 403),
  }, null, 2));
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

    if (path === "/health") {
      return corsResponse(JSON.stringify({ status: "ok", worker: "netstar-proxy", timestamp: new Date().toISOString(), key_preview: getKey(env).slice(0,4) + "***" }));
    }

    if (path === "/fleetai/probe") {
      return probe(url.searchParams.get("date_from"), url.searchParams.get("date_to"), env);
    }

    if (path === "/fleetai/ftc-summary") {
      const dateFrom = url.searchParams.get("date_from") || url.searchParams.get("from");
      const dateTo = url.searchParams.get("date_to") || url.searchParams.get("to");
      if (!dateFrom || !dateTo) return errorResponse("Missing date_from and date_to (YYYY-MM-DD)", 400);
      return ftcSummary(dateFrom, dateTo, env);
    }

    if (path === "/fleetai/vehicles") {
      try {
        const vehicles = await getVehicleList(env);
        return corsResponse(JSON.stringify({ vehicles, total: vehicles.length }));
      } catch(e) { return errorResponse(e.message, 502); }
    }

    if (path === "/fleetai/trips") {
      const dateFrom = url.searchParams.get("date_from");
      const dateTo = url.searchParams.get("date_to");
      if (!dateFrom || !dateTo) return errorResponse("Missing date_from / date_to", 400);
      try {
        const data = await getDriverPerf(dateFrom, dateTo, env);
        return corsResponse(JSON.stringify(data));
      } catch(e) { return errorResponse(e.message, 502); }
    }

    if (path === "/" || path === "/index.html") {
      const rawUrl = env.GITHUB_RAW_URL;
      if (!rawUrl) return new Response("GITHUB_RAW_URL not configured", { status: 500 });
      try {
        const res = await fetch(rawUrl);
        const html = await res.text();
        return new Response(html, { headers: { "Content-Type": "text/html;charset=UTF-8", ...CORS } });
      } catch(e) { return new Response("Failed to fetch: " + e.message, { status: 502 }); }
    }

    return errorResponse("Unknown route: " + path, 404);
  },
};
