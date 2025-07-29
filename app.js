const express = require('express');
const multer = require('multer');
const csv = require('csv-parser');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

const upload = multer({ dest: 'uploads/' });

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use('/output', express.static(path.join(__dirname, 'output')));

app.get('/', (req, res) => {
  res.render('index');
});

app.post('/upload', upload.single('csvFile'), async (req, res) => {
  try {
    const width = parseInt(req.body.width) || 300;
    const colorDark = req.body.colorDark || '#000000';
    const colorLight = req.body.colorLight || '#ffffff';

    const results = [];
    fs.createReadStream(req.file.path)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', async () => {
        for (const row of results) {
          if (!row.filename || !row.url) continue;
          const filePath = path.join(__dirname, 'output', `${row.filename}.png`);
          await QRCode.toFile(filePath, row.url, {
            width,
            margin: 4,
            errorCorrectionLevel: 'H',
            color: {
              dark: colorDark,
              light: colorLight
            }
          });
        }
        fs.unlinkSync(req.file.path);
        res.json({ success: true, message: 'QR codes generated!' });
      });
  } catch (err) {
    console.error("Upload failed:", err);
    res.status(500).send("Something went wrong while processing the CSV.");
  }
});

app.post('/generate', async (req, res) => {
  const { url, filename, format, width, colorDark, colorLight } = req.body;
  const qrWidth = parseInt(width) || 300;
  const dark = colorDark || '#000000';
  const light = colorLight || '#ffffff';
  const filePath = path.join(__dirname, 'output', `${filename}.${format}`);

  try {
    if (format === 'svg') {
      const svg = await QRCode.toString(url, {
        type: 'svg',
        margin: 4,
        width: qrWidth,
        errorCorrectionLevel: 'H',
        color: {
          dark,
          light
        }
      });
      fs.writeFileSync(filePath, svg);
    } else {
      await QRCode.toFile(filePath, url, {
        width: qrWidth,
        margin: 4,
        errorCorrectionLevel: 'H',
        color: {
          dark,
          light
        }
      });
    }
    res.json({ success: true, download: `${filename}.${format}` });
  } catch (err) {
    console.error("Generation failed:", err);
    res.status(500).json({ error: 'Failed to generate QR code.' });
  }
});

app.get('/gallery', (req, res) => {
  const dirPath = path.join(__dirname, 'output');
  fs.readdir(dirPath, (err, files) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to load gallery.' });
    }
    const imageFiles = files.filter(f => f.endsWith('.png') || f.endsWith('.svg'));
    res.json(imageFiles);
  });
});

app.listen(PORT, () => console.log(`✅ QR Generator running on http://localhost:${PORT}`));
