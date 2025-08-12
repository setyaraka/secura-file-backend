import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import * as mime from 'mime-types';
import { Readable } from 'stream';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class S3Service {
  private s3Client: S3Client;
  private bucketName: string;

  constructor() {
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    const endpoint = process.env.R2_ENDPOINT;
    this.bucketName = process.env.R2_BUCKET_NAME || "";

    if (!accessKeyId || !secretAccessKey || !endpoint || !this.bucketName) {
      throw new Error('Missing R2 credentials in environment variables');
    }

    this.s3Client = new S3Client({
      region: 'auto',
      endpoint,
      credentials: { accessKeyId, secretAccessKey },
    });
  }

  async uploadFile(file: Express.Multer.File): Promise<{
    url: string;
    filename: string;
    originalName: string;
    size: number;
    key: string;
    bucket: string;
  }> {
    const extension = mime.extension(file.mimetype);
    const filename = `${uuidv4()}.${extension}`;
    
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: filename,
      Body: file.buffer,
      ContentType: file.mimetype,
    });
    
    await this.s3Client.send(command);
    
    const publicDomain = process.env.R2_PUBLIC_DOMAIN;
    const url = `https://${this.bucketName}.${publicDomain}/${filename}`;
    
    return {
      url,
      filename,
      originalName: file.originalname,
      size: file.size,
      key: filename,
      bucket: this.bucketName
    };
  }
  
  async getObject(key: string): Promise<Buffer> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    const response = await this.s3Client.send(command);
    const stream = response.Body as Readable;

    const buffer = await new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });

    return buffer;
  }

  async deleteFile(key: string): Promise<void> {
    await this.s3Client.send(new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    }));
  }
  
  async getPresignedUrl(bucket: string, key: string): Promise<string> {
    const command = new GetObjectCommand({ Bucket: bucket, Key: key });
    const url = await getSignedUrl(this.s3Client, command, { expiresIn: 3600 }); // 1 jam
    return url;
  }

  async streamFile(bucket: string, key: string): Promise<Readable> {
      const command = new GetObjectCommand({
          Bucket: bucket,
          Key: key,
      });
  
      const response = await this.s3Client.send(command);
  
      if (!response.Body) {
      throw new Error('File body is empty');
      }
  
      return response.Body as Readable;
  }
  
  async generateSignedUrl(key: string): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });
  
    const signedUrl = await getSignedUrl(this.s3Client, command, {
      expiresIn: 60 * 5
    });
  
    return signedUrl;
  }
}
