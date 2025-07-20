import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import * as fs from 'fs';
import { promises as fsAsync } from 'fs';
import { join } from 'path';
import { UpdateFileMetadataDto } from './dto/upload-file.dto';
import { UpdateVisibilityDto } from './dto/update-visibility.dto';
import { CreateFileShareDto } from './dto/create-file-share.dto';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import { Request } from 'express';
import { EmailService } from 'src/email/email.service';
import { degrees, PDFDocument, rgb } from 'pdf-lib';

@Injectable()
export class FileService {
    constructor (
        private prisma: PrismaService,
        private emailService: EmailService
    ) {}

    async getFileById(id: string) {
        return this.prisma.file.findUnique({
            where: { id },
            include: { owner: true },
        });
    }

    async getFilesByUser(userId: string, page = 1, limit = 10) {
        const skip = (page - 1) * limit;
        const [logs, total] = await Promise.all([
            this.prisma.file.findMany({
                where: { ownerId: userId },
                select: {
                    id: true,
                    filename: true,
                    url: true,
                    createdAt: true,
                    expiresAt: true,
                    downloadLimit: true,
                    downloadCount: true,
                    visibility: true
                },
                orderBy: {
                    createdAt: 'desc',
                },
                skip,
                take: limit,
            }),
            this.prisma.file.count({
                where: { ownerId: userId },
            }),
        ]);
        
        return {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
            data: logs.map((file) => ({
                ...file,
                shareLink: `${process.env.LOCAL_URL}/file/download/${file.id}`,
            })),
        };
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

    async getAccessLogsByFileId(fileId: string, page = 1, limit = 10) {
        const skip = (page - 1) * limit;

        const [logs, total] = await Promise.all([
            this.prisma.fileAccessLog.findMany({
                where: { fileId },
                orderBy: { accessedAt: 'desc' },
                skip,
                take: limit,
            }),
            this.prisma.fileAccessLog.count({
                where: { fileId },
            }),
        ]);

        return { data: logs, total, page, limit, totalPages: Math.ceil(total / limit) };
    }
    
    async logFailedAccess(fileId: string, ipAddress: string, userAgent: string, reason: string) {
        return this.prisma.failedAccessLog.create({
            data: { fileId, ipAddress, userAgent, reason },
        });
    }

    async getFailedAccessLogsByFileId(fileId: string, page = 1, limit = 10) {
        const skip = (page - 1) * limit;

        const [logs, total] = await Promise.all([
            this.prisma.failedAccessLog.findMany({
                where: { fileId },
                orderBy: { accessedAt: 'desc' },
                skip,
                take: limit,
            }),
            this.prisma.failedAccessLog.count({
                where: { fileId },
            }),
        ]);

        return {
            data: logs,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
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

    async getFileLogs(fileId: string, userId: string, page = 1, limit = 10) {
        const file = await this.prisma.file.findUnique({ where: { id: fileId } });
        if (!file) throw new NotFoundException('File not found');
        if (file.ownerId !== userId) throw new ForbiddenException('You do not have access to this file log');
      
        const skip = (page - 1) * limit;

        const [accessLogs, accessTotal] = await Promise.all([
            this.prisma.fileAccessLog.findMany({
                where: { fileId },
                orderBy: { accessedAt: 'desc' },
                skip,
                take: limit,
            }),
            this.prisma.fileAccessLog.count({ where: { fileId } })
        ]);

        const [failedLogs, failedTotal] = await Promise.all([
            this.prisma.failedAccessLog.findMany({
                where: { fileId },
                orderBy: { accessedAt: 'desc' },
                skip,
                take: limit,
            }),
            this.prisma.failedAccessLog.count({ where: { fileId } })
        ]);
      
        return {
            accessLogs: { total: accessTotal, page, limit, data: accessLogs },
            failedLogs: { total: failedTotal, page, limit, data: failedLogs }
        };
    }

    async getExpiredFiles() {
        return this.prisma.file.findMany({
            where: {
                expiresAt: { lt: new Date() },
            },
        });
    }
    
    async permanentlyDeleteFile(fileId: string) {
        return this.prisma.file.delete({ where: { id: fileId } });
    }

    async bulkDeleteFiles(fileIds: string[]) {
        return this.prisma.file.deleteMany({
            where: { id: { in: fileIds } },
        });
    }
    
    async logFileDeletionFailure(fileId: string, fileName: string, reason: string) {
        return this.prisma.fileDeletionFailureLog.create({
            data: { fileId, fileName, reason },
        });
    }

    async updateFileVisibility(fileId: string, userId: string, updateVisibilityDto: UpdateVisibilityDto) {
        const file = await this.prisma.file.findUnique({ where: { id: fileId } });
      
        if (!file) {
            throw new NotFoundException('File not found');
        }
      
        if (file.ownerId !== userId) {
            throw new ForbiddenException('You do not have permission to update this file');
        }
      
        return this.prisma.file.update({
            where: { id: fileId },
            data: {
                visibility: updateVisibilityDto.visibility,
                password: updateVisibilityDto.visibility === 'password_protected' ? updateVisibilityDto.password : null,
            },
        });
    }
    
    async incrementDownloadCount(fileId: string) {
        return this.prisma.file.update({
            where: { id: fileId },
            data: { downloadCount: { increment: 1 } },
        });
    }

    async createEmptyFileRecord(file: Express.Multer.File, userId: string) {
        return this.prisma.file.create({
            data: {
                filename: file.filename,
                url: `uploads/${file.filename}`,
                originalName: file.originalname,
                ownerId: userId,
                size: file.size
            },
        });
    }

    async updateFileMetadata(dto: UpdateFileMetadataDto, userId: string) {
        const { fileId, visibility, password, expiresAt, downloadLimit } = dto;
      
        const file = await this.prisma.file.findUnique({ where: { id: fileId } });
        if (!file) throw new NotFoundException('File not found');
        if (file.ownerId !== userId) throw new ForbiddenException('You do not own this file');
      
        let expirationDate: Date | null = file.expiresAt;

        if (expiresAt) {
        const parsedDate = new Date(expiresAt);
        if (isNaN(parsedDate.getTime())) {
            throw new BadRequestException('Invalid date format for expiresAt. Use ISO format like YYYY-MM-DDTHH:mm:ssZ');
        }
        expirationDate = parsedDate;
        }
        const hashedPassword = await bcrypt.hash(password || "", 10);
        const updatedFile = await this.prisma.file.update({
            where: { id: fileId },
            data: {
                visibility,
                expiresAt: expirationDate,
                downloadLimit: downloadLimit ?? null,
                password: visibility === 'password_protected' ? hashedPassword : null
            },
        });
          
        return {
            message: 'File metadata updated successfully',
            file: updatedFile,
            shareLink: `${process.env.LOCAL_URL}/file/download/${updatedFile.id}`,
        };
    }
      
    async getUserStats(userId: string) {
        const [totalFiles, expiredFiles, privateFiles, publicFiles, passwordProtectedFiles, totalDownloads] = await Promise.all([
            this.prisma.file.count({ where: { ownerId: userId } }),
            this.prisma.file.count({
                where: {
                ownerId: userId,
                expiresAt: { lt: new Date() },
                },
            }),
            this.prisma.file.count({ where: { ownerId: userId, visibility: 'private' } }),
            this.prisma.file.count({ where: { ownerId: userId, visibility: 'public' } }),
            this.prisma.file.count({ where: { ownerId: userId, visibility: 'password_protected' } }),
            this.prisma.fileAccessLog.count({
                where: {
                file: {
                    ownerId: userId,
                },
                },
            }),
        ]);
      
        return {
            totalFiles,
            expiredFiles,
            privateFiles,
            publicFiles,
            passwordProtectedFiles,
            totalDownloads,
        };
    }

    async deleteFilesWithNoExpiration() {
        const filesToDelete = await this.prisma.file.findMany({
          where: {
            expiresAt: null,
          },
        });
      
        for (const file of filesToDelete) {
          const filePath = join(__dirname, '..', '..', 'uploads', file.filename);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
      
          await this.prisma.file.delete({
            where: { id: file.id },
          });
        }
      
        return { message: `${filesToDelete.length} file(s) deleted.` };
    }
      
    async getMetadataById(id: string) {
        const file = await this.prisma.file.findUnique({
          where: { id },
          select: {
            visibility: true,
            filename: true,
            expiresAt: true,
            password: true,
          }
        });
      
        if (!file) {
          throw new NotFoundException('File not found');
        }
      
        const isExpired = file.expiresAt ? new Date() > file.expiresAt : false;
      
        return {
          visibility: file.visibility,
          fileName: file.filename,
          isExpired,
          hasPassword: !!file.password
        };
    }

    async createShare(dto: CreateFileShareDto) {
        const file = await this.prisma.file.findUnique({
          where: { id: dto.fileId },
        });
      
        if (!file) {
          throw new NotFoundException('File not found');
        }
      
        const token = randomBytes(24).toString('hex');
        const shareUrl = `${process.env.FRONTEND_URL}/share/${token}`;
      
        try {
          const result = await this.prisma.$transaction(async (tx) => {
            const createdShare = await tx.fileShare.create({
              data: {
                fileId: dto.fileId,
                email: dto.email,
                token,
                expiresAt: new Date(dto.expiresAt),
                maxDownload: dto.maxDownload,
                note: dto.note,
              },
            });
      
            try {
              await this.emailService.sendFileShareEmail({
                to: dto.email,
                filename: file.originalName ?? 'Confidential Document',
                shareUrl,
              });
            } catch (emailErr) {
              throw new Error(`Failed to send email: ${emailErr.message}`);
            }
      
            return createdShare;
          });
      
          return {
            message: 'File shared successfully',
            shareUrl,
          };
        } catch (err) {
          throw new BadRequestException("Failed to share file");
        }
    }

    async getByToken(token: string) {
        return this.prisma.fileShare.findUnique({
            where: { token },
            include: { file: true }
        });
    }

    async getShareInfo(token: string) {
        const share = await this.prisma.fileShare.findUnique({
            where: { token },
            include: {
                file: true,
            },
        });
    
        if (!share) {
            throw new NotFoundException('Link tidak ditemukan atau sudah kadaluarsa');
        }
        console.log(share, ">>> SHARE")
    
        const now = new Date();
        const isExpired = share.expiresAt < now;
        const isLimitExceeded = share.downloadCount >= share.maxDownload;
    
        if (isExpired || isLimitExceeded) {
            throw new ForbiddenException('Link sudah tidak berlaku');
        }

        return {
            fileName: share.file.filename,
            fileSize: share.file.size,
            note: share.note,
            expiresAt: share.expiresAt,
            maxDownload: share.maxDownload,
            downloadCount: share.downloadCount,
            visibility: share?.file?.visibility === "password_protected" ? true : false
        };
    }

    async validateAndPrepareDownload(token: string) {
        const share = await this.prisma.fileShare.findUnique({
          where: { token },
          include: { file: true },
        });
      
        if (!share) {
          throw new NotFoundException('Link tidak ditemukan');
        }
      
        const now = new Date();
        const isExpired = share.expiresAt < now;
        const isLimitExceeded = share.downloadCount >= share.maxDownload;
      
        if (isExpired || isLimitExceeded) {
          throw new ForbiddenException('Link sudah tidak berlaku');
        }
      
        await this.prisma.fileShare.update({
          where: { token },
          data: {
            downloadCount: { increment: 1 },
          },
        });
      
        return { file: share.file };
    }

    async downloadSharedFile(token: string, password?: string) {
        const share = await this.prisma.fileShare.findUnique({
          where: { token },
          include: { file: true },
        });
      
        if (!share) throw new NotFoundException('Link tidak ditemukan');
      
        const now = new Date();
        if (share.expiresAt < now) throw new ForbiddenException('Link sudah expired');
        if (share.downloadCount >= share.maxDownload) throw new ForbiddenException('Download limit tercapai');
      
        const file = share.file;
        console.log(file.password, '>>> FILE NYA')
        console.log(password, '>>> PASSWORD')
      
        if (file.password) {
          if (!password) throw new ForbiddenException('Password dibutuhkan');
          const isMatch = await bcrypt.compare(password, file.password);
          console.log(isMatch, ">>>> MAUS")
          if (!isMatch) throw new ForbiddenException('Password salah');
        }
      
        await this.prisma.fileShare.update({
          where: { id: share.id },
          data: { downloadCount: { increment: 1 } },
        });
      
        return file;
    }
      
    async logFileShareDownload(fileId: string, token: string, req: Request) {
        const ip = req.ip || req.headers['x-forwarded-for'] as string;
        const userAgent = req.headers['user-agent'];
      
        await this.prisma.fileShareDownloadLog.create({
          data: {
            fileId,
            token,
            ip,
            userAgent,
          },
        });
    }
    
    async getFileShareLogs(fileId: string) {
        return this.prisma.fileShareDownloadLog.findMany({
          where: { fileId },
          orderBy: { createdAt: 'desc' },
        });
    }

    async generatePdfWithWatermark(inputPath: string, watermarkText: string) {
        const existingPdfBytes = await fsAsync.readFile(inputPath);
        const pdfDoc = await PDFDocument.load(existingPdfBytes);
        const pages = pdfDoc.getPages();
      
        for (const page of pages) {
          const { width, height } = page.getSize();
          page.drawText(watermarkText, {
            x: 50,
            y: height / 2,
            size: 50,
            opacity: 0.2,
            rotate: degrees(-30),
            color: rgb(1, 0, 0),
          });
        }
      
        const pdfBytes = await pdfDoc.save();
        return Buffer.from(pdfBytes);
    }
}