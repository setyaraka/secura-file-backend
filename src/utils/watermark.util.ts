import { degrees, PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import * as sharp from 'sharp';

// import { PDFDocument, rgb, StandardFonts, degrees } from 'pdf-lib';

export async function addPdfWatermark(buffer: Buffer, email: string, timestamp: string): Promise<Buffer> {
  const pdfDoc = await PDFDocument.load(buffer);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const pages = pdfDoc.getPages();

  for (const page of pages) {
    const { width, height } = page.getSize();

    const fontSize = 24;

    const text1 = `Shared with: ${email}`;
    const text2 = `Downloaded at: ${timestamp}`;

    const text1Width = font.widthOfTextAtSize(text1, fontSize);
    const text2Width = font.widthOfTextAtSize(text2, fontSize);

    const centerX1 = (width - text1Width) / 2;
    const centerX2 = (width - text2Width) / 2;

    const centerY = height / 2;

    page.drawText(text1, {
      x: centerX1,
      y: centerY + fontSize + 5,
      size: fontSize,
      font,
      color: rgb(1, 0, 0),
      rotate: degrees(-30),
      opacity: 0.3,
    });

    page.drawText(text2, {
      x: centerX2,
      y: centerY - fontSize - 5,
      size: fontSize,
      font,
      color: rgb(1, 0, 0),
      rotate: degrees(-30),
      opacity: 0.3,
    });
  }

  const pdfBytes = await pdfDoc.save();
  const bufferResult = Buffer.from(pdfBytes);
  return bufferResult
}


export async function addImageWatermark(buffer: Buffer, email: string, timestamp: string): Promise<Buffer> {
    const image = sharp(buffer);
    const { width = 800, height = 600 } = await image.metadata();
  
    const fontSize = Math.floor(Math.min(width, height) / 25);
    const x = width / 2;
    const y = height / 2;
  
    const svg = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <g transform="rotate(-30, ${x}, ${y})" opacity="0.25" fill="red" font-size="${fontSize}" font-family="Arial" text-anchor="middle">
          <text x="${x}" y="${y - fontSize}">Shared with: ${email}</text>
          <text x="${x}" y="${y + fontSize}">Downloaded at: ${timestamp}</text>
        </g>
      </svg>
    `;
  
    return image
      .composite([{ input: Buffer.from(svg), blend: 'over' }])
      .png()
      .toBuffer();
}
  