// app.js

const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const dotenv = require("dotenv");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const { GoogleGenerativeAI } = require("@google/generative-ai");

dotenv.config();
const app = express();
app.use(cors());
app.use(bodyParser.json());

// Configure Multer for file uploads
const upload = multer({ dest: "uploads/" });

// Initialize Google Generative AI client
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); // ✅ updated model

// Route for compliance checking
app.post("/compliance-check", upload.array("files", 2), async (req, res) => {
  try {
    if (!req.files || req.files.length !== 2) {
      return res.status(400).json({ error: "Please upload both RFQ and Proposal files." });
    }

    // Read and convert the two files to text
    const [rfqFile, proposalFile] = req.files;
    const rfqText = fs.readFileSync(rfqFile.path, "utf-8");
    const proposalText = fs.readFileSync(proposalFile.path, "utf-8");

    // Prompt to the model
    const prompt = `
      Compare the following two documents for compliance.
      Document 1 (RFQ): ${rfqText}
      Document 2 (Proposal): ${proposalText}
      Provide a concise compliance summary and highlight mismatches.
    `;

    const result = await model.generateContent(prompt);
    const aiResponse = await result.response.text();

    // Clean up uploaded files
    fs.unlinkSync(rfqFile.path);
    fs.unlinkSync(proposalFile.path);

    res.json({ result: aiResponse });
  } catch (error) {
    console.error("Backend Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/", (req, res) => {
  res.send("✅ Compliance backend is running successfully!");
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
