import dotenv from "dotenv";
import express from "express";
import type { Request, Response } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MODEL_NAME = "gemini-4-hydrogen";

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    throw Object.assign(
      new Error(
        "GEMINI_API_KEY is not configured. Please add your key in Settings > Secrets."
      ),
      { statusCode: 500 }
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 2): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      lastError = err;
      const status =
        (err as { status?: number; statusCode?: number })?.status ??
        (err as { status?: number; statusCode?: number })?.statusCode;
      const retryable = status === 429 || (status !== undefined && status >= 500);
      if (!retryable || attempt === maxRetries) {
        throw err;
      }
      const delayMs = 600 * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastError;
}

function formatGeminiError(err: unknown): { status: number; message: string } {
  const raw = err as { status?: number; statusCode?: number; message?: string };
  const status = raw?.status ?? raw?.statusCode ?? 500;
  const msg = raw?.message ?? "An unexpected error occurred while calling Gemini.";

  if (status === 403 || msg.includes("PERMISSION_DENIED") || msg.includes("API_KEY_INVALID")) {
    return {
      status: 403,
      message: "Gemini API key was rejected or missing. Please verify your key in Settings > Secrets.",
    };
  }
  if (status === 429 || msg.includes("RESOURCE_EXHAUSTED")) {
    return {
      status: 429,
      message: "Rate limit reached on the Gemini API. Please wait a moment and try again.",
    };
  }
  if (status === 404 || msg.includes("NOT_FOUND")) {
    return {
      status: 404,
      message: `Requested model (${MODEL_NAME}) was not found or is unavailable.`,
    };
  }
  return { status: typeof status === "number" && status >= 400 ? status : 500, message: msg };
}

const analysisSchema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Concise academic title inferred or preserved from the source material.",
    },
    discipline: {
      type: Type.STRING,
      description: "Primary academic discipline, e.g., Machine Learning, Molecular Biology, Distributed Systems.",
    },
    readingLevel: {
      type: Type.STRING,
      description: "Short complexity level label, e.g., Graduate Seminar, Undergraduate Core, Research Monograph.",
    },
    executiveThesis: {
      type: Type.STRING,
      description: "2-3 sentence synthesis of the problem statement, central hypothesis, and primary conclusion.",
    },
    methodologySteps: {
      type: Type.ARRAY,
      description: "4 to 6 ordered sequential stages explaining how the work operates.",
      items: {
        type: Type.OBJECT,
        properties: {
          stepNumber: { type: Type.INTEGER },
          stageTitle: { type: Type.STRING },
          mechanism: { type: Type.STRING },
          technicalDetail: {
            type: Type.STRING,
            description: "Relevant equation, complexity bound, experimental protocol, or formal notation.",
          },
        },
        required: ["stepNumber", "stageTitle", "mechanism", "technicalDetail"],
      },
    },
    claimsAndEvidence: {
      type: Type.ARRAY,
      description: "3 to 5 primary empirical or theoretical claims paired with evidence and critical caveats.",
      items: {
        type: Type.OBJECT,
        properties: {
          claim: { type: Type.STRING },
          evidenceAnchor: { type: Type.STRING },
          strength: {
            type: Type.STRING,
            description: "Exactly one of: Strong, Moderate, Caveat",
          },
          limitation: { type: Type.STRING },
        },
        required: ["claim", "evidenceAnchor", "strength", "limitation"],
      },
    },
    conceptNodes: {
      type: Type.ARRAY,
      description: "7 to 9 key concepts forming a layered knowledge graph from tier 0 (foundational) to tier 2 (outcomes).",
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING, description: "Short kebab-case unique identifier, e.g., self-attention" },
          label: { type: Type.STRING, description: "2 to 4 word readable concept name" },
          category: {
            type: Type.STRING,
            description: "Exactly one of: Core, Mechanism, Assumption, Outcome",
          },
          tier: {
            type: Type.INTEGER,
            description: "0 for foundational inputs/problems, 1 for core mechanisms, 2 for outcomes/implications",
          },
          definition: { type: Type.STRING, description: "Precise 1-2 sentence academic definition." },
          roleInPaper: { type: Type.STRING, description: "How this specific work uses or advances the concept." },
        },
        required: ["id", "label", "category", "tier", "definition", "roleInPaper"],
      },
    },
    conceptEdges: {
      type: Type.ARRAY,
      description: "Directed edges connecting conceptNode ids (source -> target) with concise verb labels.",
      items: {
        type: Type.OBJECT,
        properties: {
          source: { type: Type.STRING },
          target: { type: Type.STRING },
          relation: { type: Type.STRING, description: "2-4 word active relation, e.g., enables, scales, constrains" },
        },
        required: ["source", "target", "relation"],
      },
    },
    keyNotation: {
      type: Type.ARRAY,
      description: "3 to 5 key symbols, variables, or domain terms.",
      items: {
        type: Type.OBJECT,
        properties: {
          symbol: { type: Type.STRING },
          meaning: { type: Type.STRING },
        },
        required: ["symbol", "meaning"],
      },
    },
    openQuestions: {
      type: Type.ARRAY,
      description: "3 rigorous peer-review or viva questions highlighting unresolved gaps or extensions.",
      items: { type: Type.STRING },
    },
  },
  required: [
    "title",
    "discipline",
    "readingLevel",
    "executiveThesis",
    "methodologySteps",
    "claimsAndEvidence",
    "conceptNodes",
    "conceptEdges",
    "keyNotation",
    "openQuestions",
  ],
};

