const NETSTAR_BASE = "https://fleetai-api.netstaraus.com.au";
const ALLOWED_ORIGIN = "*";

function cors(origin) {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-api-key, Authorization",
    "Access-Control-Max-Age": "86400",
  };
}

function json(data, status = 200, origin = "*") {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...cors(origin) },
  });
}

function err(msg, status = 400, origin = "*") {
  return json({ error: msg }, status, origin);
}

function pad(n) { return String(n).padStart(2, "0"); }
function toNetstarDate(d) {
  return `${pad(d.getDate())}-${pad(d.getMonth()+1)}-${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
function toNetstar(s, endOfDay = false) {
  if (!s) return null;
  if (/^\d{2}-\d{2}-\d{4}/.test(s)) return s;
  const d = new Date(s);
  if (isNaN(d)) return null;
  if (endOfDay) d.setHours(23, 59, 59);
  return toNetstarDate(d);
}
function defaultRange() {
  const to = new Date(), from = new Date(to - 30 * 86400000);
  return { from: toNetstarDate(from), to: toNetstarDate(to) };
}

async function netstar(path, apiKey, body) {
  const res = await fetch(`${NETSTAR_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, Accept: "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) { const t = await res.text().catch(() => ""); throw new Error(`Netstar ${res.status}: ${t.slice(0,300)}`); }
  return res.json();
}

const WEIGHTS = { harsh_braking_rate:0.22, harsh_acceleration_rate:0.18, speeding_rate:0.25, night_driving_pct:0.12, fatigue_events_rate:0.15, distraction_events_rate:0.08 };
const MAX_VALS = { harsh_braking_rate:15, harsh_acceleration_rate:12, speeding_rate:40, night_driving_pct:50, fatigue_events_rate:5, distraction_events_rate:8 };

function riskScore(f) {
  let s = 0;
  for (const [k,w] of Object.entries(WEIGHTS)) s += Math.min((f[k]||0)/MAX_VALS[k],1)*w*100;
  return Math.round(Math.min(Math.pow(s/100,0.85)*100,100)*10)/10;
}
function lossCost(sc, km=15000) { return Math.round(1200*(Math.exp(sc/35)-0.9)*Math.sqrt(km/15000)); }
function riskBand(sc) { return sc<20?"Excellent":sc<40?"Good":sc<60?"Moderate":sc<80?"High":"Critical"; }
function safe(v) { const n=parseFloat(v); return isNaN(n)||n<0?0:n; }

function mapVehicles(raw) {
  const list = Array.isArray(raw)?raw:raw.data||raw.result||raw.vehicles||[];
  return {
    vehicles: list.map(v=>({
      imei: v.imei_no||v.imei||v.ImeiNo||"",
      id: v.imei_no||v.imei||v.ImeiNo||"",
      registration: v.registration||v.reg_no||v.object_name||v.ObjectName||"",
      driver_name: v.driver_name||v.DriverName||v.employee_name||"Unknown",
      make: v.make||v.Make||"",
      model: v.model||v.Model||"",
      company: v.company_name||v.CompanyName||"",
      location: v.location_name||v.LocationName||"",
    })),
    total: list.length,
  };
}

function rowToFeatures(r) {
  return {
    harsh_braking_rate:      safe(r.harsh_braking_count||r.HarshBrakingCount||r.harsh_braking||0),
    harsh_acceleration_rate: safe(r.harsh_acceleration_count||r.HarshAccelerationCount||r.harsh_acceleration||0),
    speeding_rate:           safe(r.speeding_percentage||r.SpeedingPercentage||r.over_speed_percentage||0),
    night_driving_pct:       safe(r.night_driving_percentage||r.NightDrivingPercentage||r.night_percentage||0),
    fatigue_events_rate:     safe(r.fatigue_count||r.FatigueCount||r.fatigue_events||0),
    distraction_events_rate: safe(r.distraction_count||r.DistractionCount||r.distraction_events||0),
  };
}

async function handleVehicles(url, apiKey, origin) {
  const company_name = url.searchParams.get("company_name")||null;
  const raw_names = url.searchParams.get("company_names");
  const company_names = raw_names?raw_names.split(",").map(s=>s.trim()):null;
  const raw = await netstar("/external/company-vehicles", apiKey, {
    ...(company_name&&{company_name}), ...(company_names&&{company_names}),
  });
  return json(mapVehicles(raw), 200, origin);
}

async function handleFleetScores(url, apiKey, origin) {
  const company_names = url.searchParams.get("company_names")||null;
  const annual_km = parseInt(url.searchParams.get("annual_km")||"15000",10);
  const range = defaultRange();
  const start = toNetstar(url.searchParams.get("start_date"))||range.from;
  const end = toNetstar(url.searchParams.get("end_date"),true)||range.to;
  const raw = await netstar("/external/drivers/driver-performance-summary", apiKey, {
    start_date_time:start, end_date_time:end, ...(company_names&&{company_names}),
  });
  const list = Array.isArray(raw)?raw:raw.data||raw.result||[];
  const scored = list.map(r=>{
    const features=rowToFeatures(r), sc=riskScore(features);
    return {
      imei:r.imei_no||r.imei||r.ImeiNo||"", id:r.imei_no||r.imei||r.ImeiNo||"",
      registration:r.registration||r.reg_no||r.object_name||"",
      driver_name:r.driver_name||r.employee_name||"Unknown",
      company:r.company_name||"", features, risk_score:sc, risk_band:riskBand(sc),
      predicted_loss_cost:lossCost(sc,annual_km),
      netstar_driver_score:safe(r.driver_score||r.DriverScore||0),
      total_distance_km:safe(r.total_distance||r.TotalDistance||0),
      total_trips:safe(r.total_trips||r.TotalTrips||0),
    };
  }).sort((a,b)=>b.risk_score-a.risk_score);
  return json({vehicles:scored,total:scored.length,period_from:start,period_to:end},200,origin);
}

async function handleDriverScore(url, apiKey, origin) {
  const imei = url.searchParams.get("imei")||null;
  const company_names = url.searchParams.get("company_names")||null;
  const annual_km = parseInt(url.searchParams.get("annual_km")||"15000",10);
  const range = defaultRange();
  const start = toNetstar(url.searchParams.get("start_date"))||range.from;
  const end = toNetstar(url.searchParams.get("end_date"),true)||range.to;
  const baseBody = { start_date_time:start, end_date_time:end, ...(company_names&&{company_names}) };
  const perfRaw = await netstar("/external/drivers/driver-performance-summary", apiKey, baseBody);
  const list = Array.isArray(perfRaw)?perfRaw:perfRaw.data||perfRaw.result||[];
  const r = imei?(list.find(x=>(x.imei_no||x.imei||x.ImeiNo)===imei)||list[0]||{}):(list[0]||{});
  const features = rowToFeatures(r);
  if (imei) {
    try {
      const osRaw = await netstar("/external/reports/overspeed-summary", apiKey, {...baseBody,imeis:[imei]});
      const osList = Array.isArray(osRaw)?osRaw:osRaw.data||osRaw.result||[];
      const pct = safe((osList[0]||{}).over_speed_percentage||(osList[0]||{}).OverSpeedPercentage||0);
      if (pct>0) features.speeding_rate=pct;
    } catch(_) {}
  }
  let totalDistance=safe(r.total_distance||r.TotalDistance||0), totalTrips=safe(r.total_trips||r.TotalTrips||0);
  if (imei) {
    try {
      const tripsRaw = await netstar("/external/reports/trip-summary", apiKey, {...baseBody,imeis:[imei]});
      const tList = Array.isArray(tripsRaw)?tripsRaw:tripsRaw.data||tripsRaw.result||[];
      const dist = tList.reduce((a,t)=>a+safe(t.distance||t.Distance||t.total_distance||0),0);
      if (dist>0) { totalDistance=dist; totalTrips=tList.length; }
    } catch(_) {}
  }
  const sc = riskScore(features);
  return json({ imei, driver_name:r.driver_name||r.employee_name||"Unknown",
    registration:r.registration||r.reg_no||r.object_name||"", company:r.company_name||"",
    period_from:start, period_to:end, features, risk_score:sc, risk_band:riskBand(sc),
    predicted_loss_cost:lossCost(sc,annual_km), total_distance_km:totalDistance,
    total_trips:totalTrips, netstar_driver_score:safe(r.driver_score||r.DriverScore||0),
  },200,origin);
}

addEventListener("fetch", event => { event.respondWith(handle(event.request)); });

async function handle(request) {
  const url = new URL(request.url);
  const origin = request.headers.get("Origin")||"*";
  if (request.method==="OPTIONS") return new Response(null,{status:204,headers:cors(origin)});
  if (url.pathname==="/health") return json({status:"ok",version:"2.0",upstream:NETSTAR_BASE},200,origin);
  const apiKey = request.headers.get("x-api-key")||(request.headers.get("Authorization")||"").replace("Bearer ","");
  if (!apiKey) return err("Missing x-api-key header",401,origin);
  try {
    const p = url.pathname.replace(/\/$/,"");
    if (p==="/vehicles")     return await handleVehicles(url,apiKey,origin);
    if (p==="/fleet-scores") return await handleFleetScores(url,apiKey,origin);
    if (p==="/driver-score") return await handleDriverScore(url,apiKey,origin);
    if (p==="/health")       return json({status:"ok"},200,origin);
    return err(`Unknown route: ${p}`,404,origin);
  } catch(e) {
    console.error("[netstar-proxy]",e.message);
    return err(`Upstream error: ${e.message}`,502,origin);
  }
}
