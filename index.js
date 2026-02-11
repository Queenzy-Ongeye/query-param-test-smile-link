import express from "express";
import axios from "axios";
import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";
import dotenv from "dotenv";
import { log } from "console";
dotenv.config();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = 3000;
const SMILE_ID_API_KEY = process.env.SMILE_API_KEY;
const SMILE_ID_PARTNER_ID = process.env.SMILE_PARTNER_ID;
const SMILE_ID_BASE_URL = process.env.SMILE_BASE_URL;

/**
 * FIX: Sanitizer to prevent the "Double ?" Bug
 * Splits a URL into a clean base and extracts the query ID.
 */
function sanitizeRedirectUrl(inputUrl) {
    try {
        const parsed = new URL(inputUrl);
        // Extract the onboarding ID if it exists in the query string
        const onboardingId = parsed.searchParams.get("onboarding");

        // Wipe the query string clean for Smile ID
        parsed.search = "";

        return {
            cleanUrl: parsed.toString().replace(/\/$/, ""),
            onboardingId: onboardingId || `user_${uuidv4()}` // Fallback to new UUID
        };
    } catch (e) {
        return { cleanUrl: inputUrl, onboardingId: `user_${uuidv4()}` };
    }
}

function generateSignature(timestamp) {
    const message = timestamp + SMILE_ID_PARTNER_ID + "sid_request";
    return crypto.createHmac("sha256", SMILE_ID_API_KEY).update(message).digest("base64");
}

// 1. Create Registration Link (The Logic the Client Needs)
app.post("/create-registration-link", async (req, res) => {
    try {
        // 1. SAFELY extract the URL. Optional chaining (?.) prevents the "undefined" crash.
        const providedUrl = req.body?.redirect_url;
        const defaultUrl = "http://localhost:3000/app/onboarding/identity-verification2?onboarding";

        const targetUrl = providedUrl || defaultUrl;

        // 2. Sanitize the chosen URL
        const { cleanUrl, onboardingId } = sanitizeRedirectUrl(targetUrl);

        const timestamp = new Date().toISOString();
        const signature = generateSignature(timestamp);

        const payload = {
            partner_id: SMILE_ID_PARTNER_ID,
            timestamp: timestamp,
            signature: signature,
            name: "User Registration Link",
            company_name: "MyCompany Ltd",
            callback_url: process.env.CALLBACK_URL,
            data_privacy_policy_url: "https://mycompany.com",
            is_single_use: true,
            user_id: onboardingId,
            redirect_url: cleanUrl,
            id_types: [{
                country: "KE",
                id_type: "ALIEN_CARD",
                verification_method: "biometric_kyc"
            }]
        };
        console.log(onboardingId);
        console.log(cleanUrl);

        const response = await axios.post(`${SMILE_ID_BASE_URL}/v2/smile_links`, payload);
        res.json(response.data);
    } catch (error) {
        console.error("Error generating link:", error.message);
        res.status(500).json({ error: error.response?.data || error.message });
    }
});


// 2. The Redirect Handler (What the user sees after Cancel/Success)
app.get("/app/onboarding/identity-verification2", (req, res) => {
    // 1. Extract the parameters Smile ID actually sends back
    const { status, user_id } = req.query;

    // 2. Map user_id back to your 'onboarding' variable
    const onboarding = user_id;

    // 3. Check if we have the ID
    if (onboarding) {
        console.log(`Processing reference ID: ${onboarding}`);
    }

    if (status === "cancelled") {
        return res.send(`
            <div style="font-family:sans-serif; text-align:center; padding:50px;">
                <h2 style="color: #e74c3c;">Verification Cancelled</h2>
                <p>Onboarding ID: <strong>${onboarding}</strong></p>
                <button onclick="history.back()">Try Again</button>
            </div>
        `);
    }

    if (status === "successful" || status === "success") {
        return res.send(`
            <div style="font-family:sans-serif; text-align:center; padding:50px;">
                <h2 style="color: #27ae60;">Success!</h2>
                <p>User <strong>${onboarding}</strong> has been verified.</p>
            </div>
        `);
    }

    res.send(`<h2 style="color: #27ae60;">Verification Status: ${status || 'Unknown'}</h2>`);
});


// 3. Webhook (Final Result Verification)
app.post("/webhook", (req, res) => {
    console.log("🔔 Webhook Event:", req.body);
    // You should verify signature here using the [Smile ID Webhook Guide](url)
    res.status(200).send("OK");
});

app.listen(PORT, () => console.log(`🚀 Secure Server at http://localhost:${PORT}`));
