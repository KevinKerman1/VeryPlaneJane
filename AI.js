// AI.jss
import OpenAI from 'openai';
import dotenv from 'dotenv';
import { z } from "zod";

dotenv.config();

const client = new OpenAI({
    apiKey: process.env.OpenAI_API_KEY,
});

const DocumentSchema = z.object({
    DocumentType: z.enum([
        "Scope",
        "Estimate",
        "Quick Measure",
        "Eagle View",
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
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: `Follow these steps to analyze insurance documents efficiently:

1. DOCUMENT CLASSIFICATION:
- Analyze ONLY the first two pages to determine DocumentType
- Special Rule: Estimates from 'AdjustPro Solutions LLC' = 'Estimate', others = 'Scope'

2. FIELD EXTRACTION RULES:
• Scope/Estimate/Intake: ALL fields
• Quick Measure/Eagle View: ONLY LossLocationAddress
• Check: ONLY ClaimNumber
• Correspondence: ClaimNumber + PolicyNumber

3. PROCESSING LOGIC:
- STOP analyzing after finding all required fields for DocumentType
- If needed, continue past page 2 ONLY for missing required fields
- Never process more pages than necessary

4. OUTPUT REQUIREMENTS:
- Exclude null/missing fields from JSON
- Strictly follow DocumentType field requirements

Respond with this exact JSON structure:
{
    "DocumentType": "...",
    "Identifier": { ... } // ONLY include relevant fields
}`
                        },
                        ...imageMessages,
                    ],
                },
            ],
        });

        const rawContent = response.choices[0].message.content;
        const cleanedContent = rawContent.replace(/```json|```/g, '');
        const data = JSON.parse(cleanedContent);
        const parsedData = DocumentSchema.parse(data);
        
        res.json(parsedData);

    } catch (error) {
        console.error("Error sending images to OpenAI:", error);
        res.status(500).send({ message: 'An error occurred while communicating with OpenAI.' });
    }
}