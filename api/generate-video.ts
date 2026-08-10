import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenAI } from "@google/genai";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(401).json({ error: "Missing Gemini API Key. Please configure it in Settings > Secrets." });
  }

  try {
    const { prompt, aspectRatio, resolution } = req.body;

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
    });

    console.log(`Starting video gen: ${prompt} (${aspectRatio}, ${resolution})`);
    const operation = await ai.models.generateVideos({
      model: 'veo-3.1-generate-preview',
      prompt: prompt || 'Cinematic shot of a gold coin spinning on a high-tech glass table, futuristic financial data in background, 4k, hyper-realistic',
      config: {
        numberOfVideos: 1,
        resolution: resolution || '1080p',
        aspectRatio: aspectRatio || '16:9'
      }
    });

    console.log("Operation started:", operation.name);
    res.json({ operationName: operation.name });
  } catch (error: any) {
    console.error("Video Gen Start Error:", error);
    if (error.message?.includes("429") || error.message?.includes("RESOURCE_EXHAUSTED")) {
      return res.status(429).json({
        error: "Veo 3.1 Pro is currently at capacity. Please wait 1-2 minutes and try again.",
        isRateLimit: true
      });
    }
    res.status(500).json({ error: error.message || "Internal Server Error during video generation start" });
  }
}
