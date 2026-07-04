import { BadRequestException, Injectable } from '@nestjs/common';
import { PDFParse } from 'pdf-parse';

@Injectable()
export class PdfParserService {
  async extractText(buffer: Buffer): Promise<string> {
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    try {
      const result = await parser.getText({ pageJoiner: '\n' });
      const text = result.text.trim();
      if (!text) throw new BadRequestException('Could not extract text from this PDF.');
      return text;
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException('Could not parse this PDF. Try another exported CV file.');
    } finally {
      await parser.destroy();
    }
  }
}
