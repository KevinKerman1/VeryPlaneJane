// index.js
import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { pdf } from 'pdf-to-img';
import { sendToOpenAI } from './AI.js';

const app = express();
const port = 3000;

// Multer setup for handling file uploads
const upload = multer({ dest: 'uploads/' });

// Route to handle PDF to image conversion
app.post('/convert-pdf', upload.single('data'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send({ message: 'No PDF file provided!' });
    }

    const pdfPath = req.file.path;
    const outputDir = path.join('uploads', 'images');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir);
    }

    // Convert PDF to images with high-quality settings
    const document = await pdf(pdfPath, { scale: 3 });
    const base64Images = [];

    let counter = 1;
    for await (const imageBuffer of document) {
      const imagePath = path.join(outputDir, `page${counter}.png`);
      fs.writeFileSync(imagePath, imageBuffer);

      // Convert each image to base64 and store it in an array
      const base64Image = fs.readFileSync(imagePath, { encoding: 'base64' });
      base64Images.push(base64Image);
      counter++;
    }

    // Send all base64 images to OpenAI API
    await sendToOpenAI(base64Images, res);

    console.log(`Images saved and processed: ${base64Images.length} pages`);

    // Cleanup uploaded PDF
    fs.unlinkSync(pdfPath);
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: 'An error occurred while converting the PDF.' });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
