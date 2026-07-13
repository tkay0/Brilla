import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new ServiceUnavailableException(
      `Avatar storage is not configured (${name} is not set).`,
    );
  }
  return value;
}

// Lazily configured so the rest of the API can run before R2 credentials exist.
@Injectable()
export class R2Service {
  private client: S3Client | undefined;
  private bucket: string | undefined;
  private publicUrl: string | undefined;

  private getClient(): { client: S3Client; bucket: string; publicUrl: string } {
    if (!this.client || !this.bucket || !this.publicUrl) {
      const accountId = requireEnv('R2_ACCOUNT_ID');
      this.bucket = requireEnv('R2_BUCKET_NAME');
      this.publicUrl = requireEnv('R2_PUBLIC_URL').replace(/\/+$/, '');
      this.client = new S3Client({
        region: 'auto',
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: requireEnv('R2_ACCESS_KEY'),
          secretAccessKey: requireEnv('R2_SECRET_KEY'),
        },
      });
    }
    return { client: this.client, bucket: this.bucket, publicUrl: this.publicUrl };
  }

  async uploadObject(key: string, body: Buffer, contentType: string): Promise<string> {
    const { client, bucket, publicUrl } = this.getClient();
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
    return `${publicUrl}/${key}`;
  }
}
