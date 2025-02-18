// AI.js
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
        // Prepare image messages from the base64 images provided
        const imageMessages = base64Images.map((base64Image) => ({
            type: "image_url",
            image_url: { url: `data:image/jpeg;base64,${base64Image}` },
        }));

        // Call the OpenAI API with our custom prompt
        const response = await client.chat.completions.create({
            model: "gpt-4o-mini",
            temperature: 0.1,
            messages: [
                {
                    role: "user",
                    content: `
You are a document classifier and data extractor. The images provided represent sequential pages of a document. Follow these instructions precisely:

1. **Initial Scan:** Begin by analyzing only the first two pages (images). Determine the document type from these pages.
2. **Data Extraction:** Based on the identified document type, extract only the required data points as listed below:

   - **Scope, Estimate, Intake:** PolicyNumber, ClaimNumber, InsuredName, InsuredPhone, InsuredEmail, LossLocationAddress, Carrier
   - **Quick Measure:** LossLocationAddress
   - **Eagle view:** LossLocationAddress
   - **Check:** ClaimNumber
   - **Correspondence:** ClaimNumber, PolicyNumber

   **Special Note:** If an estimate was written by "AdjustPro Solutions LLC", set DocumentType to "Estimate". If an estimate is identified but not written by AdjustPro Solutions LLC, set DocumentType to "Scope".

3. **Stop Condition:** 
   - If all required fields for the determined document type are found within the first two pages, ignore any additional pages and immediately respond with the results.
   - If some required fields are missing, continue scanning subsequent pages only until all required data is obtained (or until no more pages remain).

4. **Fallback:** If the document cannot be clearly identified, set DocumentType to "Unidentifiable" and Identifier to null.

5. **Response Format:** Return your answer strictly in the following JSON format without any additional commentary:

{
  "DocumentType": "<One of: Scope, Estimate, Quick Measure, Eagle view, Check, Correspondence, Image, Intake, Unidentifiable>",
  "Identifier": {
    "PolicyNumber": "<Policy Number if available>",
    "ClaimNumber": "<Claim Number if available>",
    "InsuredName": "<Insured Name if available>",
    "InsuredPhone": "<Insured Phone if available>",
    "InsuredEmail": "<Insured Email if available>",
    "LossLocationAddress": "<Loss Location Address if available>",
    "Carrier": "<Carrier/Insurance Company Name if available>"
  }
}

Additional Notes:
- If no identifier can be extracted, set "Identifier" to null.
- Do not include any extra text or explanation—only the JSON structure exactly as shown.

Proceed with the extraction based on these instructions.
`
                },
                ...imageMessages,
            ],
        });

        // Clean up response content to ensure it's valid JSON
        const rawContent = response.choices[0].message.content;
        const cleanedContent = rawContent.replace(/```json|```/g, ''); // Remove markdown markers if present

        const data = JSON.parse(cleanedContent); // Parse the cleaned JSON response

        // Validate the response against our schema
        const parsedData = DocumentSchema.parse(data);
        res.json(parsedData);

    } catch (error) {
        console.error("Error sending images to OpenAI:", error);
        res.status(500).send({ message: 'An error occurred while communicating with OpenAI.' });
    }
}
