// ---------------- app.js (Render-ready, robust Google GenAI import) ----------------

// Standard Express + server setup
const express = require('express');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();
app.use(bodyParser.json());

// Load API key from environment
const apiKey = (process.env.GEMINI_API_KEY || '').trim();
if (!apiKey) {
  console.error('FATAL: GEMINI_API_KEY is not set.');
  process.exit(1);
}

// ---------- Robust Import Handling for @google/genai -----------------
const genaiPkg = (() => {
  try {
    return require('@google/genai');
  } catch (e1) {
    try {
      // Some docs/examples use @google/generative-ai instead
      return require('@google/generative-ai');
    } catch (e2) {
      console.error('CRITICAL: failed to require @google/genai and @google/generative-ai');
      console.error('require errors:', e1 && e1.message, e2 && e2.message);
      throw e1;
    }
  }
})();

// Debug the export shape — shows up in Render logs
console.log('DEBUG: @google genai package top-level keys:', Object.keys(genaiPkg || {}));
if (genaiPkg && genaiPkg.default) {
  console.log('DEBUG: package.default keys:', Object.keys(genaiPkg.default || {}));
}

function findGoogleGenAIExport(pkg) {
  if (!pkg) return null;

  // 1) Named export
  if (typeof pkg.GoogleGenerativeAI === 'function') return pkg.GoogleGenerativeAI;
  // 2) Package itself is the class
  if (typeof pkg === 'function') return pkg;
  // 3) default: { GoogleGenerativeAI: class ... }
  if (pkg.default && typeof pkg.default.GoogleGenerativeAI === 'function') return pkg.default.GoogleGenerativeAI;
  // 4) default itself is the class
  if (pkg.default && typeof pkg.default === 'function') return pkg.default;
  // 5) Other possible client names (future SDK variants)
  if (typeof pkg.GoogleGenAI === 'function') return pkg.GoogleGenAI;
  if (typeof pkg.GoogleGenerativeAIClient === 'function') return pkg.GoogleGenerativeAIClient;

  return null;
}

const GoogleGenerativeAI = findGoogleGenAIExport(genaiPkg);
if (!GoogleGenerativeAI) {
  console.error('CRITICAL: could not find a usable GoogleGenerativeAI constructor.');
  console.error('Top-level package shape:', Object.keys(genaiPkg || {}));
  process.exit(1);
}

const ai = new GoogleGenerativeAI(apiKey);

// ---------- Express Route Logic -----------------

app.get('/', (req, res) => {
  res.send('✅ Google Generative AI service is running on Render');
});

app.post('/generate', async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'Missing prompt' });
    }

    // Depending on SDK version, model names differ — use the stable one:
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
