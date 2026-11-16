import type { IncomingMessage, ServerResponse } from 'node:http';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';

function isImageKey(key: string): boolean {
  return /\.(jpe?g|png|webp)$/i.test(key);
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    const endpoint = process.env.S3_ENDPOINT || 'https://nos.wjv-1.neo.id';
    const bucket = process.env.S3_BUCKET || 'wedding';
    const region = process.env.S3_REGION || 'us-east-1';
    const accessKeyId = process.env.S3_ACCESS_KEY || '';
    const secretAccessKey = process.env.S3_SECRET_KEY || '';

    if (!accessKeyId || !secretAccessKey) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: 'S3 credentials not configured.' }));
      return;
    }

    const requestUrl = new URL(req.url || '/', 'http://localhost');
    const key = requestUrl.searchParams.get('key') || '';

    if (!key || !key.startsWith('farid-bella/') || key.includes('..') || !isImageKey(key)) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: 'Key foto tidak valid.' }));
      return;
    }

    const s3 = new S3Client({
      region,
      endpoint,
      forcePathStyle: true,
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
      credentials: { accessKeyId, secretAccessKey },
    });

    const objectResponse = await s3.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      })
    );

    const body = objectResponse.Body;
    if (!body || typeof body.transformToByteArray !== 'function') {
      res.statusCode = 404;
      res.end('Foto tidak ditemukan.');
      return;
    }

    const bytes = await body.transformToByteArray();
    res.statusCode = 200;
    res.setHeader('Content-Type', objectResponse.ContentType || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.end(Buffer.from(bytes));
  } catch (error) {
    console.error('Error fetching photo from Neo S3:', error);
    res.statusCode = 404;
    res.end('Foto tidak ditemukan.');
  }
}
