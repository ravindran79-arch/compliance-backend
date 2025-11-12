const express = require('express');
const multer = require('multer'); // For file uploads
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth'); // For DOCX
require('dotenv').config();

const app = express();
app.use(bodyParser.json());

// ---------- CORS Setup ----------
const FRONTEND_URL = "https://render-static-site-te8v.onrender.com";
app.use(cors({
    origin: FRONTEND_URL,
    methods: ['GET','POST'],
}));

// ---------- Google Generative AI Setup ----------
const apiKey = (process.env.GEMINI_API_KEY || '').trim();
if (!apiKey) {
    console.error('FATAL: GEMINI_API_KEY is not set.');
    process.exit(1);
}

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
    if (pkg.default && typeof pkg.default.GoogleGenerativeAI === 'function') return pkg.default.GoogleGenerativeAI;
    if (pkg.default && typeof pkg.default === 'function') return pkg.default;
    return null;
}

const GoogleGenerativeAI = findGoogleGenAIExport(genaiPkg);
if (!GoogleGenerativeAI) {
    console.error('CRITICAL: Could not find GoogleGenerativeAI constructor.');
    process.exit(1);
}

const ai = new GoogleGenerativeAI(apiKey);

// ---------- Multer Setup for File Uploads ----------
const upload = multer({ dest: 'uploads/' });

// ---------- Utility Functions ----------
async function extractTextFromFile(file) {
    const ext = path.extname(file.originalname).toLowerCase();
    let text = '';

    if (ext === '.pdf') {
        const data = fs.readFileSync(file.path);
        const pdfData = await pdfParse(data);
        text = pdfData.text;
    } else if (ext === '.docx' || ext === '.doc') {
        const data = fs.readFileSync(file.path);
        const result = await mammoth.extractRawText({ buffer: data });
        text = result.value;
    } else if (ext === '.txt') {
        text = fs.readFileSync(file.path, 'utf-8');
    } else {
        throw new Error(`Unsupported file type: ${ext}`);
    }

    return text.trim();
}

// ---------- Routes ----------
app.get('/', (req, res) => {
    res.send('✅ Google Generative AI compliance backend is running');
});

// POST /compliance-check
app.post('/compliance-check', upload.fields([
    { name: 'rfq', maxCount: 1 },
    { name: 'proposal', maxCount: 1 }
]), async (req, res) => {
    try {
        const rfqFile = req.files?.rfq?.[0];
        const proposalFile = req.files?.proposal?.[0];

        if (!rfqFile || !proposalFile) {
            return res.status(400).json({ error: 'Both RFQ and Proposal files are required.' });
        }

        // Extract text
        const rfqText = await extractTextFromFile(rfqFile);
        const proposalText = await extractTextFromFile(proposalFile);

        // Combine into a prompt
        const prompt = `
Compare the following RFQ and Proposal documents for compliance:

RFQ:
${rfqText}

Proposal:
${proposalText}

Provide a compliance score, highlight mismatches, and suggest improvements.
`;

        // Call Google Generative AI
        const modelName = 'gemini-1.5-flash';
        const model = ai.getGenerativeModel
            ? ai.getGenerativeModel({ model: modelName })
            : ai.getModel
            ? ai.getModel({ model: modelName })
            : null;

        if (!model) throw new Error('SDK did not expose getGenerativeModel() or getModel()');

        const result = await model.generateContent(prompt);
        const response = result?.response || result;
        const text = typeof response.text === 'function'
            ? response.text()
            : response?.candidates?.[0]?.content?.parts?.[0]?.text || 'No text returned';

        res.json({ success: true, result: text });

    } catch (err) {
        console.error('Error in compliance-check:', err);
        res.status(500).json({ success: false, error: err.message });
    } finally {
        // Clean up uploaded files
        if (req.files) {
            Object.values(req.files).flat().forEach(file => fs.unlink(file.path, () => {}));
        }
    }
});

// ---------- Start Server ----------
const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Compliance backend running on port ${PORT}`);
});
