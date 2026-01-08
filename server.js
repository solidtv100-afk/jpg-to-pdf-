import Fastify from "fastify";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import cors from "@fastify/cors";
import sharp from "sharp";
import PDFDocument from "pdfkit";
import { PassThrough } from "stream";

/* ================================
   FASTIFY SETUP
================================ */
const fastify = Fastify({
  logger: true,
  bodyLimit: 10 * 1024 * 1024 // 10 MB
});

/* ================================
   CORS (SAFE)
================================ */
await fastify.register(cors, {
  origin: true
});

/* ================================
   RATE LIMIT (TEST SAFE)
================================ */
await fastify.register(rateLimit, {
  max: 20,
  timeWindow: "1 minute",
  ban: 0
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
   HEALTH CHECK
================================ */
fastify.get("/", async () => ({
  status: "ok",
  service: "jpg-to-pdf",
  message: "JPG to PDF API is running"
}));

/* ================================
   JPG → PDF (CRASH-FREE)
================================ */
fastify.post("/convert", async (req, reply) => {
  try {
    const file = await req.file();

    if (
      !file ||
      !["image/jpeg", "image/jpg"].includes(file.mimetype)
    ) {
      return reply.code(400).send("Only JPG images are allowed");
    }

    // Read file safely
    const inputBuffer = await file.toBuffer();

    // Image processing (Sharp validates image)
    const imageBuffer = await sharp(inputBuffer)
      .resize(2480, 3508, {
        fit: "contain",
        background: "white"
      })
      .jpeg({ quality: 90 })
      .toBuffer();

    // Build PDF into memory buffer (SAFE)
    const pdfBuffer = await new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: "A4", margin: 0 });
      const stream = new PassThrough();
      const chunks = [];

      stream.on("data", (chunk) => chunks.push(chunk));
      stream.on("end", () => resolve(Buffer.concat(chunks)));
      stream.on("error", reject);

      doc.pipe(stream);
      doc.image(imageBuffer, 0, 0, {
        width: 595.28,
        height: 841.89
      });
      doc.end();
    });

    // Let Fastify send the response (IMPORTANT)
    return reply
      .header("Content-Type", "application/pdf")
      .header(
        "Content-Disposition",
        'attachment; filename="image.pdf"'
      )
      .send(pdfBuffer);

  } catch (err) {
    console.error("CONVERT ERROR:", err);
    return reply.code(500).send("PDF generation failed");
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
