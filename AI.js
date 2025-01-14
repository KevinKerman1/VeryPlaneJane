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
                    role: "user",
                    content: [
                      {
                        type: "text",
                        text: `Classify the type of document and extract a unique identifier if possible. 
                        Respond in the following structured JSON format:

                        {
                            "DocumentType": "<One of: Scope, Estimate, Quick Measure, Eagle view, Check, Correspondence, Image, Intake, Unidentifiable>",
                            "Identifier": {
                                "PolicyNumber": "<Policy Number if available>",
                                "ClaimNumber": "<Claim Number if available>",
                                "InsuredName": "<Name of the Insured if available>",
                                "InsuredPhone": "<Phone Number of the Insured if available>",
                                "InsuredEmail": "<Email of the Insured if available>",
                                "LossLocationAddress": "<Loss Location Address if available>"
                                "Carrier": "<Carrier/Insurance Company Name if available>"
                            }
                        }

                        Notes:
                        1. If the document cannot be identified, set "DocumentType" to "Unidentifiable".
                        2. If no identifier can be extracted, set "Identifier" to null.
                        3. Ensure the response follows the exact JSON format.
                        4. If an estimate was written by the company "AdjustPro Solutions LLC" set "DocumentType" to "Estimate", if the estimate was not written by "AdjustPro Solutions LLC" (It was instead written by for example, state farm, farmers, travlers...) set "DocumentType" to "Scope"`,
                },
                ...imageMessages,
              ],
            },
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
