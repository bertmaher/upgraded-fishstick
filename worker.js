/**
 * AI Text Reader — Cloudflare Worker proxy
 *
 * Deploy this on Cloudflare Workers (free tier) so users don't need
 * to supply their own Anthropic API key.
 *
 * Setup:
 *  1. Go to workers.cloudflare.com → Create Worker → paste this file
 *  2. Settings → Variables → add a Secret: ANTHROPIC_API_KEY = sk-ant-...
 *  3. Copy your *.workers.dev URL into config.js: window.PROXY_URL = "https://..."
 *
 * Optional: set an ALLOWED_ORIGIN secret (e.g. "https://yourname.github.io")
 * to restrict which sites can call the worker. Leave unset to allow all origins.
 */

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin");
    const allowedOrigin = env.ALLOWED_ORIGIN || "*";
    const corsOrigin = allowedOrigin === "*" ? (origin || "*") : allowedOrigin;

    const corsHeaders = {
      "Access-Control-Allow-Origin": corsOrigin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    // Handle preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // Only allow POST /v1/messages
    const url = new URL(request.url);
    if (request.method !== "POST" || url.pathname !== "/v1/messages") {
      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!env.ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ error: { message: "ANTHROPIC_API_KEY secret is not set in the Worker" } }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: request.body,
    });

    const responseBody = await upstream.text();
    return new Response(responseBody, {
      status: upstream.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  },
};
