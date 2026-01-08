import PDFDocument from 'pdfkit';

export function createPDF(imageBuffer, res, filename) {
  const doc = new PDFDocument({
    size: 'A4',
    margin: 0
  });

  res.header('Content-Type', 'application/pdf');
  res.header(
    'Content-Disposition',
    `attachment; filename="${filename}"`
  );

  doc.pipe(res);

  doc.image(imageBuffer, 0, 0, {
    fit: [595, 842],
    align: 'center',
    valign: 'center'
  });

  doc.end();
}
