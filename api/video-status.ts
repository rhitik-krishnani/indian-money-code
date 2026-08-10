import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenAI, GenerateVideosOperation } from "@google/genai";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(401).json({ error: "Missing Gemini API Key" });
  }

  try {
    const { operationName } = req.body;

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
    });

    const op = new GenerateVideosOperation();
    op.name = operationName;

    const updated = await ai.operations.getVideosOperation({ operation: op });
    res.json({
      done: updated.done,
      status: updated.metadata?.state,
      progress: updated.metadata?.progressPercent
    });
  } catch (error: any) {
    console.error("Video Status Error:", error);
    res.status(500).json({ error: error.message });
  }
}
