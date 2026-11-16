import type { IncomingMessage, ServerResponse } from 'node:http';
import { HeadObjectCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';

function sendJson(res: ServerResponse, statusCode: number, data: unknown) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}

function safeDecode(value: string | undefined, fallback = ''): string {
  if (!value) return fallback;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function isImageKey(key: string): boolean {
  return /\.(jpe?g|png|webp)$/i.test(key);
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method && req.method !== 'GET') {
    sendJson(res, 405, { error: 'Method not allowed', photos: [] });
    return;
  }

  try {
    const endpoint = process.env.S3_ENDPOINT || 'https://nos.wjv-1.neo.id';
    const bucket = process.env.S3_BUCKET || 'wedding';
    const region = process.env.S3_REGION || 'us-east-1';
    const accessKeyId = process.env.S3_ACCESS_KEY || '';
    const secretAccessKey = process.env.S3_SECRET_KEY || '';

    if (!accessKeyId || !secretAccessKey) {
      sendJson(res, 500, {
        error: 'S3_ACCESS_KEY dan S3_SECRET_KEY belum diatur di Environment Variables Vercel.',
        photos: [],
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

    const listResult = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: 'farid-bella/',
        MaxKeys: 250,
      })
    );

    const contents = (listResult.Contents || [])
      .filter((obj) => obj.Key && isImageKey(obj.Key) && (obj.Size || 0) > 0)
      .sort((a, b) => {
        const timeA = a.LastModified ? a.LastModified.getTime() : 0;
        const timeB = b.LastModified ? b.LastModified.getTime() : 0;
        return timeB - timeA;
      });

    const photos = await Promise.all(
      contents.map(async (obj) => {
        const key = obj.Key!;
        let guestName = 'Tamu Pernikahan';
        let wish = '';
        let frameNumber = 1;
        let filter = 'natural';
        let capturedAt = obj.LastModified?.toISOString() || new Date().toISOString();
        let rollId = '';

        try {
          const head = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
          const meta = head.Metadata || {};
          guestName = safeDecode(meta.guest, 'Tamu Pernikahan');
          wish = safeDecode(meta.wish, '');
          frameNumber = Number(meta.frame) || 1;
          filter = safeDecode(meta.filter, 'natural');
          capturedAt = safeDecode(meta.capturedat, capturedAt);
          rollId = safeDecode(meta.rollid, '');
        } catch {
          // Keep defaults if HeadObject fails
        }

        return {
          key,
          url: `/api/photo?key=${encodeURIComponent(key)}`,
          size: obj.Size || 0,
          lastModified: obj.LastModified?.toISOString() || capturedAt,
          guestName,
          wish,
          frameNumber,
          filter,
          capturedAt,
          rollId,
        };
      })
    );

    sendJson(res, 200, { photos, total: photos.length });
  } catch (error) {
    console.error('Error listing photos from Neo S3:', error);
    const message = error instanceof Error ? error.message : 'Gagal memuat galeri dari Neo S3.';
    sendJson(res, 500, { error: message, photos: [] });
  }
}
