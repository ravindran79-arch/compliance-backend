import express from "express";
import multer from "multer";
import cors from "cors";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

const app = express();
const port = process.env.PORT || 8080;
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

app.use(cors());
app.use(bodyParser.json());

const upload = multer({ storage: multer.memoryStorage() });

app.post("/compliance-check", upload.fields([{ name: "rfq" }, { name: "proposal" }]), async (req, res) => {
  try {
    const rfq = req.files["rfq"]?.[0];
    const proposal = req.files["proposal"]?.[0];

    if (!rfq || !proposal) {
      return res.status(400).json({ error: "Missing RFQ or Proposal file" });
    }

    const rfqText = rfq.buffer.toString("utf-8");
    const proposalText = proposal.buffer.toString("utf-8");

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `
You are a compliance checker. Compare the following two documents and generate a compliance analysis summary.
1. RFQ Document:
${rfqText}

2. Proposal Document:
${proposalText}

Provide the result as a structured JSON with:
{
  "complianceSummary": "...",
  "missingPoints": [...],
  "strengths": [...]
}
`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    res.json({ analysis: responseText });
  } catch (error) {
    console.error("Error in /compliance-check:", error);
    res.status(500).json({ error: error.message || "Internal Server Error" });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
