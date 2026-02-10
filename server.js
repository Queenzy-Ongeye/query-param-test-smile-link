import express from "express";
import axios from "axios";
import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";
import dotenv from "dotenv";
dotenv.config();


const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


const PORT = 3000;

// ENV vars (use .env in real projects)
const SMILE_ID_API_KEY = process.env.SMILE_API_KEY;
const SMILE_ID_PARTNER_ID = process.env.SMILE_PARTNER_ID;
const SMILE_ID_BASE_URL = process.env.SMILE_BASE_URL;

console.log("SMILE_ID_API_KEY:", process.env.SMILE_API_KEY);
console.log("SMILE_ID_PARTNER_ID:", process.env.SMILE_PARTNER_ID);

function generateSignature(timestamp) {
    // Message order: <ISO_TIMESTAMP><PARTNER_ID>sid_request
    const message = timestamp + SMILE_ID_PARTNER_ID + "sid_request";

    return crypto
        .createHmac("sha256", SMILE_ID_API_KEY)
        .update(message)
        .digest("base64"); // MUST be base64, not hex
}


app.get("/", (req, res) => {
    res.send("Smile Links server is running ✅");
});

app.post("/create-smile-link", async (req, res) => {
    res.status(405).send("Use POST to create Smile Link");
    try {
        const timestamp = new Date().toISOString();
        const signature = generateSignature(timestamp);

        const payload = {
            partner_id: SMILE_ID_PARTNER_ID,
            timestamp: timestamp,
            signature: signature,
            name: "General Onboarding Link",   // Required: Name for tracking in Portal
            company_name: "MyCompany Ltd",     // Required
            callback_url: process.env.CALLBACK_URL, // Required for links
            data_privacy_policy_url: "https://mycompany.com", // Required
            is_single_use: false,              // SET TO FALSE for multi-use
            id_types: [
                {
                    country: "KE",             // Use ISO code
                    id_type: "ALIEN_CARD",
                    verification_method: "biometric_kyc"
                }
            ]
        };




        const response = await axios.post(
            `${process.env.SMILE_BASE_URL}/v2/smile_links`,
            payload,
            { headers: { "Content-Type": "application/json" } }
        );

        res.json(response.data);
    } catch (error) {
        console.error("Smile API full error:", {
            status: error.response?.status,
            data: error.response?.data,
            message: error.message
        });

        res.status(500).json({
            error: error.response?.data || error.message
        });
    }

});

app.post("/webhook", (req, res) => {
    if (!req.body || Object.keys(req.body).length === 0) {
        console.log("Webhook received empty body");
        return res.status(200).send("OK");
    }

    console.log("Webhook received body:", req.body);
    res.status(200).send("OK");
});


// Replicating error
app.post("/create-registration-link", async (req, res) => {
    try {
        const timestamp = new Date().toISOString();
        const signature = generateSignature(timestamp);
        const uniqueUserId = `user_${uuidv4()}`; // Generate unique ID for this user

        const payload = {
            partner_id: SMILE_ID_PARTNER_ID,
            timestamp: timestamp,
            signature: signature,
            name: "User Registration Link",
            company_name: "MyCompany Ltd",
            callback_url: process.env.CALLBACK_URL,
            data_privacy_policy_url: "https://mycompany.com",

            // REDIRECT SETTINGS
            is_single_use: true,
            user_id: uniqueUserId,
            redirect_url: "https://mycompany.com", // Your redirect destination

            id_types: [
                {
                    country: "KE",
                    id_type: "ALIEN_CARD",
                    verification_method: "biometric_kyc"
                }
            ]
        };

        const response = await axios.post(
            `${SMILE_ID_BASE_URL}/v2/smile_links`,
            payload,
            { headers: { "Content-Type": "application/json" } }
        );

        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: error.response?.data || error.message });
    }
});

app.post("/test-bug-recreation", async (req, res) => {
    try {
        const timestamp = new Date().toISOString();
        const signature = generateSignature(timestamp);

        const payload = {
            partner_id: SMILE_ID_PARTNER_ID,
            timestamp: timestamp,
            signature: signature,
            name: "Bug Recreation Test",
            company_name: "MyCompany Ltd",
            callback_url: process.env.CALLBACK_URL,
            data_privacy_policy_url: "https://mycompany.com",
            is_single_use: true,
            uuser_id: "b521b812-a875-4593-978a-37468a9298fc",
            redirect_url: "http://localhost:3000/app/onboarding/identity-verification2",
            id_types: [{
                country: "KE",
                id_type: "ALIEN_CARD",
                verification_method: "biometric_kyc"
            }]
        };

        const response = await axios.post(
            `${SMILE_ID_BASE_URL}/v2/smile_links`,
            payload
        );

        // LOG THE FULL RESPONSE TO SEE ALL FIELDS
        console.log("Full Smile ID Response:", response.data);

        res.json({
            message: "Link generated. Open this URL and then click 'Cancel' to see the bug.",
            // Try both common field names
            link: response.data.link_url || response.data.link || "Link not found in response",
            full_response: response.data
        });
    } catch (error) {
        console.error("Error Detail:", error.response?.data);
        res.status(500).json(error.response?.data || error.message);
    }
});

// app.get("/app/onboarding/identity-verification2", (req, res) => {
//     console.log("🔔 Redirect Route Hit!");
//     console.log("Query Params Received:", req.query);

//     const { status, user_id, onboarding } = req.query;

//     // This HTML will show you exactly what happened to your URL
//     res.send(`
//         <div style="font-family: sans-serif; padding: 20px;">
//             <h2>Redirect Result</h2>
//             <p><strong>Status:</strong> ${status}</p>
//             <p><strong>User ID (from Smile):</strong> ${user_id}</p>
//             <p><strong>Onboarding ID (from original URL):</strong> ${onboarding}</p>
//             <hr>
//             <p>Check your terminal to see if the URL was malformed!</p>
//             <a href="/create-registration-link">Try Again</a>
//         </div>
//     `);
// });

app.get("/app/onboarding/identity-verification2", (req, res) => {
    const { status, user_id, timestamp } = req.query;
    
    // SIMULATE TIMEOUT: If the redirect took more than 5 minutes since link creation
    const now = new Date();
    const linkCreatedAt = new Date(timestamp); // You'd need to pass this or look it up
    const diffMinutes = (now - linkCreatedAt) / 1000 / 60;

    if (diffMinutes > 5) {
        return res.status(408).send("<h1>Session Expired</h1><p>You took too long to verify. Please restart.</p>");
    }

    if (status === "cancelled") {
        return res.send("<h1>Verification Cancelled</h1><p>You clicked the cancel button.</p>");
    }

    res.send(`<h1>Status: ${status}</h1>`);
});



app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
});
