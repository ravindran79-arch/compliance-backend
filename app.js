// app.js

const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const dotenv = require("dotenv");
const multer = require("multer");
const fs = require("fs");
const { GoogleGenerativeAI } = require("@google/generative-ai");

dotenv.config();
const app = express();
app.use(cors());
app.use(bodyParser.json());

const upload = multer({ dest: "uploads/" });

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); // ✅ working model

app.post("/compliance-check", upload.array("files", 2), async (req, res) => {
  try {
    if (!req.files || req.files.length !== 2) {
      return res.status(400).json({ error: "Please upload both RFQ and Proposal files." });
    }

    const [rfqFile, proposalFile] = req.files;
    const rfqText = fs.readFileSync(rfqFile.path, "utf-8");
    const proposalText = fs.readFileSync(proposalFile.path, "utf-8");

    const prompt = `
      Compare the following two documents for compliance.
      Document 1 (RFQ): ${rfqText}
      Document 2 (Proposal): ${proposalText}
      Provide a concise compliance summary and highlight mismatches.
    `;

    const result = await model.generateContent(prompt);
    const aiResponse = await result.response.text();

    fs.unlinkSync(rfqFile.path);
    fs.unlinkSync(proposalFile.path);

    return res.json({ result: aiResponse });
  } catch (error) {
    console.error("❌ Backend Error:", error);

    // ✅ Always return a clean JSON error object
    return res.status(500).json({
      error: error.message || "Unknown server error",
      stack: process.env.NODE_ENV === "production" ? undefined : error.stack,
    });
  }
});

app.get("/", (req, res) => {
  res.send("✅ Compliance backend running successfully!");
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`🚀 Server live on port ${PORT}`));
