import { createRequire } from 'module';
import prisma from '../db';

const require = createRequire(import.meta.url);
const pdfModule = require('pdf-parse');
const PDFParse = pdfModule.PDFParse || pdfModule.default?.PDFParse || pdfModule;

export interface ProcessedDocumentResult {
  status: 'READY' | 'FAILED' | 'PROCESSING';
  numPages: number;
  pages: Array<{
    pageNumber: number;
    text: string;
    wordCount: number;
  }>;
  error?: string;
}

export async function processPdfDocument(
  resourceId: string,
  fileBuffer: Buffer
): Promise<ProcessedDocumentResult> {
  try {
    const pageRecords: Array<{
      pageNumber: number;
      text: string;
      wordCount: number;
    }> = [];

    // Instantiate parser with Buffer
    const parser = new PDFParse({ data: fileBuffer });
    const result = await parser.getText();

    const totalPages = result.total || (result.pages ? result.pages.length : 1);

    if (Array.isArray(result.pages) && result.pages.length > 0) {
      for (let i = 0; i < result.pages.length; i++) {
        const p = result.pages[i];
        const text = (p.text || '').replace(/\s+/g, ' ').trim();
        const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
        pageRecords.push({
          pageNumber: p.num || i + 1,
          text,
          wordCount: words,
        });
      }
    } else {
      const overallText = (result.text || '').replace(/\s+/g, ' ').trim();
      const words = overallText ? overallText.split(/\s+/).filter(Boolean).length : 0;
      pageRecords.push({
        pageNumber: 1,
        text: overallText,
        wordCount: words,
      });
    }

    // Clean up parser memory
    if (typeof parser.destroy === 'function') {
      await parser.destroy().catch(() => {});
    }

    // Delete any prior page records for idempotence
    await prisma.resourcePage.deleteMany({
      where: { resourceId },
    });

    // Save page records
    if (pageRecords.length > 0) {
      await prisma.resourcePage.createMany({
        data: pageRecords.map((p) => ({
          resourceId,
          pageNumber: p.pageNumber,
          text: p.text,
          wordCount: p.wordCount,
        })),
      });
    }

    // Update resource status to READY
    await prisma.resource.update({
      where: { id: resourceId },
      data: {
        processingStatus: 'READY',
        processingError: null,
      },
    });

    return {
      status: 'READY',
      numPages: totalPages,
      pages: pageRecords,
    };
  } catch (err: any) {
    const errorMessage = err?.message || 'Failed to process PDF document';

    await prisma.resource.update({
      where: { id: resourceId },
      data: {
        processingStatus: 'FAILED',
        processingError: errorMessage,
      },
    });

    return {
      status: 'FAILED',
      numPages: 0,
      pages: [],
      error: errorMessage,
    };
  }
}

/**
 * Foundation processor dispatcher for all supported educational file formats.
 * For DOCX, PPTX, and Images: correctly preserves file and marks processing status
 * honestly without generating fake text extraction.
 */
export async function processUploadedResource(
  resourceId: string,
  mimeType: string,
  fileBuffer: Buffer
): Promise<ProcessedDocumentResult> {
  const isPdf =
    mimeType === 'application/pdf' ||
    mimeType.toLowerCase().includes('pdf');

  if (isPdf) {
    return processPdfDocument(resourceId, fileBuffer);
  }

  // DOCX, PPTX, or Image formats
  // Prepare foundation for Phase 3 text/OCR extractors
  await prisma.resource.update({
    where: { id: resourceId },
    data: {
      processingStatus: 'READY',
      processingError: 'Original file preserved. Deep text extraction scheduled for Phase 3.',
    },
  });

  return {
    status: 'READY',
    numPages: 0,
    pages: [],
  };
}
