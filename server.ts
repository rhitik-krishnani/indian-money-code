import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, GenerateVideosOperation } from "@google/genai";
import fs from "fs";
import {
  analyzePortfolio,
  analyzeBudget,
  generateWill,
  parseVoiceTransaction,
  extractStatementTransactions,
  extractMutualFundInvestments,
  parseSmsTransaction,
  parsePdfStatement,
  getFinancialAdvice,
  getPriorityAction,
  getMarketPulse,
  syncMarketPrices,
  getLifeLevelUpAdvice
} from "./services/geminiServiceServer";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "50mb" })); // Ensure we can receive statement base64 transfers safely

  // Initialize Gemini Client
  const apiKey = process.env.GEMINI_API_KEY;
  const ai = new GoogleGenAI({ 
    apiKey: apiKey || "",
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });

  // API Routes
  
  // SECURE GEMINI AI PROXY ROUTE (Server Authoritative)
  app.post("/api/gemini", async (req, res) => {
    try {
      const { action, args } = req.body;
      if (!action) {
        return res.status(400).json({ error: "AI execution action is required" });
      }

      const allowedActions: Record<string, Function> = {
        analyzePortfolio,
        analyzeBudget,
        generateWill,
        parseVoiceTransaction,
        extractStatementTransactions,
        extractMutualFundInvestments,
        parseSmsTransaction,
        parsePdfStatement,
        getFinancialAdvice,
        getPriorityAction,
        getMarketPulse,
        syncMarketPrices,
        getLifeLevelUpAdvice
      };

      const fn = allowedActions[action];
      if (!fn) {
        return res.status(404).json({ error: `Engine action ${action} is not supported` });
      }

      console.log(`Executing server-side Gemini action: ${action}`);
      const result = await fn(...(args || []));
      res.json({ result });
    } catch (error: any) {
      console.error(`AI Server execution error for action ${req.body?.action}:`, error);
      res.status(500).json({ error: error.message || "Failed to execute AI action on server" });
    }
  });
  
  // 1. Start Video Generation
  app.post("/api/generate-video", async (req, res) => {
    try {
      const { prompt, aspectRatio, resolution } = req.body;
      
      if (!apiKey) {
        console.error("Missing Gemini API Key");
        return res.status(401).json({ error: "Missing Gemini API Key. Please configure it in Settings > Secrets." });
      }

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
      
      // Handle Quota/Rate limit specifically for pro user awareness
      if (error.message?.includes("429") || error.message?.includes("RESOURCE_EXHAUSTED")) {
        return res.status(429).json({ 
          error: "Veo 3.1 Pro is currently at capacity. Even for Pro users, video generation has strict minute-by-minute quotas. Please wait 1-2 minutes and try again.",
          isRateLimit: true
        });
      }
      
      res.status(500).json({ error: error.message || "Internal Server Error during video generation start" });
    }
  });

  // 2. Poll Video Status
  app.post("/api/video-status", async (req, res) => {
    try {
      const { operationName } = req.body;
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
  });

  // 3. Download Video (Proxy)
  app.get("/api/video-download", async (req, res) => {
    try {
      if (!apiKey) {
        return res.status(401).json({ error: "Missing Gemini API Key" });
      }

      const operationName = req.query.name as string;
      if (!operationName) {
        return res.status(400).json({ error: "Operation name is required" });
      }
      
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
        console.error("Source video fetch failed:", errText);
        return res.status(videoRes.status).json({ error: "Failed to fetch video from source", details: errText });
      }

      res.setHeader('Content-Type', 'video/mp4');
      const opId = operationName.split('/').pop();
      res.setHeader('Content-Disposition', `attachment; filename="video_${opId}.mp4"`);

      if (videoRes.body) {
        // @ts-ignore - pipeTo might have type issues but works in this env
        await videoRes.body.pipeTo(
          new WritableStream({
            write(chunk) { res.write(chunk); },
            close() { res.end(); },
          })
        );
      } else {
        res.status(500).send("No video body received");
      }
      
    } catch (error: any) {
      console.error("Video Download Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Vite Middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*all", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
