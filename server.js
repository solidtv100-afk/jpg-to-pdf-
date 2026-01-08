import Fastify from 'fastify';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import cors from '@fastify/cors';
import sharp from 'sharp';
import PDFDocument from 'pdfkit';

/* ===============================
   SERVER
================================ */

const fastify = Fastify({
  logger: false,
  bodyLimit: 10 * 1024 * 1024
});

/* ===============================
   CORS (LOCKED)
================================ */

await fastify.register(cors, {
  origin: 'https://solidtv100-afk.github.io',
  methods: ['POST']
});

/* ===============================
   RATE LIMIT
================================ */

await fastify.register(rateLimit, {
  max: 1,
  timeWindow: '45 seconds'
});

/* ===============================
   MULTIPART
================================ */

await fastify.register(multipart, {
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 1
  }
});

/* ===============================
   CONSTANTS
================================ */

const A4_WIDTH_PX = 2480;
const A4_HEIGHT_PX = 3508;

/* ===============================
   ROUTE
================================ */

fastify.post('/convert', async (req, reply) => {
  const file = await req.file();

  if (!file || file.mimetype !== 'image/jpeg') {
    reply.code(400).send('Invalid file');
    return;
  }

  /* ---- Magic byte check ---- */
  const firstChunk = await file.file.read(3);
  if (!firstChunk || firstChunk[0] !== 0xff || firstChunk[1] !== 0xd8) {
    reply.code(400).send('Invalid JPEG');
    return;
  }
  file.file.unshift(firstChunk);

  /* ---- Sharp processing ---- */
  const image = sharp();
  file.file.pipe(image);

  const metadata = await image.metadata();
  if (metadata.space === 'cmyk') {
    reply.code(400).send('CMYK not allowed');
    return;
  }

  const buffer = await image
    .removeAlpha()
    .withMetadata({ density: 300 })
    .resize({
      width: A4_WIDTH_PX,
      height: A4_HEIGHT_PX,
      fit: 'inside',
      withoutEnlargement: true
    })
    .jpeg({ quality: 85 })
    .toBuffer();

  /* ---- PDF streaming ---- */
  const pdf = new PDFDocument({
    size: 'A4',
    margin: 0
  });

  reply.header('Content-Type', 'application/pdf');
  reply.header(
    'Content-Disposition',
    'attachment; filename="converted.pdf"'
  );

  pdf.pipe(reply.raw);

  pdf.image(buffer, 0, 0, {
    fit: [595, 842],
    align: 'center',
    valign: 'center'
  });

  pdf.end();
});

/* ===============================
   START
================================ */

fastify.listen({
  port: process.env.PORT || 3000,
  host: '0.0.0.0'
});
