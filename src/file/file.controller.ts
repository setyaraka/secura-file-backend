import { BadRequestException, Body, Controller, ForbiddenException, Get, NotFoundException, Param, Post, Request, Res, UploadedFile, UseGuards, UseInterceptors, UsePipes, ValidationPipe } from '@nestjs/common';
import { FileService } from './file.service';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { extname, join } from 'path';
import * as fs from 'fs';
import { Response } from 'express';
import { getRequestInfo } from 'src/utils/request-info';
import { UploadFileDto } from './dto/upload-file.dto';

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
      }
    })
  }))
  
  uploadFile(@UploadedFile() file: Express.Multer.File, @Request() req, @Body() uploadFileDto: UploadFileDto) {
    if (uploadFileDto.expiresAt) {
      const expiresDate = new Date(uploadFileDto.expiresAt);
      const now = new Date();

      if (isNaN(expiresDate.getTime())) {
        throw new BadRequestException('Invalid date format for expiresAt. Use YYYY-MM-DD or ISO format.');
      }

      if (expiresDate <= now) {
        throw new BadRequestException('Expiration date must be in the future.');
      }
    }
    return this.fileService.saveFileMetadata(file, req.user.userId, uploadFileDto.expiresAt);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('my-files')
  async getMyFiles(@Request() req) {
    const userId = req.user.userId;
    
    return this.fileService.getFilesByUser(userId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('download/:id')
  async getFile(@Param('id') id: string, @Request() req, @Res() res: Response) {
    const { ipAddress, userAgent } = getRequestInfo(req);

    const file = await this.fileService.getFileById(id);

    if (!file) {
      await this.fileService.logFailedAccess(id, ipAddress, userAgent, 'File not found in database');
      throw new NotFoundException('File not found');
    }

    if (file.ownerId !== req.user.userId) {
      await this.fileService.logFailedAccess(id, ipAddress, userAgent, 'Forbidden access');
      throw new ForbiddenException('You do not have access to this file');
    }

    const filePath = join(__dirname, '..', '..', 'uploads', file.filename);

    if (!fs.existsSync(filePath)) {
      await this.fileService.logFailedAccess(id, ipAddress, userAgent, 'File does not exist on server');
      throw new NotFoundException('File does not exist on server');
    }

    if (file.expiresAt && new Date() > file.expiresAt) {
      await this.fileService.logFailedAccess(id, ipAddress, userAgent, 'File has expired');
      throw new ForbiddenException('File has expired');
    }

    await this.fileService.logFileAccess(file.id, req.ip, req.headers['user-agent']);

    return res.download(filePath, file.filename);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('download/:id/access-logs')
  async getFileAccessLogs(@Param('id') id: string, @Request() req) {
    const file = await this.fileService.getFileById(id);

    if (!file) {
      throw new NotFoundException('File not found');
    }

    if (file.ownerId !== req.user.userId) {
      throw new ForbiddenException('You do not have access to this file');
    }

    return this.fileService.getAccessLogsByFileId(file.id);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get(':id/failed-logs')
  async getFailedLogs(@Param('id') id: string, @Request() req) {
    return this.fileService.getFailedAccessLogsByFileId(id);
  }
}
