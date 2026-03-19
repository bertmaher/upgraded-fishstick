import express from "express";
import Anthropic from "@anthropic-ai/sdk";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const client = new Anthropic();

// In-memory cache: hash of input text -> clarified text
const clarificationCache = new Map();

app.use(express.json({ limit: "2mb" }));
app.use(express.static(__dirname));

app.post("/api/clarify", async (req, res) => {
  const { text } = req.body;

  if (!text || typeof text !== "string") {
    return res.status(400).json({ error: "Missing or invalid text field" });
  }

  const trimmed = text.trim();
  if (!trimmed) {
    return res.status(400).json({ error: "Text cannot be empty" });
  }

  // Check cache first
  const cacheKey = crypto.createHash("sha256").update(trimmed).digest("hex");
  if (clarificationCache.has(cacheKey)) {
    return res.json({ clarified: clarificationCache.get(cacheKey), cached: true });
  }

  try {
    // Use prompt caching for the system prompt (static, cacheable)
    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 4096,
      system: [
        {
          type: "text",
          text: `You are an expert at making complex texts easier to understand. When given a passage, rewrite it in clear, accessible language while preserving all the key ideas and nuance. Format your response as a clean, readable explanation. Do not add a preamble—go straight into the clarified version.`,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [
        {
          role: "user",
          content: `Please clarify the following text:\n\n${trimmed}`,
        },
      ],
    });

    const clarified = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");

    // Store in cache
    clarificationCache.set(cacheKey, clarified);

    res.json({ clarified, cached: false });
  } catch (err) {
    console.error("Anthropic API error:", err);
    const status = err.status ?? 500;
    res.status(status).json({ error: err.message ?? "Failed to clarify text" });
  }
});

const PORT = process.env.PORT ?? 3000;
app.listen(PORT, () => {
  console.log(`Text Reader AI running at http://localhost:${PORT}`);
});
