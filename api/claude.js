export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "ANTHROPIC_API_KEY not configured" });

  try {
    const { messages, system, useNS } = req.body;
    const body = { model: "claude-sonnet-4-20250514", max_tokens: 1000, messages };
    if (system) body.system = system;
    if (useNS) {
      body.mcp_servers = [{
        type: "url",
        url: "https://863338.suitetalk.api.netsuite.com/services/mcp/v1/all",
        name: "netstar-netsuite"
      }];
    }
    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        ...(useNS ? { "anthropic-beta": "mcp-client-2025-04-04" } : {}),
      },
      body: JSON.stringify(body),
    });
    const data = await upstream.json();
    return res.status(upstream.status).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
