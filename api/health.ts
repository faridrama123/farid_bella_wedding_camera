import type { IncomingMessage, ServerResponse } from 'node:http';
import { HeadBucketCommand, S3Client } from '@aws-sdk/client-s3';

function sendJson(res: ServerResponse, statusCode: number, data: unknown) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}

export default async function handler(_req: IncomingMessage, res: ServerResponse) {
  try {
    const endpoint = process.env.S3_ENDPOINT || 'https://nos.wjv-1.neo.id';
    const bucket = process.env.S3_BUCKET || 'wedding';
    const region = process.env.S3_REGION || 'us-east-1';
    const accessKeyId = process.env.S3_ACCESS_KEY || '';
    const secretAccessKey = process.env.S3_SECRET_KEY || '';

    if (!accessKeyId || !secretAccessKey) {
      sendJson(res, 500, {
        ok: false,
        error: 'S3_ACCESS_KEY dan S3_SECRET_KEY belum diatur di Environment Variables Vercel.',
        hasAccessKey: Boolean(accessKeyId),
        hasSecretKey: Boolean(secretAccessKey),
      });
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

    await s3.send(new HeadBucketCommand({ Bucket: bucket }));
    sendJson(res, 200, { ok: true, bucket, endpoint });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'S3 connection failed';
    sendJson(res, 500, { ok: false, error: message });
  }
}
