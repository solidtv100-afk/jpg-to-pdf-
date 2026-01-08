import Fastify from "fastify";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import cors from "@fastify/cors";
import sharp from "sharp";
import PDFDocument from "pdfkit";

/* ================================
   SERVER SETUP
================================ */
const fastify = Fastify({
  logger: false,
  bodyLimit: 10 * 1024 * 1024 // 10 MB
});

/* ================================
   CORS (LOCKED TO FRONTEND)
================================ */
await fastify.register(cors, {
  origin: "https://solidtv100-afk.github.io",
  methods: ["POST", "GET"]
});

/* ================================
   RATE LIMIT
================================ */
await fastify.register(rateLimit, {
  max: 1,
  timeWindow: "45 seconds"
});

/* ================================
   MULTIPART
================================ */
await fastify.register(multipart, {
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 1
  }
});

/* ================================
   CONSTANTS
================================ */
const A4_WIDTH_PX = 2480;
const A4_HEIGHT_PX = 3508;

/* ================================
   HEALTH CHECK ROUTE (IMPORTANT)
================================ */
fastify.get("/", async () => {
  return {
    status: "ok",
    service: "jpg-to-pdf",
    message: "JPG to PDF API is running"
  };
});

/* ================================
   JPG → PDF ROUTE
================================ */
fastify.post("/convert", async (req, reply) => {
  const file = await req.file();

  if (!file || file.mimetype !== "image/jpeg") {
    return reply.code(400).send("Only JPG images are allowed");
  }

  /* --- MAGIC BYTE CHECK --- */
  const header = await file.file.read(3);
  if (!header || header[0] !== 0xff || header[1] !== 0xd8) {
    return reply.code(400).send("Invalid JPG file");
  }
  file.file.unshift(header);

  try {
    /* --- SHARP PROCESSING --- */
    const imageBuffer = await sharp(await file.toBuffer())
      .resize(A4_WIDTH_PX, A4_HEIGHT_PX, {
        fit: "contain",
        background: "white"
      })
      .jpeg({ quality: 90 })
      .toBuffer();

    /* --- PDF GENERATION --- */
    const pdf = new PDFDocument({
      size: "A4",
      margin: 0
    });

    reply.header("Content-Type", "application/pdf");
    reply.header(
      "Content-Disposition",
      'attachment; filename="image.pdf"'
    );

    pdf.pipe(reply.raw);
    pdf.image(imageBuffer, 0, 0, {
      width: 595.28,
      height: 841.89
    });
    pdf.end();
  } catch (err) {
    reply.code(500).send("PDF generation failed");
  }
});

/* ================================
   START SERVER (RENDER SAFE)
================================ */
const PORT = process.env.PORT || 10000;

fastify.listen({ port: PORT, host: "0.0.0.0" });
