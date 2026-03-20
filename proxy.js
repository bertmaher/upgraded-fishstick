#!/usr/bin/env node
/**
 * AI Text Reader — optional proxy server
 *
 * Lets you deploy the app without requiring users to supply an Anthropic API key.
 * Set your key as an environment variable and point the static app at this proxy.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-ant-... PORT=3001 node proxy.js
 *
 * Then in a config.js loaded before app.js, set:
 *   window.PROXY_URL = "http://localhost:3001";   // or your deployed URL
 *
 * The proxy only forwards requests to /v1/messages and rejects everything else.
 * It also enforces a CORS allowlist via ALLOWED_ORIGIN (optional).
 *
 * No npm dependencies — uses Node's built-in http and https modules.
 */

"use strict";

const http  = require("http");
const https = require("https");

const API_KEY       = process.env.ANTHROPIC_API_KEY;
const PORT          = parseInt(process.env.PORT || "3001", 10);
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*"; // e.g. "https://example.com"

if (!API_KEY) {
  console.error("Error: ANTHROPIC_API_KEY environment variable is not set.");
  process.exit(1);
}

const UPSTREAM_HOST = "api.anthropic.com";
const UPSTREAM_PATH = "/v1/messages";

function setCorsHeaders(res, origin) {
  const allow = ALLOWED_ORIGIN === "*" ? (origin || "*") : ALLOWED_ORIGIN;
  res.setHeader("Access-Control-Allow-Origin", allow);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "content-type");
}

const server = http.createServer((req, res) => {
  const origin = req.headers["origin"];

  // Handle preflight
  if (req.method === "OPTIONS") {
    setCorsHeaders(res, origin);
    res.writeHead(204);
    res.end();
    return;
  }

  // Only allow POST /v1/messages
  if (req.method !== "POST" || req.url !== "/v1/messages") {
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
    return;
  }

  // Collect request body
  const chunks = [];
  req.on("data", (chunk) => chunks.push(chunk));
  req.on("end", () => {
    const body = Buffer.concat(chunks);

    const options = {
      hostname: UPSTREAM_HOST,
      port: 443,
      path: UPSTREAM_PATH,
      method: "POST",
      headers: {
        "content-type": "application/json",
        "content-length": body.length,
        "x-api-key": API_KEY,
        "anthropic-version": "2023-06-01",
      },
    };

    const upstream = https.request(options, (upRes) => {
      setCorsHeaders(res, origin);
      res.writeHead(upRes.statusCode, { "content-type": "application/json" });
      upRes.pipe(res);
    });

    upstream.on("error", (err) => {
      console.error("Upstream error:", err.message);
      setCorsHeaders(res, origin);
      res.writeHead(502, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: { message: "Bad gateway" } }));
    });

    upstream.write(body);
    upstream.end();
  });
});

server.listen(PORT, () => {
  console.log(`Proxy listening on http://localhost:${PORT}`);
  console.log(`Forwarding /v1/messages → https://${UPSTREAM_HOST}${UPSTREAM_PATH}`);
  console.log(`CORS origin: ${ALLOWED_ORIGIN}`);
});
