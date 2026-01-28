import { S3Client } from '@aws-sdk/client-s3';
import multerS3 from 'multer-s3';
import { ConfigService } from '@nestjs/config';
import { extname } from 'path';
import { NodeHttpHandler } from '@smithy/node-http-handler';
import { Agent } from 'https';

export const s3StorageConfig = (configService: ConfigService) => {
    // Force IPv4 to avoid ETIMEDOUT on networks with poor IPv6 support (fixes Backblaze B2 connection issues)
    const agent = new Agent({
        keepAlive: true,
        family: 4,
    });

    const s3 = new S3Client({
        endpoint: configService.get<string>('B2_ENDPOINT'),
        region: configService.get<string>('B2_REGION'),
        credentials: {
            accessKeyId: configService.get<string>('B2_KEY_ID') || '',
            secretAccessKey: configService.get<string>('B2_APP_KEY') || '',
        },
        maxAttempts: 3,
        requestHandler: new NodeHttpHandler({
            httpsAgent: agent,
            connectionTimeout: 10000,
        }),
    });

    return multerS3({
        s3: s3,
        bucket: configService.get<string>('B2_BUCKET_NAME') || '',
        acl: 'public-read',
        contentType: multerS3.AUTO_CONTENT_TYPE,
        key: (req, file, cb) => {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
            const extension = extname(file.originalname);
            const safeOriginalName = file.originalname.split('.')[0].replace(/[^a-z0-9]/gi, '-').toLowerCase();
            const fileName = `${safeOriginalName}-${uniqueSuffix}${extension}`;
            cb(null, `inspection-photos/${fileName}`);
        },
    });
};
