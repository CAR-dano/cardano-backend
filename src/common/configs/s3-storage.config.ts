import { S3Client } from '@aws-sdk/client-s3';
import multerS3 from 'multer-s3';
import { ConfigService } from '@nestjs/config';
import { extname } from 'path';

export const s3StorageConfig = (configService: ConfigService) => {
    const s3 = new S3Client({
        endpoint: configService.get<string>('B2_ENDPOINT'),
        region: configService.get<string>('B2_REGION'),
        credentials: {
            accessKeyId: configService.get<string>('B2_KEY_ID') || '',
            secretAccessKey: configService.get<string>('B2_APP_KEY') || '',
        },
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
