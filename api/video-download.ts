import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenAI, GenerateVideosOperation } from "@google/genai";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(401).json({ error: "Missing Gemini API Key" });
  }

  try {
    const operationName = req.query.name as string;
    if (!operationName) {
      return res.status(400).json({ error: "Operation name is required" });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
    });

    const op = new GenerateVideosOperation();
    op.name = operationName;

    const updated = await ai.operations.getVideosOperation({ operation: op });

    if (!updated.done) {
      return res.status(400).json({ error: "Operation not complete" });
    }

    const uri = updated.response?.generatedVideos?.[0]?.video?.uri;
    if (!uri) {
      return res.status(404).json({ error: "Video URI not found" });
    }

    const videoRes = await fetch(uri, {
      headers: { 'x-goog-api-key': apiKey },
    });

    if (!videoRes.ok) {
      const errText = await videoRes.text();
      return res.status(videoRes.status).json({ error: "Failed to fetch video from source", details: errText });
    }

    res.setHeader('Content-Type', 'video/mp4');
    const opId = operationName.split('/').pop();
    res.setHeader('Content-Disposition', `attachment; filename="video_${opId}.mp4"`);

    const buffer = await videoRes.arrayBuffer();
    res.send(Buffer.from(buffer));
  } catch (error: any) {
    console.error("Video Download Error:", error);
    res.status(500).json({ error: error.message });
  }
}
