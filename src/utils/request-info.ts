import { Request } from "express";
import { extname } from "path";

export function getRequestInfo(req: Request) {
    const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
    const userAgent = req.headers['user-agent'] || '';
  
    return {
        ipAddress: Array.isArray(ipAddress) ? ipAddress[0] : ipAddress,
        userAgent,
    };
}

export function getContentType(filename: string): string {
    const ext = extname(filename).toLowerCase();
    switch (ext) {
        case '.pdf':
            return 'application/pdf';
        case '.png':
            return 'image/png';
        case '.jpg':
        case '.jpeg':
            return 'image/jpeg';
        case '.txt':
            return 'text/plain';
        default:
            return 'application/octet-stream';
    }
}