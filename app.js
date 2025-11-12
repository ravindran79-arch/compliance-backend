// ---------------- app.js (Render-ready, JSON input, CORS enabled) ----------------

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '1mb' }));

// Load API key
const apiKey = (process.env.GOOGLE_API_KEY || '').trim();
if (!apiKey) {
  console.error('❌ Missing GOOGLE_API_KEY in environment variables');
  process.exit(1);
}

// Robust import handling for @google/generative-ai
let genaiPkg;
try {
  genaiPkg = require('@google/generative-ai');
} catch (e) {
  console.error('CRITICAL: failed to require @google/generative-ai:', e.message);
  process.exit(1);
}

function findGoogleGenAIExport(pkg) {
  if (!pkg) return null;
  if (typeof pkg.GoogleGenerativeAI === 'function') return pkg.GoogleGenerativeAI;
  if (typeof pkg === 'function') return pkg;
  if (pkg.default && typeof pkg.default.GoogleGenerativeAI === 'function')
    return pkg.default.GoogleGenerativeAI;
  if (pkg.default && typeof pkg.default === 'function') return pkg.default;
  return null;
}

const GoogleGenerativeAI = findGoogleGenAIExport(genaiPkg);
if (!GoogleGenerativeAI) {
  console.error('CRITICAL: Could not find GoogleGenerativeAI constructor.');
  process.exit(1);
}

const ai = new GoogleGenerativeAI(apiKey);

// ---------------- Routes -----------------

app.get('/', (req, res) => {
  res.send('✅ Google Generative AI backend is running.');
});

app.post('/compliance-check', async (req, res) => {
  try {
    const { rfq, proposal } = req.body;
    if (!rfq || !proposal) {
      return res.status(400).json({ error: "Missing RFQ or Proposal text" });
    }

    const prompt = `Compare the following RFQ and Proposal documents for compliance, gaps, and improvement suggestions.\n\nRFQ:\n${rfq}\n\nProposal:\n${proposal}\n\nProvide a detailed compliance analysis.`;

    const modelName = 'gemini-1.5'; // Update to a valid model available in your account
    const model = ai.getGenerativeModel
      ? ai.getGenerativeModel({ model: modelName })
      : ai.getModel
      ? ai.getModel({ model: modelName })
      : null;

    if (!model) {
      throw new Error('SDK did not expose getGenerativeModel() or getModel()');
    }

    const result = await model.generateContent(prompt);
    const response = result?.response || result;
    const text =
      typeof response.text === 'function'
        ? response.text()
        : response?.candidates?.[0]?.content?.parts?.[0]?.text || 'No text returned from AI';

    res.json({ result: text });
  } catch (err) {
    console.error('Backend Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ---------------- Start server -----------------

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server listening on port ${PORT}`);
});
