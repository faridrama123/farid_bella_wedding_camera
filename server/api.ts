import express from 'express';
import multer from 'multer';
import crypto from 'crypto';
import { Readable } from 'stream';
import {
  S3Client,
  PutObjectCommand,
  ListObjectsV2Command,
  GetObjectCommand,
  HeadObjectCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';

interface PhotoMetadata {
  guestName: string;
  wish: string;
  frameNumber: number;
  filter: string;
  capturedAt: string;
  rollId: string;
}

const metadataCache = new Map<string, PhotoMetadata>();

function getS3Config() {
  const endpoint = process.env.S3_ENDPOINT || 'https://nos.wjv-1.neo.id';
  const bucket = process.env.S3_BUCKET || 'wedding';
  const region = process.env.S3_REGION || 'us-east-1';
  const accessKeyId = process.env.S3_ACCESS_KEY || '';
  const secretAccessKey = process.env.S3_SECRET_KEY || '';

  return { endpoint, bucket, region, accessKeyId, secretAccessKey };
}

function createS3Client() {
  const { endpoint, region, accessKeyId, secretAccessKey } = getS3Config();
  if (!accessKeyId || !secretAccessKey) {
    throw new Error(
      'Konfigurasi S3_ACCESS_KEY dan S3_SECRET_KEY belum diatur di Environment Variables.'
    );
  }

  return new S3Client({
    region,
    endpoint,
    forcePathStyle: true,
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}

function safeDecode(value: string | undefined, fallback = ''): string {
  if (!value) return fallback;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function safeEncode(value: string): string {
  return encodeURIComponent(value.slice(0, 300));
}

function isImageKey(key: string): boolean {
  return /\.(jpe?g|png|webp)$/i.test(key);
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 4 * 1024 * 1024, // 4MB per shot (compatible with Vercel 4.5MB body limit)
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

async function getPhotoMetadata(s3: S3Client, bucket: string, key: string): Promise<PhotoMetadata> {
  const cached = metadataCache.get(key);
  if (cached) return cached;

  try {
    const head = await s3.send(
      new HeadObjectCommand({
        Bucket: bucket,
        Key: key,
      })
    );
    const meta = head.Metadata || {};
    const parsed: PhotoMetadata = {
      guestName: safeDecode(meta.guest, 'Tamu Pernikahan'),
      wish: safeDecode(meta.wish, ''),
      frameNumber: Number(meta.frame) || 1,
      filter: safeDecode(meta.filter, 'natural'),
      capturedAt: safeDecode(
        meta.capturedat,
        head.LastModified?.toISOString() || new Date().toISOString()
      ),
      rollId: safeDecode(meta.rollid, ''),
    };
    metadataCache.set(key, parsed);
    return parsed;
  } catch {
    return {
      guestName: 'Tamu Pernikahan',
      wish: '',
      frameNumber: 1,
      filter: 'natural',
      capturedAt: new Date().toISOString(),
      rollId: '',
    };
  }
}

export function createApiRouter() {
  const router = express.Router();

  router.get('/health', async (_req, res) => {
    try {
      const { bucket, endpoint } = getS3Config();
      const s3 = createS3Client();
      await s3.send(new HeadBucketCommand({ Bucket: bucket }));
      res.json({ ok: true, bucket, endpoint });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'S3 connection failed';
      res.status(500).json({ ok: false, error: message });
    }
  });

  router.get('/photos', async (_req, res) => {
    try {
      const { bucket } = getS3Config();
      const s3 = createS3Client();

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
          const meta = await getPhotoMetadata(s3, bucket, key);
          return {
            key,
            url: `/api/photo?key=${encodeURIComponent(key)}`,
            size: obj.Size || 0,
            lastModified: obj.LastModified?.toISOString() || meta.capturedAt,
            ...meta,
          };
        })
      );

      res.json({ photos, total: photos.length });
    } catch (error) {
      console.error('Error listing photos from Neo S3:', error);
      const message = error instanceof Error ? error.message : 'Gagal memuat galeri dari S3.';
      res.status(500).json({ error: message, photos: [] });
    }
  });

  router.post('/upload', upload.array('photos', 10), async (req, res) => {
    try {
      const { bucket } = getS3Config();
      const s3 = createS3Client();

      const files = req.files as Express.Multer.File[] | undefined;
      if (!files || files.length === 0) {
        res.status(400).json({ error: 'Tidak ada foto yang dikirim.' });
        return;
      }

      const guestName = String(req.body.guestName || 'Tamu Pernikahan').trim() || 'Tamu Pernikahan';
      const wish = String(req.body.wish || '').trim();
      const rollId = String(req.body.rollId || crypto.randomUUID().slice(0, 8)).replace(
        /[^a-zA-Z0-9_-]/g,
        ''
      );

      let frameSpecs: Array<{ frameNumber?: number; filter?: string; capturedAt?: string }> = [];
      if (req.body.frames) {
        try {
          frameSpecs = JSON.parse(String(req.body.frames));
        } catch {
          frameSpecs = [];
        }
      }

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

          const meta: PhotoMetadata = {
            guestName,
            wish,
            frameNumber,
            filter,
            capturedAt,
            rollId,
          };
          metadataCache.set(key, meta);

          return {
            key,
            url: `/api/photo?key=${encodeURIComponent(key)}`,
            size: file.size,
            lastModified: new Date().toISOString(),
            ...meta,
          };
        })
      );

      res.json({
        success: true,
        count: uploadedResults.length,
        photos: uploadedResults,
      });
    } catch (error) {
      console.error('Error uploading photos to Neo S3:', error);
      const message = error instanceof Error ? error.message : 'Gagal mengunggah foto ke Neo S3.';
      res.status(500).json({ error: message });
    }
  });

  router.get('/photo', async (req, res) => {
    try {
      const { bucket } = getS3Config();
      const s3 = createS3Client();

      const key = String(req.query.key || '');
      if (!key || !key.startsWith('farid-bella/') || key.includes('..') || !isImageKey(key)) {
        res.status(400).json({ error: 'Key foto tidak valid.' });
        return;
      }

      const objectResponse = await s3.send(
        new GetObjectCommand({
          Bucket: bucket,
          Key: key,
        })
      );

      if (objectResponse.ContentType) {
        res.setHeader('Content-Type', objectResponse.ContentType);
      } else {
        res.setHeader('Content-Type', 'image/jpeg');
      }
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

      const body = objectResponse.Body;
      if (!body) {
        res.status(404).end();
        return;
      }

      if (body instanceof Readable) {
        body.pipe(res);
      } else if (
        typeof (body as { transformToByteArray?: () => Promise<Uint8Array> }).transformToByteArray ===
        'function'
      ) {
        const bytes = await (
          body as { transformToByteArray: () => Promise<Uint8Array> }
        ).transformToByteArray();
        res.send(Buffer.from(bytes));
      } else {
        res.status(500).json({ error: 'Unsupported S3 stream format' });
      }
    } catch (error) {
      console.error('Error fetching photo from Neo S3:', error);
      res.status(404).json({ error: 'Foto tidak ditemukan.' });
    }
  });

  return router;
}
