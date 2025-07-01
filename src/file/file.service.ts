import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Express } from 'express';

@Injectable()
export class FileService {
    constructor (private prisma: PrismaService) {}

    async saveFileMetadata(file: Express.Multer.File, userId: string) {
        const savedFile = await this.prisma.file.create({
            data: {
            filename: file.filename,
            url: `uploads/${file.filename}`,
            ownerId: userId,
            }
        });

        return { message: 'File uploaded successfully', file: savedFile };
    }

    async getFileById(id: string) {
        return this.prisma.file.findUnique({
            where: { id },
        });
    }

    async getFilesByUser(userId: string) {
        return this.prisma.file.findMany({
            where: { ownerId: userId },
            select: {
              id: true,
              filename: true,
              url: true,
              createdAt: true,
              expiresAt: true,
            },
            orderBy: {
              createdAt: 'desc',
            },
          });
    }
}
