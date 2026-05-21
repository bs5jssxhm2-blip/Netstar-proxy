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

// Customer API key registry — add new customers here
const CUSTOMER_KEYS = {
  "demo":          "aROAW0rN00qS3Ar5iOnog",
  "lakemacquarie": "sMKtnBiviEan0sepCTpz8w",
  "michael":       "sMKtnBiviEan0sepCTpz8w",
  "shaun":         "sMKtnBiviEan0sepCTpz8w",
};
const CUSTOMER_META = {
  "demo":          { company: "Netstar Demo",               location: "Netstar Demo" },
  "lakemacquarie": { company: "Lake Macquarie City Council", location: "Lake Macquarie City Council" },
  "michael":       { company: "Lake Macquarie City Council", location: "Lake Macquarie City Council" },
  "shaun":         { company: "Lake Macquarie City Council", location: "Lake Macquarie City Council" },
};
const FTC_HTML = atob("PCFET0NUWVBFIGh0bWw+CjxodG1sIGxhbmc9ImVuIj4KPGhlYWQ+CjxtZXRhIGNoYXJzZXQ9IlVURi04Ij4KPG1ldGEgbmFtZT0idmlld3BvcnQiIGNvbnRlbnQ9IndpZHRoPWRldmljZS13aWR0aCxpbml0aWFsLXNjYWxlPTEiPgo8bWV0YSBuYW1lPSJtb2JpbGUtd2ViLWFwcC1jYXBhYmxlIiBjb250ZW50PSJ5ZXMiPgo8bWV0YSBuYW1lPSJhcHBsZS1tb2JpbGUtd2ViLWFwcC1jYXBhYmxlIiBjb250ZW50PSJ5ZXMiPgo8bWV0YSBuYW1lPSJhcHBsZS1tb2JpbGUtd2ViLWFwcC10aXRsZSIgY29udGVudD0iRlRDIFRvb2wiPgo8dGl0bGU+TmV0c3RhciBGVEMgVG9vbDwvdGl0bGU+CjxsaW5rIGhyZWY9Imh0dHBzOi8vZm9udHMuZ29vZ2xlYXBpcy5jb20vY3NzMj9mYW1pbHk9SUJNK1BsZXgrTW9ubzp3Z2h0QDQwMDs1MDA7NjAwJmZhbWlseT1ETStTYW5zOndnaHRAMzAwOzQwMDs1MDA7NjAwOzcwMCZkaXNwbGF5PXN3YXAiIHJlbD0ic3R5bGVzaGVldCI+CjxzdHlsZT4KOnJvb3QgewogIC0tYmc6ICAgICAgICNmMGYyZjU7CiAgLS1zdXJmYWNlOiAgI2ZmZmZmZjsKICAtLXN1cmZhY2UyOiAjZjVmN2ZhOwogIC0tYm9yZGVyOiAgICNlMGU0ZWE7CiAgLS1ib3JkZXIyOiAgI2M4Y2RkNjsKICAtLXRleHQ6ICAgICAjMWEyMzMyOwogIC0tbXV0ZWQ6ICAgICM1YTZhN2U7CiAgLS1oaW50OiAgICAgIzg4OTZhODsKICAtLWJsdWU6ICAgICAjMWE1ZmJhOwogIC0tYmx1ZTI6ICAgICMxYTVmYmE7CiAgLS10ZWFsOiAgICAgIzBkOGE2YTsKICAtLW9yYW5nZTogICAjZDQ2MDBhOwogIC0tZ3JlZW46ICAgICMwZDdhNGE7CiAgLS1ncmVlbjI6ICAgI2U4ZjVlZjsKICAtLXJlZDogICAgICAjY2MyMDIwOwogIC0tYW1iZXI6ICAgICNiODY4MDA7CiAgLS1hbWJlckJnOiAgI2ZmZjhlODsKICAtLW1vbm86ICAgICAnSUJNIFBsZXggTW9ubycsIG1vbm9zcGFjZTsKICAtLWJvZHk6ICAgICAnRE0gU2FucycsIHNhbnMtc2VyaWY7CiAgLS1yYWRpdXM6ICAgMTBweDsKICAtLXJhZGl1cy1zbTo2cHg7CiAgLS1zaGFkb3c6ICAgMCAycHggMTJweCByZ2JhKDAsMCwwLC4wOCk7Cn0KKntib3gtc2l6aW5nOmJvcmRlci1ib3g7bWFyZ2luOjA7cGFkZGluZzowfQpodG1sLGJvZHl7aGVpZ2h0OjEwMCU7b3ZlcmZsb3c6aGlkZGVufQpib2R5e2JhY2tncm91bmQ6dmFyKC0tYmcpO2NvbG9yOnZhcigtLXRleHQpO2ZvbnQtZmFtaWx5OnZhcigtLWJvZHkpO2ZvbnQtc2l6ZToxNHB4O2Rpc3BsYXk6ZmxleDtmbGV4LWRpcmVjdGlvbjpjb2x1bW59");

function getKey(env, clientId) { return (clientId && CUSTOMER_KEYS[clientId]) ? CUSTOMER_KEYS[clientId] : (env.FLEETAI_API_KEY || FALLBACK_KEY); }
function getClientMeta(clientId) { return CUSTOMER_META[clientId] || { company: COMPANY, location: LOCATION }; }

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// AZURE AD SSO
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const AZURE_TENANTS = {};

function azureAuthUrl(env, clientId, tenantId, redirectUri, state) {
  const tenant = tenantId || AZURE_TENANTS[clientId] || env.AZURE_TENANT_ID || "common";
  const params = new URLSearchParams({
    client_id:     env.AZURE_CLIENT_ID || "",
    response_type: "code",
    redirect_uri:  redirectUri,
    response_mode: "query",
    scope:         "openid profile email User.Read",
    state:         state || clientId,
    prompt:        "select_account",
  });
  return `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize?${params}`;
}

async function azureTokenExchange(env, code, redirectUri, tenantId) {
  const tenant = tenantId || env.AZURE_TENANT_ID || "common";
  const body = new URLSearchParams({
    client_id:     env.AZURE_CLIENT_ID || "",
    client_secret: env.AZURE_CLIENT_SECRET || "",
    code,
    redirect_uri:  redirectUri,
    grant_type:    "authorization_code",
    scope:         "openid profile email User.Read",
  });
  const res = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error("Azure token exchange failed: " + err.slice(0, 200));
  }
  return res.json();
}

async function azureGetUserProfile(accessToken) {
  const res = await fetch("https://graph.microsoft.com/v1.0/me", {
    headers: { Authorization: "Bearer " + accessToken },
  });
  if (!res.ok) throw new Error("Graph API failed: " + res.status);
  return res.json();
}

function makeAzureToken(clientId, email, tenantId, secret) {
  const payload = [clientId, email, tenantId || "common", Date.now(), secret || SESSION_SECRET].join(":");
  return btoa(payload);
}

function verifyAzureToken(token, clientId, secret) {
  try {
    const parts = atob(token).split(":");
    if (parts[parts.length - 1] !== (secret || SESSION_SECRET)) return false;
    if (parts[0] !== clientId) return false;
    const age = Date.now() - parseInt(parts[parts.length - 2]);
    return age < 8 * 60 * 60 * 1000;
  } catch { return false; }
}

