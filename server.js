import Fastify from 'fastify';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import { validateJPEG } from './security.js';
import { processImage } from './image.js';
import { createPDF } from './pdf.js';
import { rateLimitConfig } from './rateLimit.js';

const fastify = Fastify({
  logger: false,
  bodyLimit: 10 * 1024 * 1024
});

await fastify.register(multipart, {
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 1
  }
});

await fastify.register(rateLimit, rateLimitConfig);

fastify.post('/convert', async (req, reply) => {
  const data = await req.file();

  if (!data) {
    reply.code(400).send('No file uploaded');
    return;
  }

  if (data.mimetype !== 'image/jpeg') {
    reply.code(400).send('Only JPG allowed');
    return;
  }

  const firstChunk = await data.file.read(4100);
  await validateJPEG(firstChunk);

  data.file.unshift(firstChunk);

  const imageBuffer = await processImage(data.file);

  const filename = `Topic_MainKeyword_Author_${new Date()
    .toISOString()
    .slice(0, 10)}.pdf`;

  createPDF(imageBuffer, reply.raw, filename);
});

fastify.listen({
  port: process.env.PORT || 3000,
  host: '0.0.0.0'
});
