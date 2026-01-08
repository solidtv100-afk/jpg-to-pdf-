import Fastify from "fastify";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import cors from "@fastify/cors";
import sharp from "sharp";
import PDFDocument from "pdfkit";

/* ================================
   FASTIFY INSTANCE
================================ */
const fastify = Fastify({
  logger: true,
  bodyLimit: 10 * 1024 * 1024 // 10 MB
});

/* ================================
   CORS (ALLOW FRONTEND)
   - Safe for GitHub Pages
   - Prevents silent browser block
================================ */
await fastify.register(cors, {
  origin: true
});

/* ================================
   RATE LIMIT (TESTING + PROD SAFE)
   - Prevents abuse
   - Does NOT break mobile testing
================================ */
await fastify.register(rateLimit, {
  max: 20,               // allow retries
  timeWindow: "1 minute",
  ban: 0                 // never auto-ban
});

/* ================================
   MULTIPART (FILE UPLOAD)
================================ */
await fastify.register(multipart, {
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB
    files: 1
  }
});

/* ================================
   HEALTH CHECK
================================ */
fastify.get("/", async () => {
  return {
    status: "ok",
    service: "jpg-to-pdf",
    message: "JPG to PDF API is running"
  };
});

/* ================================
   JPG → PDF CONVERSION (CRASH-FREE)
================================ */
fastify.post("/convert", async (req, reply) => {
  try {
    const file = await req.file();

    // Validate file existence & type
    if (
      !file ||
      !["image/jpeg", "image/jpg"].includes(file.mimetype)
    ) {
      return reply.code(400).send("Only JPG images are allowed");
    }

    // Safe: convert stream → buffer
    const inputBuffer = await file.toBuffer();

    // Sharp handles validation internally
    const imageBuffer = await sharp(inputBuffer)
      .resize(2480, 3508, {
        fit: "contain",
        background: "white"
      })
      .jpeg({ quality: 90 })
      .toBuffer();

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
    console.error("CONVERSION ERROR:", err);
    reply.code(500).send("PDF generation failed");
  }
});

/* ================================
   START SERVER (RENDER SAFE)
================================ */
const PORT = process.env.PORT || 10000;

fastify.listen({
  port: PORT,
  host: "0.0.0.0"
});
