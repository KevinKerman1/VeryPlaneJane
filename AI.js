// AI.jss
import OpenAI from 'openai';
import dotenv from 'dotenv';
import { z } from "zod";

dotenv.config();

const client = new OpenAI({
    apiKey: process.env.OpenAI_API_KEY,
});

// Define the expected response structure using zod
const DocumentSchema = z.object({
    DocumentType: z.enum([
        "Scope",
        "Estimate",
        "Quick Measure",
        "Eagle view",
        "Check",
        "Correspondence",
        "Image",
        "Intake",
        "Unidentifiable",
    ]),
    Identifier: z.object({
        PolicyNumber: z.string().nullable().optional().default(null),
        ClaimNumber: z.string().nullable().optional().default(null),
        InsuredName: z.string().nullable().optional().default(null),
        InsuredPhone: z.string().nullable().optional().default(null),
        InsuredEmail: z.string().nullable().optional().default(null),
        LossLocationAddress: z.string().nullable().optional().default(null),
        Carrier: z.string().nullable().optional().default(null),
    }).nullable(),
});

export async function sendToOpenAI(base64Images, res) {
    try {
        const imageMessages = base64Images.map((base64Image) => ({
            type: "image_url",
            image_url: { url: `data:image/jpeg;base64,${base64Image}` },
        }));

        const response = await client.chat.completions.create({
            model: "gpt-4o-mini",
            temperature: 0.1,
            messages: [
                {
                    type: "text",
                    text: `Classify the document type and extract the required unique identifier(s) from the document images provided.
You will receive an ordered list of page images (first image is page 1, second image is page 2, etc.). Begin by analyzing the first page, and if needed, the second page to determine the document type and extract the relevant data points.

For each document type, extract only the following data points:
- Scope: PolicyNumber, ClaimNumber, InsuredName, InsuredPhone, InsuredEmail, LossLocationAddress, Carrier.
- Estimate: PolicyNumber, ClaimNumber, InsuredName, InsuredPhone, InsuredEmail, LossLocationAddress, Carrier.
- Quick Measure: LossLocationAddress.
- Eagle view: LossLocationAddress.
- Check: ClaimNumber.
- Correspondence: ClaimNumber, PolicyNumber.
- Intake: PolicyNumber, ClaimNumber, InsuredName, InsuredPhone, InsuredEmail, LossLocationAddress, Carrier.

Once you have identified the document type and extracted all required data points from the first two pages, immediately respond with the structured JSON (without analyzing any remaining pages). Only if the necessary data points are missing should you proceed to examine additional pages.

Additional notes:
1. If the document is an estimate written by "AdjustPro Solutions LLC", set "DocumentType" to "Estimate". If it is written by another company (e.g., State Farm, Farmers, Travelers, etc.), set it to "Scope".
2. If no unique identifier can be extracted, set "Identifier" to null.
3. If the document cannot be classified, set "DocumentType" to "Unidentifiable".
4. Strictly adhere to the JSON format provided below.

Respond exactly in the following JSON format:

{
    "DocumentType": "<One of: Scope, Estimate, Quick Measure, Eagle view, Check, Correspondence, Image, Intake, Unidentifiable>",
    "Identifier": {
        "PolicyNumber": "<Policy Number if available>",
        "ClaimNumber": "<Claim Number if available>",
        "InsuredName": "<Insured Name if available>",
        "InsuredPhone": "<Insured Phone if available>",
        "InsuredEmail": "<Insured Email if available>",
        "LossLocationAddress": "<Loss Location Address if available>",
        "Carrier": "<Carrier if available>"
    }
}`
                },
                ...imageMessages,
            ],
        });

        // Clean up response content to ensure it's valid JSON
        const rawContent = response.choices[0].message.content;
        const cleanedContent = rawContent.replace(/```json|```/g, ''); // Remove ```json and ``` markers

        const data = JSON.parse(cleanedContent); // Parse the cleaned JSON response

        // Validate against the schema
        const parsedData = DocumentSchema.parse(data);
        res.json(parsedData);

    } catch (error) {
        console.error("Error sending images to OpenAI:", error);
        res.status(500).send({ message: 'An error occurred while communicating with OpenAI.' });
    }
}
