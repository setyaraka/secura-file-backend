import { Injectable } from '@nestjs/common';
import { addImageWatermark, addPdfWatermark } from '../utils/watermark.util';
import * as fs from 'fs/promises';

@Injectable()
export class PreviewService {
    async generateWatermarkedPreview(filePath: string, mimeType: string, email: string, timestamp: string): Promise<Buffer> {
        const buffer = await fs.readFile(filePath);
    
        if (mimeType === 'application/pdf') {
          return await addPdfWatermark(buffer, email, timestamp);
        }
    
        if (mimeType.startsWith('image/')) {
          return await addImageWatermark(buffer, email, timestamp);
        }
    
        throw new Error('Unsupported file type for preview');
    }
}
