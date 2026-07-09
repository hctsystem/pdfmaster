const express = require('express');
const cors = require('cors');
const multer = require('multer');
const libre = require('libreoffice-convert');
const path = require('path');
const fs = require('fs');
const { promisify } = require('util');

const libreConvertAsync = promisify(libre.convert);

const app = express();
app.use(cors());

// Configure multer for in-memory storage (good for small/medium files, consider disk storage for large scales)
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

app.post('/api/convert/word-to-pdf', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded.' });
  }

  try {
    const ext = '.pdf';
    // The libreoffice-convert library requires the LibreOffice executable to be in the system PATH.
    // If LibreOffice is not installed, this will fail.
    console.log(`Converting ${req.file.originalname} to PDF...`);
    
    const pdfBuf = await libreConvertAsync(req.file.buffer, ext, undefined);
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${req.file.originalname.split('.')[0]}.pdf"`);
    res.send(pdfBuf);
    
  } catch (error) {
    console.error('Conversion error:', error);
    res.status(500).json({ 
      error: 'Conversion failed. Make sure LibreOffice is installed on the server.',
      details: error.message
    });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Conversion server running on http://localhost:${PORT}`);
  console.log('NOTE: LibreOffice must be installed on this machine for Word conversions to work.');
});