function isAzureAuthenticated(request, clientId, secret) {
  const m = (request.headers.get("Cookie") || "").match(/ftc_azure_session=([^;]+)/);
  if (!m) return false;
  return verifyAzureToken(m[1], clientId, secret);
}

function azureLoginRedirectPage(authUrl, clientId, companyName) {
  return new Response(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${companyName || "FleetAI Pro"} — Sign In</title><style>*{box-sizing:border-box;margin:0;padding:0}body{background:#060c14;color:#e8f4ff;font-family:Arial,sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}.card{background:#0c1622;border:1px solid #1e2e40;border-radius:12px;padding:48px 40px;width:100%;max-width:400px;text-align:center}.logo{font-size:11px;font-weight:700;color:#3d9be8;letter-spacing:2px;text-transform:uppercase;margin-bottom:12px}h1{font-size:22px;font-weight:700;margin-bottom:6px}.sub{font-size:14px;color:#7899bb;margin-bottom:36px}.ms-btn{display:inline-flex;align-items:center;gap:12px;background:#fff;color:#111;border:none;border-radius:6px;padding:12px 24px;font-size:15px;font-weight:600;cursor:pointer;text-decoration:none;transition:opacity .15s}.ms-btn:hover{opacity:.9}.divider{color:#3d5a7a;font-size:12px;margin:24px 0}.alt-link{color:#3d9be8;font-size:13px;text-decoration:none}.footer{font-size:11px;color:#3d5a7a;margin-top:28px}</style></head><body><div class="card"><div class="logo">Netstar Australia</div><h1>FleetAI Pro</h1><div class="sub">${companyName ? companyName + " &mdash; " : ""}Sign in to continue</div><a href="${authUrl}" class="ms-btn"><svg width="20" height="20" viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="1" width="9" height="9" fill="#f25022"/><rect x="11" y="1" width="9" height="9" fill="#7fba00"/><rect x="1" y="11" width="9" height="9" fill="#00a4ef"/><rect x="11" y="11" width="9" height="9" fill="#ffb900"/></svg>Sign in with Microsoft</a><div class="divider">or</div><a href="/ftc-login?client=${clientId}" class="alt-link">Use username &amp; password instead</a><div class="footer">Your Microsoft credentials are never shared with Netstar &bull; Secured by Azure AD</div></div></body></html>`,
    { status: 200, headers: { "Content-Type": "text/html;charset=UTF-8" } });
}

async function handleAzureCallback(request, env) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state") || "demo";
  const error = url.searchParams.get("error");
  if (error) return new Response(`Azure AD login error: ${url.searchParams.get("error_description") || error}`, { status: 400 });
  if (!code) return new Response("Missing auth code", { status: 400 });
  const clientId = state;
  const redirectUri = `${url.origin}/auth/callback`;
  const tenantId = AZURE_TENANTS[clientId] || env.AZURE_TENANT_ID || "common";
  try {
    const tokens = await azureTokenExchange(env, code, redirectUri, tenantId);
    const profile = await azureGetUserProfile(tokens.access_token);
    const email = profile.mail || profile.userPrincipalName || "unknown";
    const displayName = profile.displayName || email;
    const sessionToken = makeAzureToken(clientId, email, tenantId, env.SESSION_SECRET || SESSION_SECRET);
    return new Response("", {
      status: 302,
      headers: {
        Location: `/?client=${clientId}&az_user=${encodeURIComponent(displayName)}`,
        "Set-Cookie": `ftc_azure_session=${sessionToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=28800`,
      },
    });
  } catch (e) {
    return new Response(`Authentication failed: ${e.message}`, { status: 500 });
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CAD WEBHOOK LAYER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const DURESS_EVENT_STORE = [];
const MAX_STORED_EVENTS = 500;

const CAD_PROFILES = {
  hexagon_icad: {
    name: "Hexagon I/CAD (HxGN OnCall)",
    method: "POST",
    contentType: "application/json",
    buildPayload: (event) => ({
      incidentType: "DURESS", priority: 1, callSource: "FleetAI Pro Duress",
      location: { latitude: event.lat, longitude: event.lon, address: event.address || "", lastKnown: event.location_type === "last_known" },
      unit: { id: event.unit_id, name: event.unit_name || event.unit_id, driverName: event.driver_name || "" },
      eventTime: event.timestamp, deviceId: event.device_id,
      notes: `FleetAI Pro duress alert — ${event.unit_name || event.unit_id} — ${event.driver_name || "Unknown driver"}`,
    }),
  },
  motorola_premierone: {
    name: "Motorola PremierOne",
    method: "POST",
    contentType: "application/json",
    buildPayload: (event) => ({
      CallType: "DURESS", Priority: "1", CallerName: event.driver_name || event.unit_name || "",
      Location: event.address || `${event.lat},${event.lon}`, Latitude: String(event.lat), Longitude: String(event.lon),
      Comments: `FleetAI Pro: ${event.unit_id} duress activation`, SourceSystem: "NetstarFleetAIPro", EventTime: event.timestamp,
    }),
  },
  generic_webhook: {
    name: "Generic Webhook / ESB",
    method: "POST",
    contentType: "application/json",
    buildPayload: (event) => event,
  },
};

function normaliseDuressEvent(raw) {
  return {
    event_id:      crypto.randomUUID(),
    timestamp:     raw.timestamp || new Date().toISOString(),
    device_id:     raw.device_id || raw.imei || raw.deviceId || "",
    unit_id:       raw.unit_id   || raw.registration || raw.vehicleId || "",
    unit_name:     raw.unit_name || raw.vehicle_name || "",
    driver_name:   raw.driver_name || raw.driver || "",
    lat:           parseFloat(raw.lat || raw.latitude  || 0),
    lon:           parseFloat(raw.lon || raw.longitude || 0),
    address:       raw.address || raw.location_address || "",
    location_type: raw.location_type || (raw.gps_live === false ? "last_known" : "live"),
    battery_pct:   raw.battery_pct  || raw.battery || null,
    signal_type:   raw.signal_type  || "4G",
    activation:    raw.activation   || "manual",
    client_id:     raw.client_id    || "unknown",
    raw:           raw,
  };
}

async function forwardToCAD(event, env) {
  const cadUrl    = env.CAD_WEBHOOK_URL;
  const cadProfile = env.CAD_PROFILE || "generic_webhook";
  const cadAuth   = env.CAD_AUTH_HEADER;
  if (!cadUrl) return { forwarded: false, reason: "CAD_WEBHOOK_URL not configured — event stored locally" };
  const profile = CAD_PROFILES[cadProfile] || CAD_PROFILES.generic_webhook;
  const payload = profile.buildPayload(event);
  const headers = { "Content-Type": profile.contentType };
  if (cadAuth) headers["Authorization"] = cadAuth;
  try {
    const res = await fetch(cadUrl, { method: profile.method, headers, body: JSON.stringify(payload) });
    const responseText = await res.text().catch(() => "");
    return { forwarded: res.ok, cad_status: res.status, cad_profile: cadProfile, cad_url: cadUrl, response: responseText.slice(0, 200), reason: res.ok ? "success" : `CAD returned HTTP ${res.status}` };
  } catch (e) {
    return { forwarded: false, reason: "CAD request failed: " + e.message };
  }
}

function storeEvent(event, cadResult) {
  DURESS_EVENT_STORE.unshift({ ...event, _cad: cadResult, _stored_at: new Date().toISOString() });
  if (DURESS_EVENT_STORE.length > MAX_STORED_EVENTS) DURESS_EVENT_STORE.length = MAX_STORED_EVENTS;
}

async function handleDuressAlert(request, env) {
  let raw;
  try { raw = await request.json(); } catch { return errorResponse("Invalid JSON body", 400); }
  const event = normaliseDuressEvent(raw);
  if (!event.device_id && !event.unit_id) return errorResponse("Missing device_id or unit_id", 400);
  if (!event.lat && !event.lon) return errorResponse("Missing location (lat/lon)", 400);
  const cadResult = await forwardToCAD(event, env);
  storeEvent(event, cadResult);
  return corsResponse(JSON.stringify({ accepted: true, event_id: event.event_id, timestamp: event.timestamp, unit: event.unit_id, location: { lat: event.lat, lon: event.lon, type: event.location_type }, cad: cadResult }), 200);
}

function handleDuressEvents(url) {
  const limit  = Math.min(parseInt(url.searchParams.get("limit")  || "50"), 200);
  const unitId = url.searchParams.get("unit_id") || "";
  const since  = url.searchParams.get("since")   || "";
  let events = DURESS_EVENT_STORE;
  if (unitId) events = events.filter(e => e.unit_id === unitId);
  if (since)  events = events.filter(e => e.timestamp >= since);
  return corsResponse(JSON.stringify({ total: events.length, limit, events: events.slice(0, limit).map(e => ({ event_id: e.event_id, timestamp: e.timestamp, unit_id: e.unit_id, unit_name: e.unit_name, driver_name: e.driver_name, lat: e.lat, lon: e.lon, location_type: e.location_type, battery_pct: e.battery_pct, signal_type: e.signal_type, activation: e.activation, cad_forwarded: e._cad?.forwarded || false, cad_status: e._cad?.cad_status || null })) }));
}

function handleCADStatus(env) {
  const cadUrl     = env.CAD_WEBHOOK_URL;
  const cadProfile = env.CAD_PROFILE || "generic_webhook";
  const profile    = CAD_PROFILES[cadProfile] || CAD_PROFILES.generic_webhook;
  const recentEvents = DURESS_EVENT_STORE.slice(0, 10);
  const forwarded    = recentEvents.filter(e => e._cad?.forwarded).length;
  return corsResponse(JSON.stringify({
    integration: { configured: !!cadUrl, cad_profile: cadProfile, profile_name: profile.name, webhook_url: cadUrl ? cadUrl.replace(/https?:\/\/[^/]+/, "[host redacted]") : null, auth_set: !!env.CAD_AUTH_HEADER, azure_sso: !!(env.AZURE_CLIENT_ID && env.AZURE_CLIENT_SECRET) },
    event_stats: { total_stored: DURESS_EVENT_STORE.length, recent_10: recentEvents.length, recent_forwarded: forwarded, last_event: DURESS_EVENT_STORE[0]?.timestamp || null },
    cad_profiles_available: Object.entries(CAD_PROFILES).map(([k, v]) => ({ id: k, name: v.name })),
    azure_tenants_configured: Object.keys(AZURE_TENANTS).length,
    setup_notes: [cadUrl ? null : "ACTION REQUIRED: Set CAD_WEBHOOK_URL Worker secret", env.AZURE_CLIENT_ID ? null : "OPTIONAL: Set AZURE_CLIENT_ID + AZURE_CLIENT_SECRET + AZURE_TENANT_ID for SSO"].filter(Boolean),
  }));
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SYNTHESIA VIDEO GENERATION — Server-side proxy
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const SYNTHESIA_BASE = "https://api.synthesia.io/v2";

async function synthesiaFetch(env, path, options = {}) {
  const key = env.SYNTHESIA_API_KEY;
  if (!key) throw new Error("SYNTHESIA_API_KEY Worker secret is not set. Add it via Cloudflare dashboard → Settings → Variables.");
  const res = await fetch(SYNTHESIA_BASE + path, {
    ...options,
    headers: { "Authorization": key, "Content-Type": "application/json", ...(options.headers || {}) },
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  return { ok: res.ok, status: res.status, data };
}

async function handleSynthesiaSubmit(request, env) {
  let body;
  try { body = await request.json(); } catch { return errorResponse("Invalid JSON body", 400); }
  const { title, script, avatarId, voiceId, background, test } = body;
  if (!script || !title) return errorResponse("Missing required fields: title, script", 400);
  const payload = {
    test: test === true,
    title,
    description: "Netstar Australia — Fleet AI Training Series",
    visibility: "private",
    aspectRatio: "16:9",
    scenes: [{
      avatar: { avatarId: avatarId || "anna_costume1_cameraA", position: "right" },
      background: background && background !== "white"
        ? { type: "color", color: background }
        : { type: "image", url: "https://www.synthesia.io/backgrounds/white.png" },
      content: {
        type: "audio",
        ssml: `<speak>${script.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</speak>`,
        voiceId: voiceId || "en-AU-NatashaNeural",
      },
    }],
  };
  const { ok, status, data } = await synthesiaFetch(env, "/videos", { method: "POST", body: JSON.stringify(payload) });
  if (ok && data.id) return corsResponse(JSON.stringify({ submitted: true, video_id: data.id, title: data.title, status: data.status }));
  return corsResponse(JSON.stringify({ submitted: false, synthesia_status: status, error: data.message || data.error || JSON.stringify(data) }), ok ? 200 : status);
}

async function handleSynthesiaStatus(videoId, env) {
  const { ok, status, data } = await synthesiaFetch(env, `/videos/${videoId}`);
  if (!ok) return corsResponse(JSON.stringify({ error: data.message || "Not found", synthesia_status: status }), status);
  return corsResponse(JSON.stringify({ video_id: data.id, title: data.title, status: data.status, duration: data.duration || null, download_url: data.download || data.downloadUrl || null, created_at: data.createdAt || null, updated_at: data.lastUpdatedAt || null }));
}

async function handleSynthesiaList(url, env) {
  const limit = url.searchParams.get("limit") || "20";
  const { ok, status, data } = await synthesiaFetch(env, `/videos?limit=${limit}`);
  if (!ok) return corsResponse(JSON.stringify({ error: data.message || "Failed", synthesia_status: status }), status);
  const videos = Array.isArray(data.videos) ? data.videos : Array.isArray(data) ? data : [];
  return corsResponse(JSON.stringify({ total: videos.length, videos: videos.map(v => ({ video_id: v.id, title: v.title, status: v.status, duration: v.duration || null, download_url: v.download || v.downloadUrl || null, created_at: v.createdAt || null })) }));
}

async function handleSynthesiaAvatars(env) {
  const { ok, status, data } = await synthesiaFetch(env, "/avatars");
  if (!ok) return corsResponse(JSON.stringify({ error: data.message || "Failed", synthesia_status: status }), status);
  const avatars = Array.isArray(data.avatars) ? data.avatars : Array.isArray(data) ? data : [];
  return corsResponse(JSON.stringify({ connected: true, total: avatars.length, avatars: avatars.slice(0, 20).map(a => ({ id: a.id || a.avatarId, name: a.name || a.displayName || a.id })) }));
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TEAM TRACKER — KV-backed task logging
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function handleTrackerPage(request, env) {
  if (!env.TRACKER_KV) {
    return new Response("TRACKER_KV binding not configured. Add it to wrangler.toml and redeploy.", {
      status: 503, headers: { "Content-Type": "text/plain" },
    });
  }
  const html = await env.TRACKER_KV.get("tracker-html");
  if (!html) {
    return new Response("Tracker page not uploaded yet. Run: wrangler kv key put --binding=TRACKER_KV \"tracker-html\" --path=tracker.html", {
      status: 503, headers: { "Content-Type": "text/plain" },
    });
  }
  return new Response(html, { headers: { "Content-Type": "text/html;charset=UTF-8" } });
}

async function handleGetTasks(request, env) {
  if (!env.TRACKER_KV) return corsResponse(JSON.stringify([]), 200);
  const url = new URL(request.url);
  const date = url.searchParams.get("date");
  const member = url.searchParams.get("member");
  const list = await env.TRACKER_KV.list({ prefix: "task:" });
  const tasks = [];
  await Promise.all(
    list.keys.map(async ({ name }) => {
      const raw = await env.TRACKER_KV.get(name);
      if (raw) {
        try {
          const task = JSON.parse(raw);
          if (date && task.date !== date) return;
          if (member && task.member !== member) return;
          tasks.push(task);
        } catch (_) {}
      }
    })
  );
  tasks.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  return corsResponse(JSON.stringify(tasks));
}

async function handlePostTask(request, env) {
  if (!env.TRACKER_KV) return corsResponse(JSON.stringify({ error: "TRACKER_KV not configured" }), 503);
  let body;
  try { body = await request.json(); } catch (_) { return corsResponse(JSON.stringify({ error: "Invalid JSON" }), 400); }
  const { member, date, task, cat, hours, status, impact, notes } = body;
  if (!member || !date || !task || !cat || !hours) {
    return corsResponse(JSON.stringify({ error: "Missing required fields: member, date, task, cat, hours" }), 400);
  }
  const id = `task:${date}:${Date.now()}:${Math.random().toString(36).slice(2, 7)}`;
  const record = {
    id, member, date, task, cat,
    hours: parseFloat(hours),
    status: status || "in-progress",
    impact: impact || "medium",
    notes: notes || "",
    createdAt: new Date().toISOString(),
  };
  await env.TRACKER_KV.put(id, JSON.stringify(record), { expirationTtl: 60 * 60 * 24 * 90 });
  return corsResponse(JSON.stringify({ success: true, id, record }), 201);
}

async function handleDeleteTask(request, env) {
  if (!env.TRACKER_KV) return corsResponse(JSON.stringify({ error: "TRACKER_KV not configured" }), 503);
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return corsResponse(JSON.stringify({ error: "Missing id param" }), 400);
  await env.TRACKER_KV.delete(id);
  return corsResponse(JSON.stringify({ success: true }));
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HELPERS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-key",
};

function corsResponse(body, status = 200) {
  return new Response(body, { status, headers: { "Content-Type": "application/json", ...CORS } });
}
function errorResponse(msg, status = 500) {
  return corsResponse(JSON.stringify({ error: msg }), status);
}

async function ubiGET(path, env, key) {
  const res = await fetch(UBI_BASE + path, { method: "GET", headers: { "x-api-key": key || getKey(env), "Accept": "application/json" } });
  const text = await res.text();
  if (!res.ok) throw new Error("UBI " + res.status + ": " + text.slice(0, 200));
  return JSON.parse(text);
}

async function netstarGET(path, env, key) {
  const res = await fetch(NETSTAR_BASE + path, { method: "GET", headers: { "x-api-key": key || getKey(env), "Accept": "application/json" } });
  const text = await res.text();
  if (!res.ok) throw new Error("FleetAI " + res.status + ": " + text.slice(0, 200));
  return JSON.parse(text);
}

async function getVehicleList(env, key, companyName) {
  let list = [];
  let branches = [];
  try {
    const res = await fetch(NETSTAR_BASE + "/external/company-vehicles", {
      method: "POST",
      headers: { "x-api-key": key || getKey(env), "Content-Type": "application/json", "Accept": "*/*" },
      body: JSON.stringify({ company_name: companyName || "", company_names: companyName ? [companyName] : [] }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.data?.branch && Array.isArray(data.data.branch)) {
        for (const branch of data.data.branch) {
          if (branch.branch_name) branches.push(branch.branch_name);
          if (Array.isArray(branch.vehicles)) {
            for (const v of branch.vehicles) list.push({ ...v, _branch: branch.branch_name });
          }
        }
      } else {
        const flat = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : Array.isArray(data?.vehicles) ? data.vehicles : Array.isArray(data?.result) ? data.result : [];
        list = flat;
      }
    }
  } catch(e) {}
  if (list.length === 0) {
    try { const data = await ubiGET("/vehicle/vehicles", env, key); list = Array.isArray(data) ? data : (data.data || []); } catch(e) {}
  }
  const mapped = mapVehicles(list);
  mapped._branches = branches;
  return mapped;
}

const DISPOSED_PATTERN = /dispose|disposal|disposed|spare|workshop|not working|breakdown|decommission/i;

function mapVehicles(list) {
  return list.filter(v => v && !v._debug).map(v => {
    const imei = String(v.imei_no || v.Imei || v.imei || v.IMEI || v.device_id || "");
    const vehicleNo = v.vehicle_no || v.device_name || "";
    const regMatch = vehicleNo.match(/^([A-Z0-9]+)/);
    const registration = v.Registration || v.registration || v.PlateNumber || v.plate_number || (regMatch ? regMatch[1] : vehicleNo) || imei;
    const driverFromVehicleNo = vehicleNo.includes(" ") ? vehicleNo.replace(/^\S+\s+/, "") : "";
    const driverRaw = v.DriverName || v.driver_name || v.Driver || v.driver || driverFromVehicleNo || "";
    const isDisposed = DISPOSED_PATTERN.test(driverRaw) || DISPOSED_PATTERN.test(registration);
    return { imei, id: imei, registration, make: v.Make || v.make || v.Brand || v.brand || v.device_model || "—", model: v.Model || v.model || "—", year: v.Year || v.year || null, driver_name: isDisposed ? "— Disposed / Spare" : (driverRaw || "—"), gvm_kg: parseFloat(v.GvmKg || v.gvm_kg || v.Gvm || v.gvm || 0) || 0, fuel_type: (v.FuelType || v.fuel_type || "diesel").toLowerCase(), branch: v._branch || "", _disposed: isDisposed };
  }).filter(v => !v._disposed);
}

function toFleetAIDate(isoDate, endOfDay = false) {
  const [y, m, d] = isoDate.split("-");
  return `${d}-${m}-${y} ${endOfDay ? "23:59:59" : "00:00:01"}`;
}

async function getDriverPerf(dateFrom, dateTo, env, key, companyName, branches) {
  const q = new URLSearchParams({ company_names: companyName || COMPANY, start_date_time: toFleetAIDate(dateFrom, false), end_date_time: toFleetAIDate(dateTo, true) });
  const locationNames = (branches && branches.length > 0) ? branches : [LOCATION];
  const results = await Promise.allSettled(locationNames.map(async loc => {
    const qWithLoc = new URLSearchParams(q);
    qWithLoc.set("location_names", loc);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25000);
    try {
      const res = await fetch(NETSTAR_BASE + "/external/drivers/driver-performance-summary?" + qWithLoc.toString(), { headers: { "x-api-key": key, "Accept": "application/json" }, signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
    } catch(e) { clearTimeout(timer); return []; }
  }));
  const allRows = results.flatMap(r => r.status === "fulfilled" ? r.value : []);
  const byDriver = {};
  for (const r of allRows) {
    const raw = r.driver_name || r.DriverName || "";
    const clean = raw.replace(/^\d+\s+/, "").trim();
    const dKey = raw.toLowerCase();
    if (!dKey) continue;
    const km = parseFloat(r.total_running_km || 0);
    if (!byDriver[dKey] || km > parseFloat(byDriver[dKey].total_running_km || 0)) byDriver[dKey] = { ...r, driver_name: clean, _raw_driver_name: raw };
  }
  return Object.values(byDriver);
}

async function getObjectStatus(imei, env, key) {
  const data = await netstarGET("/external/reports/object-status?imei=" + imei, env);
  const list = Array.isArray(data) ? data : (data.data || []);
  return list.length > 0 ? list[0] : null;
}

async function ftcSummary(dateFrom, dateTo, env, key, clientMeta) {
  try {
    const companyName = clientMeta?.company || COMPANY;
    const vehicles = await getVehicleList(env, key, companyName);
    const branches = vehicles._branches || [];
    let driverPerf = [];
    try { driverPerf = await getDriverPerf(dateFrom, dateTo, env, key, companyName, branches); } catch(e) {}
    const enriched = vehicles.map(v => {
      const vReg = String(v.registration || "").trim().toLowerCase();
      const perf = driverPerf.find(d => {
        const rawDriver = String(d._raw_driver_name || d.driver_name || "").trim();
        if (vReg && rawDriver.toLowerCase().startsWith(vReg)) return true;
        const perfDriver = String(d.driver_name || "").toLowerCase().trim();
        const vehDriver = String(v.driver_name || "").toLowerCase().trim();
        if (perfDriver && vehDriver && perfDriver.length > 2 && perfDriver === vehDriver) return true;
        return false;
      });
      const roadKm = parseFloat(perf?.total_running_km || 0);
      const offroadKm = parseFloat(perf?.OffRoadKm || perf?.off_road_km || 0);
      const fuelLitres = roadKm + offroadKm > 0 ? +((roadKm + offroadKm) * 11 / 100).toFixed(1) : 0;
      return { vehicle_id: v.id, registration: v.registration, make: v.make, model: v.model, year: v.year, gvm_kg: v.gvm_kg, fuel_type: v.fuel_type, driver: perf?.driver_name || v.driver_name, branch: perf?.branch_name || v.branch || "Not Assigned", odometer_start: 0, odometer_end: 0, fuel_litres: fuelLitres, road_km: roadKm, offroad_km: offroadKm, trips: 0, fuel_estimated: fuelLitres > 0, period: new Date(dateFrom).toLocaleDateString("en-AU", { month: "short", year: "numeric" }), source: "fleetai", _perf: perf, _status: null };
    });
    return corsResponse(JSON.stringify({ source_endpoint: NETSTAR_BASE + "/external/company-vehicles", date_from: dateFrom, date_to: dateTo, driver_perf_count: driverPerf.length, driver_perf_names: driverPerf.map(d => d.driver_name || d.DriverName || "?"), vehicles: enriched }), 200);
  } catch (e) { return errorResponse("FTC summary failed: " + e.message, 502); }
}

async function probe(dateFrom, dateTo, env) {
  const key = getKey(env);
  const from = dateFrom || "2025-04-01";
  const to = dateTo || "2025-04-07";
  const xApiHeaders = { "x-api-key": key, "Accept": "application/json" };
  const bearerHeaders = { "Authorization": "Bearer " + key, "Accept": "application/json" };
  const candidates = [
    { url: UBI_BASE + "/vehicle/vehicles", headers: xApiHeaders },
    { url: UBI_BASE + "/vehicle/vehicles", headers: bearerHeaders },
    { url: UBI_BASE + "/driver/drivers", headers: xApiHeaders },
    { url: NETSTAR_BASE + "/external/drivers/driver-performance-summary?company_names=" + COMPANY + "&start_date_time=" + toFleetAIDate(from, false) + "&end_date_time=" + toFleetAIDate(to, true), headers: xApiHeaders },
    { url: NETSTAR_BASE + "/external/reports/object-status?imei=all", headers: xApiHeaders },
    { url: NETSTAR_BASE + "/external/reports/object-status", headers: xApiHeaders },
    { url: UBI_BASE + "/vehicles", headers: xApiHeaders },
    { url: UBI_BASE + "/api/vehicles", headers: xApiHeaders },
    { url: NETSTAR_BASE + "/external/vehicles", headers: xApiHeaders },
  ];
  const results = await Promise.allSettled(candidates.map(async ({ url, headers }) => {
    const res = await fetch(url, { headers });
    let preview = "";
    try { preview = (await res.text()).slice(0, 300); } catch {}
    return { url, auth: headers["x-api-key"] ? "x-api-key" : "bearer", status: res.status, ok: res.ok, preview };
  }));
  const report = results.map((r, i) => r.status === "fulfilled" ? r.value : { ...candidates[i], status: "error", ok: false, preview: r.reason?.message });
  return corsResponse(JSON.stringify({ key_preview: key.slice(0,4) + "***" + key.slice(-4), summary: { accessible: report.filter(r => r.ok).length, denied: report.filter(r => r.status === 401 || r.status === 403).length }, accessible: report.filter(r => r.ok), denied: report.filter(r => r.status === 401 || r.status === 403), other: report.filter(r => !r.ok && r.status !== 401 && r.status !== 403) }, null, 2));
}

const CUSTOMER_CREDENTIALS = {
  "lakemacquarie": { username: "lmcc",             password: "Netstar2026!" },
  "michael":       { username: "michael.emmanuel", password: "NetstarSales1!" },
  "shaun":         { username: "shaun.brashaw",    password: "NetstarAdmin1!" },
};

const SESSION_SECRET = "ns-ftc-2026-x9k";

function makeToken(clientId, username) { return btoa(clientId + ":" + username + ":" + Date.now() + ":" + SESSION_SECRET); }

function verifyToken(token, clientId) {
  try {
    const d = atob(token).split(":");
    if (d[d.length-1] !== SESSION_SECRET) return false;
    if (d[0] !== clientId) return false;
    return (Date.now() - parseInt(d[d.length-2])) < 8*60*60*1000;
  } catch(e) { return false; }
}

function getSessionCookie(request) {
  const m = (request.headers.get("Cookie") || "").match(/ftc_session=([^;]+)/);
  return m ? m[1] : null;
}

function isAuthenticated(request, clientId) {
  const creds = CUSTOMER_CREDENTIALS[clientId];
  if (!creds) return true;
  const token = getSessionCookie(request);
  return token ? verifyToken(token, clientId) : false;
}

function loginPage(clientId, error) {
  const meta = CUSTOMER_META[clientId] || { company: "Netstar" };
  return new Response(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"><title>${meta.company} FTC Portal</title><style>*{box-sizing:border-box;margin:0;padding:0}body{background:#060c14;color:#e8f4ff;font-family:Arial,sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}.card{background:#0c1622;border:1px solid #1e2e40;border-radius:12px;padding:40px;width:100%;max-width:380px}.logo{font-size:12px;font-weight:700;color:#3d9be8;letter-spacing:2px;text-transform:uppercase;margin-bottom:8px}h1{font-size:22px;font-weight:700;margin-bottom:4px}.sub{font-size:13px;color:#7899bb;margin-bottom:32px}label{display:block;font-size:11px;color:#7899bb;letter-spacing:1px;text-transform:uppercase;margin-bottom:6px}input{width:100%;background:#0d1822;border:1px solid #1e2e40;border-radius:8px;padding:12px 14px;color:#e8f4ff;font-size:15px;margin-bottom:20px;outline:none}input:focus{border-color:#3d9be8}button{width:100%;background:#1b4f8c;border:none;border-radius:8px;padding:14px;color:#fff;font-size:15px;font-weight:600;cursor:pointer}.err{background:#1a0808;border:1px solid #7a1e1e;border-radius:8px;padding:10px 14px;font-size:13px;color:#f08080;margin-bottom:20px}.footer{font-size:11px;color:#3d5a7a;text-align:center;margin-top:24px}</style></head><body><div class="card"><div class="logo">Netstar Australia</div><h1>FTC Portal</h1><div class="sub">${meta.company}</div>${error ? `<div class="err">${error}</div>` : ""}<form method="POST" action="/ftc-login"><input type="hidden" name="client" value="${clientId}"><label>Username</label><input type="text" name="username" autocomplete="username" autocapitalize="none" autofocus><label>Password</label><input type="password" name="password" autocomplete="current-password"><button type="submit">Sign in &rarr;</button></form><div class="footer">Secured by Netstar Australia &copy; 2026</div></div></body></html>`,
    { status: 200, headers: { "Content-Type": "text/html;charset=UTF-8" } });
}

async function handleLogin(request) {
  const body = await request.text();
  const params = new URLSearchParams(body);
  const clientId = params.get("client") || "demo";
  const username = (params.get("username") || "").trim();
  const password = params.get("password") || "";
  const creds = CUSTOMER_CREDENTIALS[clientId];
  if (!creds || username !== creds.username || password !== creds.password) return loginPage(clientId, "Incorrect username or password.");
  const token = makeToken(clientId, username);
  return new Response("", { status: 302, headers: { "Location": `/ftc?client=${clientId}`, "Set-Cookie": `ftc_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=28800` } });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MAIN ROUTER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const clientId = (url.searchParams.get("client") || "demo").toLowerCase().trim();
    const clientMeta = getClientMeta(clientId);
    const apiKey = getKey(env, clientId);

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

    // ── Azure AD SSO ─────────────────────────────────────────────────────────
    if (path === "/auth/login") {
      const redirectUri = `${url.origin}/auth/callback`;
      const authUrl = azureAuthUrl(env, clientId, AZURE_TENANTS[clientId], redirectUri, clientId);
      const meta = getClientMeta(clientId);
      return azureLoginRedirectPage(authUrl, clientId, meta.company);
    }
    if (path === "/auth/callback") return handleAzureCallback(request, env);
    if (path === "/auth/logout") {
      const tenant = AZURE_TENANTS[clientId] || env.AZURE_TENANT_ID || "common";
      const postLogoutUrl = encodeURIComponent(`${url.origin}/?client=${clientId}`);
      return new Response("", { status: 302, headers: { Location: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/logout?post_logout_redirect_uri=${postLogoutUrl}`, "Set-Cookie": "ftc_azure_session=; Path=/; HttpOnly; Max-Age=0" } });
    }

    // ── CAD webhook routes ───────────────────────────────────────────────────
    if (path === "/duress-alert" && request.method === "POST") return handleDuressAlert(request, env);
    if (path === "/duress-events") return handleDuressEvents(url);
    if (path === "/cad-status") return handleCADStatus(env);

    // ── Synthesia video generation routes ────────────────────────────────────
    if (path === "/synthesia/submit" && request.method === "POST") return handleSynthesiaSubmit(request, env);
    if (path.startsWith("/synthesia/status/")) {
      const videoId = path.replace("/synthesia/status/", "");
      if (!videoId) return errorResponse("Missing video ID", 400);
      return handleSynthesiaStatus(videoId, env);
    }
    if (path === "/synthesia/list") return handleSynthesiaList(url, env);
    if (path === "/synthesia/avatars") return handleSynthesiaAvatars(env);

    // ── Team tracker routes ──────────────────────────────────────────────────
    if (path === "/team-tracker") return handleTrackerPage(request, env);
    if (path === "/tracker/tasks" && request.method === "GET")    return handleGetTasks(request, env);
    if (path === "/tracker/tasks" && request.method === "POST")   return handlePostTask(request, env);
    if (path === "/tracker/tasks" && request.method === "DELETE") return handleDeleteTask(request, env);

    // ── Legacy auth ──────────────────────────────────────────────────────────
    if (path === "/ftc-login" && request.method === "POST") return handleLogin(request);
    if (clientId !== "demo" && (path === "/ftc" || path === "/" || path === "/roi")) {
      const azureOk = isAzureAuthenticated(request, clientId, env.SESSION_SECRET || SESSION_SECRET);
      const legacyOk = isAuthenticated(request, clientId);
      if (!azureOk && !legacyOk) {
        if (env.AZURE_CLIENT_ID && AZURE_TENANTS[clientId]) {
          const redirectUri = `${url.origin}/auth/callback`;
          const authUrl = azureAuthUrl(env, clientId, AZURE_TENANTS[clientId], redirectUri, clientId);
          const meta = getClientMeta(clientId);
          return azureLoginRedirectPage(authUrl, clientId, meta.company);
        }
        return loginPage(clientId, "");
      }
    }

    // ── Health & static routes ───────────────────────────────────────────────
    if (path === "/health") return corsResponse(JSON.stringify({ status: "ok", worker: "netstar-proxy", timestamp: new Date().toISOString(), key_preview: getKey(env).slice(0,4) + "***" }));

    if (path === "/roi" || path === "/roi.html") {
      try { const res = await fetch("https://raw.githubusercontent.com/bs5jssxhm2-blip/Netstar-proxy/main/roi.html"); const html = await res.text(); return new Response(html, { headers: { "Content-Type": "text/html;charset=UTF-8", ...CORS } }); }
      catch(e) { return new Response("Failed to fetch roi.html: " + e.message, { status: 502 }); }
    }

    if (path === "/driver" || path === "/driver.html") {
      try { const res = await fetch("https://raw.githubusercontent.com/bs5jssxhm2-blip/Netstar-proxy/main/driver.html"); const html = await res.text(); return new Response(html, { headers: { "Content-Type": "text/html;charset=UTF-8", ...CORS } }); }
      catch(e) { return new Response("Failed to fetch driver.html: " + e.message, { status: 502 }); }
    }

    if (path === "/fleet-scores" || path === "/driver-score") {
      try {
        const annualKm = parseInt(url.searchParams.get("annual_km") || "15000");
        let dateFrom = url.searchParams.get("date_from") || url.searchParams.get("start_date") || (() => { const d = new Date(); d.setDate(d.getDate()-7); return d.toISOString().slice(0,10); })();
        const dateTo = url.searchParams.get("date_to") || url.searchParams.get("end_date") || (() => { const d = new Date(); d.setDate(d.getDate()-1); return d.toISOString().slice(0,10); })();
        const imeiFilter = url.searchParams.get("imei") || "";
        const driverFilter = (url.searchParams.get("driver") || url.searchParams.get("driver_name") || "").toLowerCase();
        let vlist = await getVehicleList(env, apiKey, clientMeta.company);
        const osMap = {};
        await Promise.all(vlist.map(async v => { try { const os = await getObjectStatus(v.imei, env, apiKey); if (os) osMap[v.imei] = os; } catch(e) {} }));
        vlist = vlist.map(v => Object.assign({}, v, { driver_name: osMap[v.imei]?.driver || v.driver_name || "Unknown", _matched: false }));
        let resolvedDriverFilter = driverFilter;
        if (path === "/driver-score" && imeiFilter) { const os = osMap[imeiFilter]; if (os?.driver) resolvedDriverFilter = os.driver.toLowerCase(); }
        const maxDays = 60;
        const requestedDays = Math.round((new Date(dateTo) - new Date(dateFrom)) / 86400000);
        if (requestedDays > maxDays) dateFrom = new Date(new Date(dateTo) - maxDays * 86400000).toISOString().slice(0, 10);
        let list = await getDriverPerf(dateFrom, dateTo, env, apiKey, clientMeta.company, vlist._branches || []);
        if (!list.length) { for (const days of [30, 14, 7]) { const fb = new Date(new Date(dateTo) - days * 86400000).toISOString().slice(0, 10); list = await getDriverPerf(fb, dateTo, env, apiKey, clientMeta.company, vlist._branches || []); if (list.length) { dateFrom = fb; break; } } }
        if (!list.length) throw new Error("No driver data for this period. Try a date range within the last 30 days.");
        const scored = await Promise.all(list.map(async r => {
          const driverName = r.driver_name || r.driver || "Unknown";
          if (resolvedDriverFilter && resolvedDriverFilter !== driverName.toLowerCase()) return null;
          let mv = null;
          for (let i = 0; i < vlist.length; i++) { if ((vlist[i].driver_name || "").toLowerCase() === driverName.toLowerCase() && !vlist[i]._matched) { mv = vlist[i]; vlist[i]._matched = true; break; } }
          if (!mv) { for (let j = 0; j < vlist.length; j++) { if (!vlist[j]._matched) { mv = vlist[j]; vlist[j]._matched = true; break; } } }
          const imei = mv ? mv.imei : "";
          const os = osMap[imei] || {};
          const maxSpd = parseInt(r.max_speed || 0);
          const speedPenalty = maxSpd > 130 ? 20 : maxSpd > 110 ? 10 : maxSpd > 100 ? 5 : 0;
          const harshBrake = parseInt(r.harsh_breaking || 0);
          const harshAccel = parseInt(r.harsh_acceleration || 0);
          const harshCorn = parseInt(r.harsh_cornering || 0);
          const avgSpd = parseInt(r.avg_speed || 0);
          const avgSpdPenalty = avgSpd > 80 ? 15 : avgSpd > 70 ? 10 : avgSpd > 60 ? 5 : 0;
          const eventScore = (harshBrake * 3) + (harshAccel * 3) + (harshCorn * 2);
          const rawScore = Math.min(100, eventScore + speedPenalty + avgSpdPenalty);
          const riskScore = isNaN(rawScore) ? 50 : Math.round(Math.min(Math.max(rawScore, 0), 100) * 10) / 10;
          const km = parseFloat(r.total_running_km || 0);
          const lc = isNaN(riskScore) ? 0 : Math.round(1200 * (Math.exp(riskScore / 35) - 0.9) * Math.sqrt((km || annualKm) / 15000));
          const rb = riskScore < 20 ? "Excellent" : riskScore < 40 ? "Good" : riskScore < 60 ? "Moderate" : riskScore < 80 ? "High" : "Very High";
          return { imei, driver_name: driverName, registration: mv?.registration || "", make: mv?.make || "", model: mv?.model || "", speed: os.speed || "0", location: os.location || "", status: os.status_hidden || "Unknown", risk_score: riskScore, loss_cost: lc, risk_band: rb, predicted_loss_cost: lc, total_distance_km: km, km_driven: km, total_running_km: km, avg_speed: avgSpd, max_speed: maxSpd, total_running_duration: r.total_running_duration || "0:00", running_time: r.total_running_duration || "0:00", location_address: os.location || "", ignition: os.ignition_status || "Off", speed_live: os.speed || "0", period_from: dateFrom, period_to: dateTo, harsh_breaking: harshBrake, harsh_acceleration: harshAccel, harsh_cornering: harshCorn, non_stop_drive: parseInt(r.non_stop_drive || 0), night_drive: parseInt(r.night_drive || 0), over_speed: parseInt(r.over_speed || 0), idling: parseInt(r.idling || 0), features: { harsh_breaking: harshBrake, harsh_acceleration: harshAccel, harsh_cornering: harshCorn, max_speed: maxSpd, avg_speed: avgSpd, over_speed: parseInt(r.over_speed||0), night_drive: parseInt(r.night_drive||0), idling: parseInt(r.idling||0) } };
        }));
        const results = scored.filter(Boolean);
        if (path === "/driver-score") return corsResponse(JSON.stringify(results[0] || {}));
        return corsResponse(JSON.stringify({ vehicles: results, total: results.length, date_from: dateFrom, date_to: dateTo }));
      } catch(e) { return errorResponse(e.message, 502); }
    }

    if (path === "/live-status") {
      try {
        const vlist = await getVehicleList(env, apiKey, clientMeta.company);
        const statuses = await Promise.all(vlist.map(async v => { try { const os = await getObjectStatus(v.imei, env, apiKey); return Object.assign({}, v, { driver_name: os?.driver || v.driver_name || "Unknown", speed: os?.speed || "0", location: os?.location || "", status: os?.status_hidden || "Unknown", coordinates: os?.coordinates || "" }); } catch(e) { return v; } }));
        return corsResponse(JSON.stringify({ vehicles: statuses, total: statuses.length, updated: new Date().toISOString() }));
      } catch(e) { return errorResponse(e.message, 502); }
    }

    if (path === "/fleetai/branch-perf") {
      const ck = url.searchParams.get("client") || "demo";
      const cm = getClientMeta(ck);
      const ak = getKey(env, ck);
      const from = url.searchParams.get("date_from");
      const to   = url.searchParams.get("date_to");
      const loc  = url.searchParams.get("location");
      if (!from || !to || !loc) return errorResponse("Missing date_from, date_to or location", 400);
      const q = new URLSearchParams({ company_names: cm.company, location_names: loc, start_date_time: toFleetAIDate(from, false), end_date_time: toFleetAIDate(to, true) });
      try {
        const fullUrl = NETSTAR_BASE + "/external/drivers/driver-performance-summary?" + q.toString();
        const res = await fetch(fullUrl, { headers: { "x-api-key": ak, "Accept": "application/json" } });
        const text = await res.text();
        let rows = [];
        try { const data = JSON.parse(text); rows = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : Array.isArray(data?.data?.drivers) ? data.data.drivers : []; } catch(pe) { rows = []; }
        return corsResponse(JSON.stringify({ location: loc, count: rows.length, data: rows, _status: res.status, _raw: text.slice(0, 100) }));
      } catch(e) { return corsResponse(JSON.stringify({ location: loc, count: 0, data: [], error: e.message })); }
    }

    if (path === "/fleetai/match-debug") {
      const ck = url.searchParams.get("client") || "demo";
      const cm = getClientMeta(ck);
      const ak = getKey(env, ck);
      const from = url.searchParams.get("date_from") || "2026-04-24";
      const to   = url.searchParams.get("date_to")   || "2026-04-30";
      try {
        const vehicles = await getVehicleList(env, ak, cm.company);
        const branches = vehicles._branches || [];
        const driverPerf = await getDriverPerf(from, to, env, ak, cm.company, branches);
        const matched = [], unmatched = [];
        for (const v of vehicles.slice(0, 30)) {
          const vReg = String(v.registration || "").trim().toLowerCase();
          const perf = driverPerf.find(d => { const raw = String(d._raw_driver_name || d.driver_name || "").trim(); if (vReg && raw.toLowerCase().startsWith(vReg)) return true; const perfDriver = String(d.driver_name || "").toLowerCase().trim(); const vehDriver = String(v.driver_name || "").toLowerCase().trim(); return perfDriver && vehDriver && perfDriver.length > 2 && perfDriver === vehDriver; });
          if (perf) matched.push({ reg: v.registration, driver: v.driver_name, perf_name: perf._raw_driver_name, km: perf.total_running_km });
          else unmatched.push({ reg: v.registration, driver: v.driver_name });
        }
        return corsResponse(JSON.stringify({ vehicles_total: vehicles.length, branches: branches.length, branch_names: branches, driver_perf_count: driverPerf.length, driver_perf_sample: driverPerf.slice(0,5).map(d=>({ raw: d._raw_driver_name, clean: d.driver_name, km: d.total_running_km })), vehicle_sample: vehicles.slice(0,5).map(v=>({ reg: v.registration, driver: v.driver_name })), matched_sample: matched.slice(0,10), unmatched_sample: unmatched.slice(0,10) }));
      } catch(e) { return corsResponse(JSON.stringify({ error: e.message })); }
    }

    if (path === "/fleetai/perf-probe") {
      const ck = url.searchParams.get("client") || "demo";
      const cm = getClientMeta(ck);
      const ak = getKey(env, ck);
      const from = url.searchParams.get("date_from") || "2026-04-28";
      const to = url.searchParams.get("date_to") || "2026-04-29";
      const loc = url.searchParams.get("location") || "CW - CBS - Building Services";
      const q = new URLSearchParams({ company_names: cm.company, location_names: loc, start_date_time: toFleetAIDate(from, false), end_date_time: toFleetAIDate(to, true) });
      try {
        const res = await fetch(NETSTAR_BASE + "/external/drivers/driver-performance-summary?" + q.toString(), { headers: { "x-api-key": ak, "Accept": "application/json" } });
        const text = await res.text();
        return corsResponse(JSON.stringify({ status: res.status, query: q.toString(), response: text.slice(0, 2000) }));
      } catch(e) { return corsResponse(JSON.stringify({ error: e.message })); }
    }

    if (path === "/fleetai/vehicles-probe") {
      const ck = url.searchParams.get("client") || "demo";
      const cm = getClientMeta(ck);
      const ak = getKey(env, ck);
      const body = { company_name: cm.company, company_names: [cm.company] };
      const res = await fetch(NETSTAR_BASE + "/external/company-vehicles", { method: "POST", headers: { "x-api-key": ak, "Content-Type": "application/json", "Accept": "*/*" }, body: JSON.stringify(body) });
      const data = await res.json();
      return corsResponse(JSON.stringify({ status: res.status, body_sent: body, data }));
    }

    if (path === "/fleetai/probe") return probe(url.searchParams.get("date_from"), url.searchParams.get("date_to"), env);

    if (path === "/fleetai/ftc-summary") {
      const dateFrom = url.searchParams.get("date_from") || url.searchParams.get("from");
      const dateTo = url.searchParams.get("date_to") || url.searchParams.get("to");
      if (!dateFrom || !dateTo) return errorResponse("Missing date_from and date_to (YYYY-MM-DD)", 400);
      return ftcSummary(dateFrom, dateTo, env, apiKey, clientMeta);
    }

    if (path === "/fleetai/vehicles") {
      try { const vehicles = await getVehicleList(env, apiKey, clientMeta.company); return corsResponse(JSON.stringify({ vehicles, total: vehicles.length })); }
      catch(e) { return errorResponse(e.message, 502); }
    }

    if (path === "/fleetai/trips") {
      const dateFrom = url.searchParams.get("date_from");
      const dateTo = url.searchParams.get("date_to");
      if (!dateFrom || !dateTo) return errorResponse("Missing date_from / date_to", 400);
      try { const data = await getDriverPerf(dateFrom, dateTo, env, apiKey, clientMeta.company); return corsResponse(JSON.stringify(data)); }
      catch(e) { return errorResponse(e.message, 502); }
    }

    if (path === "/" || path === "/index.html") {
      const rawUrl = env.GITHUB_RAW_URL || "https://raw.githubusercontent.com/bs5jssxhm2-blip/Netstar-proxy/main/index.html";
      try { const res = await fetch(rawUrl); const html = await res.text(); return new Response(html, { headers: { "Content-Type": "text/html;charset=UTF-8", ...CORS } }); }
      catch(e) { return new Response("Failed to fetch: " + e.message, { status: 502 }); }
    }

    if (path === "/ftc" || path === "/ftc.html") return new Response(FTC_HTML, { headers: { "Content-Type": "text/html;charset=UTF-8", ...CORS } });

    if (path === "/ai-analysis" && request.method === "POST") {
      try {
        const { prompt } = await request.json();
        if (!prompt) return errorResponse("Missing prompt", 400);
        const res = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "Content-Type": "application/json", "x-api-key": env.ANTHROPIC_API_KEY || "", "anthropic-version": "2023-06-01" }, body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 800, messages: [{ role: "user", content: prompt }] }) });
        const data = await res.json();
        if (!res.ok) return errorResponse(data.error?.message || "Anthropic API error", res.status);
        const text = data.content?.filter(b => b.type === "text").map(b => b.text).join("") || "";
        return corsResponse(JSON.stringify({ text }));
      } catch(e) { return errorResponse(e.message, 500); }
    }

    return errorResponse("Unknown route: " + path, 404);
  },
};
