// app.js
import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import { GenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Check for API key
if (!process.env.GOOGLE_API_KEY) {
  console.error("❌ Missing GOOGLE_API_KEY in environment variables");
  process.exit(1);
}

// Configure Generative AI client
const client = new GenerativeAI({
  apiKey: process.env.GOOGLE_API_KEY,
});

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: "10mb" }));
app.use(bodyParser.urlencoded({ extended: true }));

// Health check
app.get("/", (req, res) => {
  res.send({ status: "Backend running" });
});

// Compliance check endpoint
app.post("/compliance-check", async (req, res) => {
  try {
    const { rfqText, proposalText } = req.body;

    if (!rfqText || !proposalText) {
      return res.status(400).json({ error: "Missing RFQ or Proposal text" });
    }

    // Combine documents for analysis
    const prompt = `
      Compare the following RFQ and Proposal documents for compliance.
      Provide a detailed analysis, highlighting missing or incorrect items.

      RFQ:
      ${rfqText}

      Proposal:
      ${proposalText}
    `;

    // Call Google Generative AI
    const response = await client.generateText({
      model: "gemini-1.5",
      prompt: prompt,
      temperature: 0,
      maxOutputTokens: 500,
    });

    res.json({ analysis: response.outputText });
  } catch (error) {
    console.error(error);
    if (error?.response?.status) {
      res
        .status(error.response.status)
        .json({ error: error.message || "AI request failed" });
    } else {
      res.status(500).json({ error: error.message || "Server error" });
    }
  }
});

// Start server
app.listen(port, () => {
  console.log(`✅ Backend running on port ${port}`);
});
