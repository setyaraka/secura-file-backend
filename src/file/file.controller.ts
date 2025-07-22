import { BadRequestException, Body, Controller, Delete, ForbiddenException, Get, NotFoundException, Param, Patch, Post, Query, Req, Request, Res, UploadedFile, UseGuards, UseInterceptors, UsePipes, ValidationPipe } from '@nestjs/common';
import { FileService } from './file.service';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { extname, join } from 'path';
import * as fs from 'fs';
import { Response } from 'express';
import { getContentType, getRequestInfo } from 'src/utils/request-info';
import { UpdateFileMetadataDto } from './dto/upload-file.dto';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { UpdateVisibilityDto } from './dto/update-visibility.dto';
import * as sharp from 'sharp';
import { CreateFileShareDto } from './dto/create-file-share.dto';
import { ShareDownloadDto } from './dto/share-download.dto';
import { Request as ExpressRequest } from 'express';
import { addImageWatermark, addPdfWatermark } from 'src/utils/watermark.util';
import * as bcrypt from 'bcrypt';

@Controller('file')
export class FileController {
  constructor(private readonly fileService: FileService) {}
  
  @UseGuards(AuthGuard('jwt'))
  @Post('upload')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: './uploads',
      filename: (req, file, cb) => {
        const uniqueName = `${uuidv4()}${extname(file.originalname)}`;
        cb(null, uniqueName);
      },
    }),
  }))
  async uploadFile(@UploadedFile() file: Express.Multer.File, @Request() req) {
    const savedFile = await this.fileService.createEmptyFileRecord(file, req.user.userId);
    const previewUrl = `${process.env.BASE_URL}/file/preview/${savedFile.id}`;

    return {
      message: 'File uploaded successfully',
      fileId: savedFile.id,
      filename: file.originalname,
      size: file.size,
      previewUrl
    };
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch('metadata')
  async updateMetadata(@Body() metadataDto: UpdateFileMetadataDto, @Request() req) {
    if (metadataDto.expiresAt) {
      const expiresDate = new Date(metadataDto.expiresAt);
      const now = new Date();

      if (isNaN(expiresDate.getTime())) {
        throw new BadRequestException('Invalid date format for expiresAt. Use YYYY-MM-DD or ISO format.');
      }

      if (expiresDate <= now) {
        throw new BadRequestException('Expiration date must be in the future.');
      }
    }
    return this.fileService.updateFileMetadata(metadataDto, req.user.userId);
  }

  @Get('metadata/:id')
  async getMetadataById(@Param('id') id: string) {
    return this.fileService.getMetadataById(id);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('my-files')
  async getMyFiles(@Request() req, @Query() paginationDto: PaginationDto) {
    const userId = req.user.userId;
    
    return this.fileService.getFilesByUser(userId, paginationDto.page, paginationDto.limit);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('me/stats')
  async getUserStats(@Request() req) {
    return this.fileService.getUserStats(req.user.userId);
  }


  @UseGuards(AuthGuard('jwt'))
  @Get('secure-download/:id')
  async getFile(
    @Param('id') id: string, 
    @Request() req,
    @Res() res: Response,
    @Query('password') password?: string,
  ) {
    const { ipAddress, userAgent } = getRequestInfo(req);

    const file = await this.fileService.getFileById(id);

    if (!file) {
      throw new NotFoundException('File not found');
    }

    if (file.ownerId !== req.user.userId ) {
      if (file.password) {
        if (file.password !== password) {
          await this.fileService.logFailedAccess(file.id, ipAddress, userAgent, 'Incorrect password');
          throw new ForbiddenException('Incorrect password for this file');
        }
      } else {
        await this.fileService.logFailedAccess(file.id, ipAddress, userAgent, 'Forbidden access');
        throw new ForbiddenException('You do not have access to this file');
      }
    }

    if (file.expiresAt && new Date() > file.expiresAt) {
      await this.fileService.logFailedAccess(id, ipAddress, userAgent, 'File has expired');
      throw new ForbiddenException('File has expired');
    }

    if (file.visibility === 'private' && file.ownerId !== req.user.userId) {
      await this.fileService.logFailedAccess(id, ipAddress, userAgent, 'Forbidden access');
      throw new ForbiddenException('You do not have access to this file');
    }
  
    if (file.visibility === 'password_protected' && file.ownerId !== req.user.userId) {
      if (!password || password !== file.password) {
        await this.fileService.logFailedAccess(id, ipAddress, userAgent, 'Invalid password');
        throw new ForbiddenException('Invalid password');
      }
    }

    if (file.downloadLimit !== null && file.downloadCount >= file.downloadLimit) {
      await this.fileService.logFailedAccess(id, ipAddress, userAgent, 'Download limit exceeded');
      throw new ForbiddenException('Download limit exceeded');
    }

    const filePath = join(__dirname, '..', '..', 'uploads', file.filename);

    if (!fs.existsSync(filePath)) {
      await this.fileService.logFailedAccess(id, ipAddress, userAgent, 'File does not exist on server');
      throw new NotFoundException('File does not exist on server');
    }

    await this.fileService.logFileAccess(file.id, req.ip, req.headers['user-agent']);
    await this.fileService.incrementDownloadCount(file.id);

    return res.download(filePath, file.filename);
  }

  @Get('download/:id')
  async publicDownloadFile(
    @Param('id') id: string,
    @Query('password') password: string,
    @Res() res: Response,
    @Query() query,
    @Query('user-agent') ua: string,
    @Query('ip') ip: string
  ) {
    const { ipAddress, userAgent } = getRequestInfo(res.req);

    const file = await this.fileService.getFileById(id);

    if (!file) {
      await this.fileService.logFailedAccess(id, ipAddress, userAgent, 'File not found');
      throw new NotFoundException('File not found');
    }

    if (file.visibility === 'private') {
      await this.fileService.logFailedAccess(id, ipAddress, userAgent, 'Private file - access denied');
      throw new ForbiddenException('This file is private.');
    }

    if (file.visibility === 'password_protected') {
      if (!password || file.password !== password) {
        await this.fileService.logFailedAccess(id, ipAddress, userAgent, 'Incorrect or missing password');
        throw new ForbiddenException('Incorrect password.');
      }
    }

    if (file.expiresAt && new Date() > file.expiresAt) {
      await this.fileService.logFailedAccess(id, ipAddress, userAgent, 'File expired');
      throw new ForbiddenException('File has expired.');
    }

    if (file.downloadLimit !== null && file.downloadCount >= file.downloadLimit) {
      await this.fileService.logFailedAccess(id, ipAddress, userAgent, 'Download limit exceeded');
      throw new ForbiddenException('Download limit exceeded.');
    }

    const filePath = join(__dirname, '..', '..', 'uploads', file.filename);
    if (!fs.existsSync(filePath)) {
      await this.fileService.logFailedAccess(id, ipAddress, userAgent, 'File not found on server');
      throw new NotFoundException('File not found on server');
    }

    await this.fileService.logFileAccess(file.id, ipAddress, userAgent);
    await this.fileService.incrementDownloadCount(file.id);

    return res.download(filePath, file.filename);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('download/:id/access-logs')
  async getFileAccessLogs(
    @Param('id') id: string, 
    @Request() req,
    @Query() paginationDto: PaginationDto,
  ) {
    const file = await this.fileService.getFileById(id);

    if (!file) {
      throw new NotFoundException('File not found');
    }

    if (file.ownerId !== req.user.userId) {
      throw new ForbiddenException('You do not have access to this file');
    }

    return this.fileService.getAccessLogsByFileId(file.id, paginationDto.page, paginationDto.limit);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('download/:id/failed-logs')
  async getFailedLogs(
    @Param('id') id: string, 
    @Request() req,
    @Query() paginationDto: PaginationDto,
  ) {

    return this.fileService.getFailedAccessLogsByFileId(id, paginationDto.page, paginationDto.limit);
  }

  @Get('preview/public/:id')
  async publicPreview(@Param('id') id: string, @Res() res: Response) {
    const file = await this.fileService.getFileById(id);
    if (!file) throw new NotFoundException();

    const filePath = join(__dirname, '..', '..', 'uploads', file.filename);
    if (!fs.existsSync(filePath)) throw new NotFoundException();

    const contentType = getContentType(file.filename);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', 'inline');
    return res.sendFile(filePath);
  }

  // @UseGuards(AuthGuard('jwt'))
  // @Get('preview/:id')
  // async previewFile(
  //   @Param('id') id: string,
  //   @Res() res: Response,
  //   @Request() req,
  //   @Query('password') password?: string,
  // ) {
  //   const { ipAddress, userAgent } = getRequestInfo(req);

  //   const file = await this.fileService.getFileById(id);
  //   const isMatch = await bcrypt.compare(password || '', file?.password || '');
  //   if (!file) throw new NotFoundException('File not found');

  //   if (file.expiresAt && new Date() > file.expiresAt) {
  //     throw new ForbiddenException('File has expired');
  //   }

  //   if (file.visibility === 'private') {
  //     if (!req.user || file.ownerId !== req.user.userId) {
  //       throw new ForbiddenException('Access denied');
  //     }
  //   } else if (file.visibility === 'password_protected') {
  //     if (!password || password !== file.password) {
  //       throw new ForbiddenException('Incorrect password');
  //     }
  //   }

  //   const filePath = join(__dirname, '..', '..', 'uploads', file.filename);
  //   if (!fs.existsSync(filePath)) {
  //     throw new NotFoundException('File not found on server');
  //   }

  //   const contentType = getContentType(file.filename);
  //   const isImage = /^image\/(png|jpeg|jpg)$/i.test(contentType);
  //   const isPdf = contentType === 'application/pdf';

  //   await this.fileService.logFileAccess(file.id, ipAddress, userAgent);

  //   if (isImage && file.owner?.email) {
  //     const buffer = fs.readFileSync(filePath);
  //     const watermarkedImage = await addImageWatermark(buffer, 'Confidential');
    
  //     res.setHeader('Content-Type', 'image/png');
  //     res.setHeader('Content-Disposition', 'inline');
  //     return res.end(watermarkedImage);
  //   }

  //   if (isPdf && file.owner?.email) {
  //     const buffer = fs.readFileSync(filePath);
  //     const watermarkedPdf = await addPdfWatermark(buffer, 'Confidential');

  //     res.setHeader('Content-Type', 'application/pdf');
  //     res.setHeader('Content-Disposition', 'inline; filename="preview.pdf"');
  //     res.setHeader('Cache-Control', 'no-store');
  //     res.setHeader('Pragma', 'no-cache');
  //     res.setHeader('Expires', '0');
  //     res.setHeader('X-Content-Type-Options', 'nosniff');
  //     return res.end(watermarkedPdf);
  //   }

  //   res.setHeader('Content-Type', contentType);
  //   res.setHeader('Content-Disposition', 'inline');
  //   res.setHeader('Cache-Control', 'no-store');
  //   res.setHeader('Pragma', 'no-cache');
  //   res.setHeader('Expires', '0');
  //   res.setHeader('X-Content-Type-Options', 'nosniff');

  //   return res.sendFile(filePath);
  // }

  @Get('preview/token/:token/meta')
  async getPreviewMeta(@Param('token') token: string) {
    const meta = await this.fileService.getFilePreviewMeta(token);
    return meta;
  }

  @Post('preview/token/:token/file')
  async previewSharedFile(
    @Param('token') token: string, 
    @Body('password') password: string,
    @Res() res: Response
  ) {
    const metadata = await this.fileService.getByToken(token);
    
    if (metadata?.file.visibility === 'password_protected') {
      const isValid = await bcrypt.compare(password || '', metadata?.file.password || '');
      if (!isValid) {
        throw new ForbiddenException('Invalid password');
      }
    }

    const { buffer, mimeType, isImage } = await this.fileService.generateWatermarkedPreview(token);

    if (isImage) {
      const base64 = buffer.toString('base64');
      const html = `
        <html>
          <head>
            <style>
              body, html {
                margin: 0;
                padding: 0;
                height: 100%;
                background: #000;
                display: flex;
                justify-content: center;
                align-items: center;
              }
              img {
                max-width: 100%;
                max-height: 100%;
                object-fit: contain;
              }
            </style>
          </head>
          <body>
            <img src="data:${mimeType};base64,${base64}" />
          </body>
        </html>
      `;
  
      res.setHeader('Content-Type', 'text/html');
      return res.send(html);
    }

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', 'inline');
    return res.end(buffer);
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete('cleanup-no-expiry')
  async cleanupFilesWithoutExpiry() {
    return this.fileService.deleteFilesWithNoExpiration();
  }

  @Post('share')
  create(@Body() dto: CreateFileShareDto) {
    return this.fileService.createShare(dto);
  }

  @Get('share/:token')
  getByToken(@Param('token') token: string) {
    return this.fileService.getShareInfo(token);
  }

  @Get('share/download')
  async validateAndPrepareSharedFile(@Res() res: Response, @Query('token') token: string) {
    const { file } = await this.fileService.validateAndPrepareDownload(token);

    const filePath = join(__dirname, '..', '..', 'uploads', file.url); // sesuaikan path folder-mu

    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('File tidak ditemukan');
    }

    res.set({
      'Content-Disposition': `attachment; filename="${file.filename}"`,
      'Content-Type': 'application/octet-stream',
    });

    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  }

  @Post('share/:token/download')
  async downloadSharedFile(
    @Param('token') token: string,
    @Body() body: ShareDownloadDto,
    @Res() res: Response,
    @Req() req: ExpressRequest,
  ) {
    const file = await this.fileService.downloadSharedFile(token, body.password);

    await this.fileService.logFileShareDownload(file.id, token, req);

    const filePath = join(__dirname, '..', '..', file.url); // atau sesuai path-mu
    if(!fs.existsSync(filePath)){
      throw new NotFoundException('File Not Found in Server');
    }

    return res.download(filePath, file.filename);
  }

  @Get('share/:fileId/logs')
  async getFileShareLogs(@Param('fileId') fileId: string) {
    return this.fileService.getFileShareLogs(fileId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete(':id')
  async deleteFile(@Param('id') id: string, @Request() req) {
    return this.fileService.deleteFile(id, req.user.userId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get(':id/logs')
  async getFileLogs(
    @Param('id') id: string, 
    @Request() req,
    @Query() paginationDto: PaginationDto,
  ) {

    return this.fileService.getFileLogs(id, req.user.userId, paginationDto.page, paginationDto.limit);
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch(':id/visibility')
  async updateVisibility(
    @Param('id') id: string,
    @Request() req,
    @Body() updateVisibilityDto: UpdateVisibilityDto,
  ) {
    return this.fileService.updateFileVisibility(id, req.user.userId, updateVisibilityDto);
  }

}