// ---------------- app.js (Render-ready, official Google Generative AI setup) ----------------

const express = require('express');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();
app.use(bodyParser.json());

// Load API key
const apiKey = (process.env.GEMINI_API_KEY || '').trim();
if (!apiKey) {
  console.error('FATAL: GEMINI_API_KEY is not set.');
  process.exit(1);
}

// ---------- Robust Import Handling for @google/generative-ai -----------------
let genaiPkg;
try {
  genaiPkg = require('@google/generative-ai');
} catch (e) {
  console.error('CRITICAL: failed to require @google/generative-ai:', e.message);
  process.exit(1);
}

console.log('DEBUG: @google/generative-ai keys:', Object.keys(genaiPkg || {}));
if (genaiPkg.default) {
  console.log('DEBUG: default keys:', Object.keys(genaiPkg.default || {}));
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

// ---------- Express Routes -----------------

app.get('/', (req, res) => {
  res.send('✅ Google Generative AI service is running on Render');
});

app.post('/generate', async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'Missing prompt' });
    }

    const modelName = 'gemini-1.5-flash';
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

    res.json({ text });
  } catch (err) {
    console.error('Error generating content:', err);
    res.status(500).json({ error: err.message });
  }
});

// ---------- Start Server -----------------
const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server listening on port ${PORT}`);
});
