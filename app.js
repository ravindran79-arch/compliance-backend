// ---------------- app.js (Render-ready, file upload + AI compliance) ----------------

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const app = express();
app.use(bodyParser.json());
app.use(cors());

// Load API key
const apiKey = process.env.GOOGLE_API_KEY?.trim();
if (!apiKey) {
  console.error('❌ Missing GOOGLE_API_KEY in environment variables');
  process.exit(1);
}

const ai = new GoogleGenerativeAI(apiKey);

// Configure multer for file uploads
const upload = multer({ dest: 'uploads/' });

// Route to check compliance
app.post('/compliance-check', upload.fields([
  { name: 'rfq', maxCount: 1 },
  { name: 'proposal', maxCount: 1 },
]), async (req, res) => {
  try {
    const rfqFile = req.files?.rfq?.[0];
    const proposalFile = req.files?.proposal?.[0];

    if (!rfqFile || !proposalFile) {
      return res.status(400).json({ error: 'Missing RFQ or Proposal file' });
    }

    const readTextFromFile = (file) => {
      const ext = path.extname(file.originalname).toLowerCase();
      if (ext === '.txt') return fs.readFileSync(file.path, 'utf8');
      // PDF/DOCX parsing can be added here if needed
      return fs.readFileSync(file.path, 'utf8'); // fallback
    };

    const rfqText = readTextFromFile(rfqFile);
    const proposalText = readTextFromFile(proposalFile);

    if (!rfqText || !proposalText) {
      return res.status(400).json({ error: 'Missing RFQ or Proposal text' });
    }

    const prompt = `Compare the following RFQ and Proposal documents for compliance:\n\nRFQ:\n${rfqText}\n\nProposal:\n${proposalText}\n\nProvide a detailed compliance report, score, and improvement suggestions.`;

    const modelName = 'text-bison-001';
    const model = ai.getModel({ model: modelName });
    const result = await model.generateContent(prompt);
    const text = result?.response?.text || result?.candidates?.[0]?.content?.parts?.[0]?.text || 'No text found';

    // Clean up uploaded files
    fs.unlinkSync(rfqFile.path);
    fs.unlinkSync(proposalFile.path);

    res.json({ success: true, result: text });
  } catch (err) {
    console.error('Backend Error:', err);
    res.status(500).json({ error: err.message || err.toString() });
  }
});

// Health check
app.get('/', (req,
