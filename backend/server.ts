import express from "express";
import http from "http";
import path from "path";
import cors from "cors";
import fs from "fs";
import { WebSocketServer } from "ws";
import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";

// Import all modular ES6 routers
import apiAuthVehicle from "../src/routes/api_auth_vehicle.js";
import apiOwnerDashboard from "../src/routes/api_owner_dashboard.js";
import apiRequestsMessages from "../src/routes/api_requests_messages.js";
import apiPaymentsInvoices from "../src/routes/api_payments_invoices.js";
import requestRoutes from "../src/routes/request_routes.js";
import mechanicRoutes from "../src/routes/mechanic_routes.js";
import userRoutes from "../src/routes/user_routes.js";
import apiAdminDashboard from "../src/routes/api_admin_dashboard.js";
import apiAiAutomation from "../src/routes/api_ai_automation.js";

const app = express();
const PORT = 3000;

// Enable CORS for frontend API communications
app.use(cors());

// Parse incoming payloads
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Serve API routes FIRST
app.use("/api", apiAuthVehicle);
app.use("/api", apiOwnerDashboard);
app.use("/api", apiRequestsMessages);
app.use("/api", apiPaymentsInvoices);
app.use("/api", requestRoutes);
app.use("/api", mechanicRoutes);
app.use("/api", userRoutes);
app.use("/api", apiAdminDashboard);
app.use("/api", apiAiAutomation);

// Support v1 admin aliases
app.use("/api/v1/admin", userRoutes);
app.use("/api/v1/admin", mechanicRoutes);
app.use("/api/v1/admin", requestRoutes);

// Standard API health endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "AutoCare modular full-stack server running successfully with Gemini AI Automation" });
});

// Serve uploaded attachments
const uploadsPath = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsPath)) {
  fs.mkdirSync(uploadsPath, { recursive: true });
}
app.use("/uploads", express.static(uploadsPath));

// Serve all static frontend HTML, JS, CSS files directly from the frontend directory
app.use(express.static(path.join(process.cwd(), "frontend")));

// Root path fallback to index.html
app.get("/", (req, res) => {
  res.sendFile(path.join(process.cwd(), "frontend", "index.html"));
});

// Any unmatched static routes fallback to index.html
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) {
    return next();
  }
  res.sendFile(path.join(process.cwd(), "frontend", "index.html"));
});

// Create HTTP server to attach both Express and WebSockets
const server = http.createServer(app);

// Initialize WebSocketServer for Real-Time Gemini 3.8 Live API Audio
const wss = new WebSocketServer({ server, path: "/ws/gemini-live" });

wss.on("connection", async (clientWs, req) => {
  console.log("[Live API] Client connected to /ws/gemini-live from", req.socket.remoteAddress);
  let session: any = null;
  let apiKey = process.env.GEMINI_API_KEY;

  // Parse voice preference and custom API key from query param if provided
  let voiceName = "Zephyr";
  try {
    const urlObj = new URL(req.url || "", `http://${req.headers.host || "localhost"}`);
    const queryVoice = urlObj.searchParams.get("voice");
    if (queryVoice && ["Zephyr", "Kore", "Puck", "Fenrir", "Aoede"].includes(queryVoice)) {
      voiceName = queryVoice;
    }
    const queryKey = urlObj.searchParams.get("apiKey");
    if (queryKey && queryKey.trim().length > 10) {
      apiKey = queryKey.trim();
    }
  } catch (_) {}

  if (!apiKey) {
    clientWs.send(JSON.stringify({ type: "error", error: "GEMINI_API_KEY is not configured on the server or in client settings." }));
    return;
  }

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: { headers: { "User-Agent": "aistudio-build" } },
    });

    session = await ai.live.connect({
      model: "gemini-3.8-live",
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName } },
        },
        systemInstruction: "You are AutoCare Live Voice AI. You converse in real-time with vehicle owners and mechanics. Keep responses natural, direct, spoken, and helpful regarding car diagnostics and repairs. Keep spoken answers concise (1-2 sentences).",
      },
      callbacks: {
        onmessage: (message: LiveServerMessage) => {
          try {
            const parts = message.serverContent?.modelTurn?.parts || [];
            for (const part of parts) {
              if (part.inlineData?.data) {
                clientWs.send(JSON.stringify({ type: "audio", audio: part.inlineData.data }));
              }
              if (part.text) {
                clientWs.send(JSON.stringify({ type: "text", text: part.text }));
              }
            }
            if (message.serverContent?.interrupted) {
              clientWs.send(JSON.stringify({ type: "interrupted" }));
            }
          } catch (err: any) {
            console.error("[Live API onmessage error]:", err);
          }
        },
        onclose: () => {
          try {
            clientWs.send(JSON.stringify({ type: "status", status: "session_closed" }));
          } catch (_) {}
        },
        onerror: (err: any) => {
          console.error("[Live API Session Error]:", err);
          try {
            clientWs.send(JSON.stringify({ type: "error", error: err?.message || "Live API session encountered an error." }));
          } catch (_) {}
        },
      },
    });

    clientWs.send(JSON.stringify({ type: "ready", message: `Connected to Gemini 3.8 Live API with voice ${voiceName}` }));

    clientWs.on("message", (raw) => {
      try {
        const payload = JSON.parse(raw.toString());
        if (payload.audio && session) {
          session.sendRealtimeInput({
            audio: { data: payload.audio, mimeType: "audio/pcm;rate=16000" },
          });
        } else if (payload.text && session) {
          session.sendRealtimeInput({
            text: payload.text,
          });
        }
      } catch (e: any) {
        console.error("[Live API Client Message Error]:", e);
      }
    });

    clientWs.on("close", () => {
      if (session) {
        try {
          session.close();
        } catch (_) {}
      }
    });
  } catch (err: any) {
    console.error("[Live API Connect Error]:", err);
    try {
      clientWs.send(JSON.stringify({ type: "error", error: err?.message || "Failed to initialize Gemini Live session" }));
    } catch (_) {}
  }
});

// Run server
server.listen(PORT, "0.0.0.0", () => {
  console.log(`[AutoCare Server] Port 3000 active, serving on http://0.0.0.0:${PORT} with Gemini Live WebSockets`);
});
