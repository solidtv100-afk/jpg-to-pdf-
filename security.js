import { fileTypeFromBuffer } from 'file-type';

export async function validateJPEG(chunk) {
  const type = await fileTypeFromBuffer(chunk);
  if (!type || type.mime !== 'image/jpeg') {
    throw new Error('Invalid JPEG');
  }
}