async function startServer() {
  const app = express();
  app.use(express.json({ limit: "15mb" }));

  // 1. Structured Paper / Lecture Deconstructor
  app.post("/api/analyze", async (req: Request, res: Response) => {
    try {
      const { title, text, fileBase64, fileMimeType } = req.body as {
        title?: string;
        text?: string;
        fileBase64?: string;
        fileMimeType?: string;
      };

      const trimmedText = (text ?? "").trim();
      if (!trimmedText && !fileBase64) {
        res.status(400).json({ error: "Please provide research text or upload a supported document." });
        return;
      }

      const ai = getGeminiClient();

      const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [];
      if (fileBase64 && fileMimeType) {
        parts.push({
          inlineData: {
            mimeType: fileMimeType,
            data: fileBase64,
          },
        });
      }

      const promptText = [
        "Deconstruct the provided academic paper, technical excerpt, or lecture material into a structured research synthesis.",
        title ? `Provided title hint: ${title}` : "",
        trimmedText ? `Source text:\n${trimmedText}` : "Analyze the attached document thoroughly.",
        "Ensure conceptEdges reference valid ids present in conceptNodes, and organize conceptNodes evenly across tiers 0, 1, and 2 (2-3 nodes per tier) so the directed graph has no isolated nodes.",
        "Keep every strength value strictly one of 'Strong', 'Moderate', or 'Caveat'. Keep every category strictly one of 'Core', 'Mechanism', 'Assumption', or 'Outcome'.",
      ]
        .filter(Boolean)
        .join("\n\n");

      parts.push({ text: promptText });

      const response = await withRetry(() =>
        ai.models.generateContent({
          model: MODEL_NAME,
          contents: { parts },
          config: {
            systemInstruction:
              "You are a rigorous academic research analyst and seminar instructor. Extract precise mechanisms, formal notation, verifiable claims, caveats, and causal concept relationships without fabricating citations.",
            responseMimeType: "application/json",
            responseSchema: analysisSchema,
            thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
          },
        })
      );

      const rawJson = (response.text ?? "{}").trim();
      const parsed = JSON.parse(rawJson);
      res.json(parsed);
    } catch (err) {
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // 2. Streaming Adaptive Depth Explanation (SSE)
  app.post("/api/explain", async (req: Request, res: Response) => {
    const { paperTitle, paperContext, focusTopic, depth } = req.body as {
      paperTitle?: string;
      paperContext?: string;
      focusTopic?: string;
      depth?: "undergraduate" | "graduate" | "reviewer";
    };

    if (!paperContext || !focusTopic) {
      res.status(400).json({ error: "Missing paperContext or focusTopic." });
      return;
    }

    try {
      const ai = getGeminiClient();

      const depthDirective =
        depth === "undergraduate"
          ? "Explain clearly for an undergraduate student learning this topic for the first time. Use concrete intuition, an everyday or cross-disciplinary analogy, and define technical jargon cleanly in 2-3 concise paragraphs."
          : depth === "reviewer"
          ? "Deliver a sharp peer-reviewer critique for an academic journal committee. Examine hidden assumptions, edge cases, scalability or experimental validity limits, and suggest one concrete follow-up ablation or experiment."
          : "Explain at a graduate seminar level. Connect the concept directly to the paper's formal mechanism, tradeoffs against prior baselines, and mathematical or structural intuition in 2-3 crisp paragraphs.";

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const stream = await ai.models.generateContentStream({
        model: MODEL_NAME,
        contents: `Paper: ${paperTitle ?? "Academic Excerpt"}\n\nContext:\n${paperContext}\n\nFocus Topic: ${focusTopic}\n\nTask: ${depthDirective}`,
        config: {
          systemInstruction:
            "You are a university professor delivering clear, structured, prose-only academic explanations. Write in clean paragraphs with minimal bullet lists where helpful. Avoid conversational filler.",
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });

      for await (const chunk of stream) {
        const text = chunk.text;
        if (text) {
          res.write(`data: ${JSON.stringify({ chunk: text })}\n\n`);
        }
      }
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    } catch (err) {
      const formatted = formatGeminiError(err);
      if (!res.headersSent) {
        res.status(formatted.status).json({ error: formatted.message });
      } else {
        res.write(`data: ${JSON.stringify({ error: formatted.message })}\n\n`);
        res.end();
      }
    }
  });

  // 3. Viva Simulator — Generate Opening Question
  app.post("/api/viva/start", async (req: Request, res: Response) => {
    try {
      const { paperTitle, executiveThesis, methodologySummary, claimsSummary, difficulty } =
        req.body as {
          paperTitle?: string;
          executiveThesis?: string;
          methodologySummary?: string;
          claimsSummary?: string;
          difficulty?: string;
        };

      if (!paperTitle || !executiveThesis) {
        res.status(400).json({ error: "Analyze a paper before starting a viva defense session." });
        return;
      }

      const ai = getGeminiClient();

      const response = await withRetry(() =>
        ai.models.generateContent({
          model: MODEL_NAME,
          contents: `Paper Title: ${paperTitle}\nThesis: ${executiveThesis}\nMethodology: ${methodologySummary ?? ""}\nClaims: ${claimsSummary ?? ""}\nDifficulty Level: ${difficulty ?? "Rigorous"}`,
          config: {
            systemInstruction:
              "You are an academic thesis defense examiner. Pose one incisive opening oral examination question grounded directly in the paper's mechanism or assumptions, and specify the key points a strong defense should mention.",
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                question: { type: Type.STRING },
                focusArea: { type: Type.STRING },
                expectedKeyPoints: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
              },
              required: ["question", "focusArea", "expectedKeyPoints"],
            },
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          },
        })
      );

      res.json(JSON.parse((response.text ?? "{}").trim()));
    } catch (err) {
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // 4. Viva Simulator — Evaluate Candidate Answer & Pose Follow-up
  app.post("/api/viva/evaluate", async (req: Request, res: Response) => {
    try {
      const { paperContext, currentQuestion, candidateAnswer, difficulty, turnCount } =
        req.body as {
          paperContext?: string;
          currentQuestion?: string;
          candidateAnswer?: string;
          difficulty?: string;
          turnCount?: number;
        };

      if (!paperContext || !currentQuestion || !candidateAnswer?.trim()) {
        res.status(400).json({ error: "Please enter your defense response before submitting." });
        return;
      }

      const ai = getGeminiClient();

      const response = await withRetry(() =>
        ai.models.generateContent({
          model: MODEL_NAME,
          contents: `Paper Context:\n${paperContext}\n\nDifficulty: ${difficulty ?? "Rigorous"}\nExaminer Question (#${turnCount ?? 1}): ${currentQuestion}\n\nCandidate Answer:\n${candidateAnswer.trim()}`,
          config: {
            systemInstruction:
              "You are a fair, rigorous university thesis examiner. Evaluate the candidate's defense answer strictly on technical accuracy, conceptual clarity, and grounding in the paper. Then ask a sharp next question probing a different angle or deeper implication.",
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                verdict: {
                  type: Type.STRING,
                  description: "Exactly one of: Thorough, Partially Grounded, Needs Depth",
                },
                strengths: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                gapsToAddress: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                modelAnswerOutline: { type: Type.STRING },
                nextQuestion: { type: Type.STRING },
                nextFocusArea: { type: Type.STRING },
              },
              required: [
                "verdict",
                "strengths",
                "gapsToAddress",
                "modelAnswerOutline",
                "nextQuestion",
                "nextFocusArea",
              ],
            },
            thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
          },
        })
      );

      res.json(JSON.parse((response.text ?? "{}").trim()));
    } catch (err) {
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // Vite middleware in dev, static assets in prod
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (_req: Request, res: Response) => {
      const indexFile = path.join(distPath, "index.html");
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send("Application build not found.");
      }
    });
  }

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, "0.0.0.0", () => {
    console.log(`ScholarLens server listening on http://localhost:${port}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start ScholarLens server:", err);
  process.exit(1);
});
