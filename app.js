// ---------------- app.js (Render-ready, official Google Generative AI setup) ----------------

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

// ---------- Load API key ----------
const apiKey = (process.env.GOOGLE_API_KEY || '').trim();
if (!apiKey) {
  console.error('❌ Missing GOOGLE_API_KEY in environment variables');
  process.exit(1);
}

// ---------- Robust Import Handling for @google/generative-ai ----------
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

// ---------- Multer setup for file uploads ----------
const upload = multer({ dest: 'uploads/' });

// ---------- Express Routes ----------
app.get('/', (req, res) => {
  res.send('✅ Google Generative AI service is running on Render');
});

// ---------- Compliance Check Route ----------
app.post('/compliance-check', upload.fields([
  { name: 'rfq', maxCount: 1 },
  { name: 'proposal', maxCount: 1 }
]), async (req, res) => {
  try {
    const rfqFile = req.files['rfq']?.[0];
    const proposalFile = req.files['proposal']?.[0];

    if (!rfqFile || !proposalFile) {
      return res.status(400).json({ error: 'Missing RFQ or Proposal file' });
    }

    const rfqText = fs.readFileSync(rfqFile.path, 'utf8');
    const proposalText = fs.readFileSync(proposalFile.path, 'utf8');

    if (!rfqText || !proposalText) {
      return res.status(400).json({ error: 'RFQ or Proposal text is empty' });
    }

    const prompt = `Compare the following two documents for compliance issues:\n\nRFQ:\n${rfqText}\n\nProposal:\n${proposalText}\n\nProvide a summary of compliance issues.`;

    const modelName = 'gemini-1.5-flash'; // Or replace with a valid model you have access to
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
        : response?.candidates?.[0]?.content?.parts?.[0]?.text || 'No text found';

    // Clean up uploaded files
    fs.unlinkSync(rfqFile.path);
    fs.unlinkSync(proposalFile.path);

    res.json({ analysis: text });
  } catch (err) {
    console.error('Backend Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ---------- Start Server ----------
const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server listening on port ${PORT}`);
});
