import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import * as fs from 'fs';
import { join } from 'path';

@Injectable()
export class FileService {
    constructor (private prisma: PrismaService) {}

    async saveFileMetadata(file: Express.Multer.File, userId: string, expiresAt?: string) {
        const expirationDate = expiresAt ? new Date(expiresAt) : (() => {
            const defaultExpiration = new Date();
            defaultExpiration.setDate(defaultExpiration.getDate() + 7);
            return defaultExpiration;
        })();
    
        const savedFile = await this.prisma.file.create({
            data: {
                filename: file.filename,
                url: `uploads/${file.filename}`,
                ownerId: userId,
                expiresAt: expirationDate,
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

    async logFileAccess(fileId: string, ipAddress: string, userAgent: string) {
        return this.prisma.fileAccessLog.create({
            data: {
                fileId,
                ipAddress,
                userAgent,
            },
        });
    }

    async getAccessLogsByFileId(fileId: string) {
        return this.prisma.fileAccessLog.findMany({
            where: { fileId },
            orderBy: { accessedAt: 'desc' },
        });
    }
    
    async logFailedAccess(fileId: string, ipAddress: string, userAgent: string, reason: string) {
        return this.prisma.failedAccessLog.create({
            data: { fileId, ipAddress, userAgent, reason },
        });
    }

    async getFailedAccessLogsByFileId(fileId: string) {
        return this.prisma.failedAccessLog.findMany({ where: { fileId } });
    }

    async deleteFile(fileId: string, userId: string) {
        const file = await this.prisma.file.findUnique({ where: { id: fileId } });

        if (!file) {
          throw new NotFoundException('File not found');
        }

        if (file.ownerId !== userId) {
          throw new ForbiddenException('You do not have permission to delete this file');
        }

        const filePath = join(__dirname, '..', '..', 'uploads', file.filename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }

        await this.prisma.file.delete({ where: { id: fileId } });
      
        return { message: 'File deleted successfully' };
    }

    async getFileLogs(fileId: string, userId: string) {
        const file = await this.prisma.file.findUnique({ where: { id: fileId } });
        if (!file) throw new NotFoundException('File not found');
        if (file.ownerId !== userId) throw new ForbiddenException('You do not have access to this file log');
      
        const accessLogs = await this.prisma.fileAccessLog.findMany({
          where: { fileId },
          orderBy: { accessedAt: 'desc' },
        });
      
        const failedLogs = await this.prisma.failedAccessLog.findMany({
          where: { fileId },
          orderBy: { accessedAt: 'desc' },
        });
      
        return { accessLogs, failedLogs };
    }
      
}
