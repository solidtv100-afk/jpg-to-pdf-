import sharp from 'sharp';

const A4_WIDTH_PX = 2480;
const A4_HEIGHT_PX = 3508;

export async function processImage(readable) {
  const image = sharp();

  readable.pipe(image);

  const metadata = await image.metadata();

  if (metadata.space === 'cmyk') {
    throw new Error('CMYK images are not allowed');
  }

  return sharp(readable)
    .rotate(false)
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
}
