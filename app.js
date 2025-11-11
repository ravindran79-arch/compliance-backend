const express = require('express');
const GoogleGenerativeAI = require('@google/genai').GoogleGenerativeAI;
const cors = require('cors');
const multer = require('multer');

// --- Initialization ---

// 1. Initialize the Express application
const app = express();
const port = process.env.PORT || 8080;
const apiKey = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.trim() : null;

// Ensure API key exists before initializing AI client
if (!apiKey) {
    console.error("CRITICAL: GEMINI_API_KEY environment variable is missing.");
    process.exit(1);
}

const ai = new GoogleGenerativeAI(apiKey);

// 2. Configure CORS
// CRITICAL: MUST be set to the exact domain of your GoDaddy frontend for security.
// Use '*' for initial testing only, but change this before production deployment!
const allowedOrigin = '*'; 

app.use(cors({
    origin: allowedOrigin,
    methods: ['POST', 'GET'], // Add GET for the root endpoint check
}));

// 3. Configure Multer (Store files in memory)
const upload = multer({ storage: multer.memoryStorage() });

// --- Helper Function: File Formatting ---

/**
 * Converts a Multer file object buffer into the Part object required by the Gemini API.
 */
const formatFileForGemini = (file) => {
    return {
        inlineData: {
            data: file.buffer.toString('base64'),
            mimeType: file.mimetype,
        },
    };
};

// --- Routes ---

// 1. Health Check Endpoint (For Render to ensure the service is running)
app.get('/', (req, res) => {
    res.status(200).send('AI Compliance Backend is Running!');
});

// 2. Compliance Check Endpoint (Main Logic)
app.post('/check-compliance', upload.fields([
    { name: 'rfq_file', maxCount: 1 },
    { name: 'proposal_file', maxCount: 1 }
]), async (req, res) => {
    // Input validation
    if (!req.files || !req.files.rfq_file || !req.files.proposal_file) {
        return res.status(400).json({ success: false, error: 'Missing RFQ file or Proposal file.' });
    }

    try {
        const rfqFile = req.files.rfq_file[0];
        const proposalFile = req.files.proposal_file[0];

        const rfqPart = formatFileForGemini(rfqFile);
        const proposalPart = formatFileForGemini(proposalFile);

        const model = 'gemini-2.5-flash';

        // --- Step 4: The Gemini Prompt (Core Compliance Logic) ---
        const systemInstruction = `You are a world-class Compliance Analyst AI. Your task is to rigorously review a 'Proposal' document against a 'Request for Quotation (RFQ)' document. 
        
        Analyze the Proposal for direct compliance with every requirement, rule, or constraint mentioned in the RFQ.

        Your output MUST be a JSON array of objects, where each object details one compliance measure.

        **JSON SCHEMA:**
        [
            {
                "requirement_summary": "A concise summary of the specific rule from the RFQ.",
                "proposal_excerpt": "The exact quote from the Proposal addressing the requirement.",
                "compliance_status": "COMPLIANT" | "PARTIALLY COMPLIANT" | "NON-COMPLIANT",
                "actionable_insight": "If the status is not COMPLIANT, provide a 1-sentence instruction on how to fix or improve the proposal."
            }
        ]
        
        Ensure your response is ONLY the JSON array. Do not include any introductory or concluding text, or markdown formatting outside of the JSON structure itself.`;
        
        // The prompt sends the instruction, the files, and a final instruction to execute
        const promptParts = [
            systemInstruction,
            "RFQ Document (Rules): ",
            rfqPart,
            "Proposal Document (Response): ",
            proposalPart,
            "Analyze the Proposal Document based on the RFQ Document and return the analysis EXCLUSIVELY as the JSON array defined in the System Instruction."
        ];

        // 5. Call the Gemini API
        const response = await ai.models.generateContent({
            model: model,
            contents: promptParts,
            config: {
                // Force the model to return JSON that matches the schema
                responseMimeType: "application/json",
                responseSchema: {
                    type: "ARRAY",
                    items: {
                        type: "OBJECT",
                        properties: {
                            "requirement_summary": { "type": "STRING", "description": "Summary of the rule from the RFQ." },
                            "proposal_excerpt": { "type": "STRING", "description": "Quote from the proposal that responds to the rule." },
                            "compliance_status": { "type": "STRING", "enum": ["COMPLIANT", "PARTIALLY COMPLIANT", "NON-COMPLIANT"] },
                            "actionable_insight": { "type": "STRING", "description": "Instruction to fix if not compliant." }
                        },
                        required: ["requirement_summary", "proposal_excerpt", "compliance_status", "actionable_insight"]
                    }
                }
            }
        });

        // The response text is guaranteed to be a JSON string due to responseMimeType
        const complianceData = JSON.parse(response.text);

        // 6. Send Success Response
        res.json({ success: true, analysis: complianceData });

    } catch (error) {
        // Log the detailed error to the console
        console.error('Compliance Check Error:', error);
        
        // Send a generic 500 error to the client
        res.status(500).json({ 
            success: false, 
            error: 'An internal server error occurred during the compliance check. Check file formats and server logs.' 
        });
    }
});

// --- Start Server ---
// CRITICAL FIX: The server MUST listen on '0.0.0.0' for Render
const host = '0.0.0.0'; 
app.listen(port, host, () => {
    console.log(`Server listening at http://${host}:${port}`);
});