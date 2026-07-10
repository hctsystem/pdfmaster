const express = require('express');
const cors = require('cors');
const multer = require('multer');
const libre = require('libreoffice-convert');
const path = require('path');
const { promisify } = require('util');

// Promisify convertWithOptions so we can pass fileName extension options
const libreConvertAsync = promisify(libre.convertWithOptions);

const app = express();
app.use(cors());

// Configure multer for in-memory storage (up to 50MB file size limit)
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }
});

// Reusable document conversion controller
async function handleConversion(req, res, outputFormat) {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded.' });
  }

  // Ensure format has no leading dot for LibreOffice filter matching (e.g. "docx" instead of ".docx")
  const format = outputFormat.replace(/^\./, '');
  const dotExt = `.${format}`;

  try {
    console.log(`Converting ${req.file.originalname} to format: ${format}...`);
    
    // Convert document bytes using LibreOffice with correct source filename and extension
    const convertedBuf = await libreConvertAsync(
      req.file.buffer,
      format,
      undefined,
      { fileName: req.file.originalname }
    );
    
    // Retrieve root filename without the extension
    const baseName = path.parse(req.file.originalname).name;
    
    // Choose appropriate Content-Type header based on target format
    let contentType = 'application/octet-stream';
    if (format === 'pdf') {
      contentType = 'application/pdf';
    } else if (format === 'docx') {
      contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    } else if (format === 'pptx') {
      contentType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    } else if (format === 'xlsx') {
      contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${baseName}${dotExt}"`);
    res.send(convertedBuf);
    
  } catch (error) {
    console.error(`Conversion to ${format} failed:`, error);
    res.status(500).json({ 
      error: 'Conversion failed. Please try again.',
      details: error.message
    });
  }
}

// ─── Convert TO PDF Endpoints ─────────────────────────────────────
app.post('/api/convert/word-to-pdf', upload.single('file'), (req, res) => {
  handleConversion(req, res, 'pdf');
});

app.post('/api/convert/ppt-to-pdf', upload.single('file'), (req, res) => {
  handleConversion(req, res, 'pdf');
});

app.post('/api/convert/excel-to-pdf', upload.single('file'), (req, res) => {
  handleConversion(req, res, 'pdf');
});

// ─── Convert FROM PDF Endpoints ───────────────────────────────────
app.post('/api/convert/pdf-to-word', upload.single('file'), (req, res) => {
  handleConversion(req, res, 'docx');
});

app.post('/api/convert/pdf-to-ppt', upload.single('file'), (req, res) => {
  handleConversion(req, res, 'pptx');
});

app.post('/api/convert/pdf-to-excel', upload.single('file'), (req, res) => {
  handleConversion(req, res, 'xlsx');
});

// Server listener
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`PDFMaster conversion server running on http://localhost:${PORT}`);
  console.log('NOTE: LibreOffice must be installed on the system (or container) for conversions to run.');
});
