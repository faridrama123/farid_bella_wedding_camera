import crypto from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import multer from 'multer';

export const config = {
  api: {
    bodyParser: false,
  },
};

interface MulterRequest extends IncomingMessage {
  body?: Record<string, string>;
  files?: Express.Multer.File[];
}

function sendJson(res: ServerResponse, statusCode: number, data: unknown) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}

function safeEncode(value: string): string {
  return encodeURIComponent(value.slice(0, 300));
}

const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 4 * 1024 * 1024,
    files: 10,
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Hanya file gambar yang diperbolehkan.'));
    }
  },
});

export default async function handler(req: MulterRequest, res: ServerResponse) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' });
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
      });
      return;
    }

    await new Promise<void>((resolve, reject) => {
      uploadMiddleware.array('photos', 10)(
        req as unknown as Parameters<ReturnType<typeof uploadMiddleware.array>>[0],
        res as unknown as Parameters<ReturnType<typeof uploadMiddleware.array>>[1],
        (err: unknown) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    const files = req.files;
    if (!files || files.length === 0) {
      sendJson(res, 400, { error: 'Tidak ada foto yang dikirim.' });
      return;
    }

    const body = req.body || {};
    const guestName = String(body.guestName || 'Tamu Pernikahan').trim() || 'Tamu Pernikahan';
    const wish = String(body.wish || '').trim();
    const rollId = String(body.rollId || crypto.randomUUID().slice(0, 8)).replace(
      /[^a-zA-Z0-9_-]/g,
      ''
    );

    let frameSpecs: Array<{ frameNumber?: number; filter?: string; capturedAt?: string }> = [];
    if (body.frames) {
      try {
        frameSpecs = JSON.parse(String(body.frames));
      } catch {
        frameSpecs = [];
      }
    }

    const s3 = new S3Client({
      region,
      endpoint,
      forcePathStyle: true,
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
      credentials: { accessKeyId, secretAccessKey },
    });

    const uploadedResults = await Promise.all(
      files.map(async (file, index) => {
        const spec = frameSpecs[index] || {};
        const frameNumber = Number(spec.frameNumber) || index + 1;
        const filter = String(spec.filter || 'natural');
        const capturedAt = String(spec.capturedAt || new Date().toISOString());
        const ext =
          file.mimetype === 'image/png' ? 'png' : file.mimetype === 'image/webp' ? 'webp' : 'jpg';
        const padFrame = String(frameNumber).padStart(2, '0');
        const uniqueId = crypto.randomBytes(4).toString('hex');
        const key = `farid-bella/${rollId}/frame-${padFrame}-${Date.now()}-${uniqueId}.${ext}`;

        await s3.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: file.buffer,
            ContentType: file.mimetype || 'image/jpeg',
            Metadata: {
              guest: safeEncode(guestName),
              wish: safeEncode(wish),
              frame: String(frameNumber),
              filter: safeEncode(filter),
              capturedat: safeEncode(capturedAt),
              rollid: safeEncode(rollId),
            },
          })
        );

        return {
          key,
          url: `/api/photo?key=${encodeURIComponent(key)}`,
          size: file.size,
          lastModified: new Date().toISOString(),
          guestName,
          wish,
          frameNumber,
          filter,
          capturedAt,
          rollId,
        };
      })
    );

    sendJson(res, 200, {
      success: true,
      count: uploadedResults.length,
      photos: uploadedResults,
    });
  } catch (error) {
    console.error('Error uploading photos to Neo S3:', error);
    const message = error instanceof Error ? error.message : 'Gagal mengunggah foto ke Neo S3.';
    sendJson(res, 500, { error: message });
  }
}
