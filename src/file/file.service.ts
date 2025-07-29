import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import * as fs from 'fs';
import { promises as fsAsync } from 'fs';
import { extname, join } from 'path';
import { UpdateFileMetadataDto } from './dto/upload-file.dto';
import { UpdateVisibilityDto } from './dto/update-visibility.dto';
import { CreateFileShareDto } from './dto/create-file-share.dto';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import { Request } from 'express';
import { EmailService } from 'src/email/email.service';
import { degrees, PDFDocument, rgb } from 'pdf-lib';
import { addImageWatermark, addPdfWatermark } from 'src/utils/watermark.util';
import * as dayjs from 'dayjs'
import { S3Service } from 'src/s3/s3.service';
import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';

@Injectable()
export class FileService {
    constructor (
        private prisma: PrismaService,
        private emailService: EmailService,
        private s3Service: S3Service,
        @Inject(CACHE_MANAGER) private cacheManager: Cache,
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
                    visibility: true,
                    originalName: true,
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
                shareLink: `${process.env.BASE_URL}/file/download/${file.id}`,
            })),
        };
    }

    async logFileAccess(fileId: string, ipAddress: string, userAgent: string, email?: string) {
        return this.prisma.fileAccessLog.create({
            data: {
                fileId,
                ipAddress,
                userAgent,
                email
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
    
    async logFailedAccess(fileId: string, ipAddress: string, userAgent: string, reason: string, email?: string) {
        return this.prisma.failedAccessLog.create({
            data: { fileId, ipAddress, userAgent, reason, email },
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

        await this.s3Service.deleteFile(file.filename);

        await this.prisma.fileShare.deleteMany({ where: { fileId } });
        await this.prisma.fileAccessLog.deleteMany({ where: { fileId } });
        await this.prisma.failedAccessLog.deleteMany({ where: { fileId } });
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

    async createEmptyFileRecord(
      uploaded: { 
        url: string; 
        filename: string; 
        originalName: string; 
        size: number, 
        key: string,
        bucket: string
      },
      userId: string
    ) {
      return this.prisma.file.create({
        data: {
          filename: uploaded.filename,
          originalName: uploaded.originalName,
          size: uploaded.size,
          url: uploaded.url,
          ownerId: userId,
          key: uploaded.key,
          bucket: uploaded.bucket
        }
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
            shareLink: `${process.env.BASE_URL}/file/download/${updatedFile.id}`,
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

        const calculateLimit = (file.downloadLimit || 0) - dto.maxDownload;
        if(calculateLimit < 0){
          throw new BadRequestException('Cannot proceed: Maximum download limit has been reached');
        };
      
        const token = randomBytes(24).toString('hex');
        const shareUrl = `${process.env.FRONTEND_URL}/preview/token/${token}`;
      
        try {
          await this.prisma.$transaction(async (tx) => {
            await tx.file.update({
              where: { id: dto.fileId },
              data: {
                downloadLimit: calculateLimit
              }
            })
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
            throw new NotFoundException('Link not found or expired');
        }
    
        const now = new Date();
        const isExpired = share.expiresAt < now;
        const isLimitExceeded = share.downloadCount >= share.maxDownload;
    
        if (isExpired || isLimitExceeded) {
            throw new ForbiddenException('Link is expired');
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
    
      if (file.password) {
        if (!password) throw new ForbiddenException('Password dibutuhkan');
        const isMatch = await bcrypt.compare(password, file.password);
        if (!isMatch) throw new ForbiddenException('Password salah');
      }
    
      await this.prisma.fileShare.update({
        where: { id: share.id },
        data: { downloadCount: { increment: 1 } },
      });
    
      return file; // pastikan `file` punya `bucket`, `key`, dan `filename`
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
    
    async getFileShareList(fileId: string, page: number = 1, limit: number = 10) {      
      const skip = (page - 1) * limit;
      const [logs, total] = await Promise.all([
        this.prisma.fileShare.findMany({
          where: { fileId },
          select: {
            email: true,
            maxDownload: true,
            downloadCount: true,
            note: true,
            expiresAt: true,
            createdAt: true,
            token: true
          },
          orderBy: {
            createdAt: 'desc'
          },
          skip,
          take: limit
        }),
        this.prisma.fileShare.count({
          where: { fileId }
        }),
      ]);

      if(logs.length === 0){
        throw new NotFoundException('File Not Found');
      }

      return {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        data: logs
      }
    }

    async generatePdfWithWatermark(inputPath: string, watermarkText: string) {
        const existingPdfBytes = await fsAsync.readFile(inputPath);
        const pdfDoc = await PDFDocument.load(existingPdfBytes);
        const pages = pdfDoc.getPages();
      
        for (const page of pages) {
          const { width = 50, height } = page.getSize();
          page.drawText(watermarkText, {
            x: width,
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

    async getFilePreviewMeta(token: string, ipAddress: string, userAgent: string) {
      const fileShare = await this.prisma.fileShare.findUnique({ where: { token } });

      if (!fileShare) {
        throw new NotFoundException('Invalid or expired token');
      } 

      if (fileShare.downloadCount >= fileShare.maxDownload) {
        this.logFailedAccess(fileShare.fileId, ipAddress, userAgent, 'Download limit reached', fileShare.email);
        throw new ForbiddenException('Download limit reached');
      };

      const file = await this.prisma.file.findUnique({ where: { id: fileShare.fileId } });
      if (!file) {
        this.logFailedAccess(fileShare.fileId, ipAddress, userAgent, 'File not found', fileShare.email);
        throw new NotFoundException('File not found');
      } 

      if(new Date() > fileShare.expiresAt){
        this.logFailedAccess(fileShare.fileId, ipAddress, userAgent, 'File is Expired', fileShare.email);
        throw new ForbiddenException('File is Expired');
      }

      this.logFileAccess(fileShare.fileId, ipAddress, userAgent, fileShare.email);
      
      return {
        id: fileShare.id,
        maxDownload: fileShare.maxDownload,
        downloadCount: fileShare.downloadCount,
        token: fileShare.token,
        hasPassword: file.visibility === "password_protected" ? true : false
      }
    }

    async generateWatermarkedPreview(
      token: string,
    ): Promise<{ buffer: Buffer; mimeType: string; isImage: boolean }> {
      const cacheKey = `preview:${token}`;
      const cached = await this.cacheManager.get<{ buffer: string; mimeType: string; isImage: boolean }>(cacheKey);
      if (cached) {
        return {
          buffer: Buffer.from(cached.buffer, 'base64'),
          mimeType: cached.mimeType,
          isImage: cached.isImage,
        };
      }
  
      const fileShare = await this.prisma.fileShare.findUnique({ where: { token } });
      if (!fileShare) throw new NotFoundException('Invalid or expired token');
  
      if (fileShare.downloadCount >= fileShare.maxDownload) {
        throw new ForbiddenException('Download limit reached');
      }
  
      const file = await this.prisma.file.findUnique({ where: { id: fileShare.fileId } });
      if (!file) throw new NotFoundException('File not found');
  
      const buffer = await this.s3Service.getObject(file.filename);
      const timestamp = dayjs().format('DD MMM YYYY, HH:mm:ss');
  
      const ext = extname(file.filename).toLowerCase();
      let watermarked: Buffer;
      let mimeType = 'application/octet-stream';
      let isImage = false;
  
      if (ext === '.pdf') {
        watermarked = await addPdfWatermark(buffer, fileShare.email, timestamp);
        mimeType = 'application/pdf';
      } else {
        watermarked = await addImageWatermark(buffer, fileShare.email, timestamp);
        mimeType = 'image/png';
        isImage = true;
      }
  
      await this.cacheManager.set(
        cacheKey,
        {
          buffer: watermarked.toString('base64'),
          mimeType,
          isImage,
        },
        60,
      );
  
      await this.prisma.fileShare.update({
        where: { token },
        data: { downloadCount: { increment: 1 } },
      });
  
      return { buffer: watermarked, mimeType, isImage };
    }
    
    async deleteFromS3(filename: string) {
      await this.s3Service.deleteFile(filename);
    }    
}