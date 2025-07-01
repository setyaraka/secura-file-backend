import { Controller, ForbiddenException, Get, NotFoundException, Param, Post, Request, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileService } from './file.service';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { extname, join } from 'path';
import * as fs from 'fs';
import { Response } from 'express';

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
  uploadFile(@UploadedFile() file: Express.Multer.File, @Request() req) {
    return this.fileService.saveFileMetadata(file, req.user.userId);
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
    const file = await this.fileService.getFileById(id);

    if (!file) {
      throw new NotFoundException('File not found');
    }

    if (file.ownerId !== req.user.userId) {
      throw new ForbiddenException('You do not have access to this file');
    }

    const filePath = join(__dirname, '..', '..', 'uploads', file.filename);

    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('File does not exist on server');
    }

    return res.download(filePath, file.filename);
  }
}
