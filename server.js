const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { parsePDF } = require('./parser');
const { generateExcel } = require('./excel');

const app = express();
const upload = multer({
  dest: 'uploads/',
  fileFilter: (req, file, cb) => {
    const ok = file.mimetype === 'application/pdf' || path.extname(file.originalname).toLowerCase() === '.pdf';
    cb(null, ok);
  },
  limits: { fileSize: 50 * 1024 * 1024 }
});

app.use(express.static(path.join(__dirname, 'public')));

app.post('/extract', upload.single('pdf'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'PDF 파일을 업로드해주세요.' });
  }

  const filePath = req.file.path;

  try {
    const buffer = fs.readFileSync(filePath);
    const shipments = await parsePDF(buffer);

    if (shipments.length === 0) {
      return res.status(400).json({ error: '선적 데이터를 추출하지 못했습니다. PDF 형식을 확인해주세요.' });
    }

    const excelBuffer = generateExcel(shipments);
    const baseName = path.parse(req.file.originalname).name;
    const outName = encodeURIComponent(baseName + '_추출.xlsx');

    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${outName}`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(excelBuffer);
  } catch (err) {
    console.error('처리 오류:', err);
    res.status(500).json({ error: '처리 중 오류: ' + err.message });
  } finally {
    try { fs.unlinkSync(filePath); } catch (_) {}
  }
});

app.post('/preview', upload.single('pdf'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  const filePath = req.file.path;
  try {
    const buffer = fs.readFileSync(filePath);
    const shipments = await parsePDF(buffer);
    res.json({ shipments });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    try { fs.unlinkSync(filePath); } catch (_) {}
  }
});

const PORT = 3100;
app.listen(PORT, () => {
  console.log(`서버 실행 중: http://localhost:${PORT}`);
});
