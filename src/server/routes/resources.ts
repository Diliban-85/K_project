import { Router, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import { randomUUID } from 'crypto';
import prisma from '../db';
import { requireTeacherAuth, AuthenticatedRequest } from '../middleware';
import {
  assertTeacherOwnsClass,
  assertTeacherOwnsSubject,
  assertTeacherOwnsResource,
  AuthorizationError,
} from '../authorization';
import { getStorageProvider } from '../storage';
import { processUploadedResource } from '../processors/documentProcessor';

export const resourcesRouter = Router();

// Configure multer for memory storage with 50MB file size limit
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB maximum
  },
});

// Allowed educational MIME types and extensions
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-powerpoint',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

const ALLOWED_EXTENSIONS = new Set([
  '.pdf',
  '.docx',
  '.doc',
  '.pptx',
  '.ppt',
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
]);

function isAllowedFile(originalname: string, mimetype: string): boolean {
  const ext = path.extname(originalname).toLowerCase();
  if (ALLOWED_EXTENSIONS.has(ext)) return true;
  if (ALLOWED_MIME_TYPES.has(mimetype)) return true;
  return false;
}

/**
 * GET /api/resources
 * Lists resources owned by the requesting teacher, with optional classId and subjectId filtering.
 */
resourcesRouter.get(
  '/',
  requireTeacherAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const teacherId = req.teacher!.id;
      const { classId, subjectId } = req.query;

      const whereClause: any = { teacherId };

      if (classId && typeof classId === 'string') {
        await assertTeacherOwnsClass(teacherId, classId);
        whereClause.classId = classId;
      }

      if (subjectId && typeof subjectId === 'string') {
        await assertTeacherOwnsSubject(teacherId, subjectId);
        whereClause.subjectId = subjectId;
      }

      const resources = await prisma.resource.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        include: {
          class: {
            select: { id: true, name: true, grade: true, section: true },
          },
          subject: {
            select: { id: true, name: true, code: true },
          },
          file: {
            select: { id: true, originalName: true, mimeType: true, sizeBytes: true },
          },
          _count: {
            select: { pages: true },
          },
        },
      });

      res.json({ resources });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/resources/:id
 * Fetches a single resource with full page details and metadata. Enforces teacher ownership.
 */
resourcesRouter.get(
  '/:id',
  requireTeacherAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const teacherId = req.teacher!.id;
      const resource = await assertTeacherOwnsResource(teacherId, req.params.id);

      res.json({ resource });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/resources
 * Uploads a document resource, saves it in private storage, and triggers document processing.
 */
resourcesRouter.post(
  '/',
  requireTeacherAuth,
  (req: any, res: Response, next: NextFunction) => {
    upload.single('file')(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            error: 'File size exceeds 50MB limit',
            code: 'FILE_TOO_LARGE',
          });
        }
        return res.status(400).json({
          error: `Upload error: ${err.message}`,
          code: 'UPLOAD_FAILED',
        });
      } else if (err) {
        return res.status(400).json({
          error: err.message || 'File upload failed',
          code: 'UPLOAD_FAILED',
        });
      }
      next();
    });
  },
  async (req: any, res: Response, next: NextFunction) => {
    try {
      const teacherId = req.teacher!.id;
      const { name, classId, subjectId } = req.body;
      const file = req.file;

      if (!name || typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({
          error: 'Resource name is required',
          code: 'INVALID_INPUT',
        });
      }

      if (!classId || typeof classId !== 'string') {
        return res.status(400).json({
          error: 'Assigned class ID is required',
          code: 'INVALID_INPUT',
        });
      }

      if (!subjectId || typeof subjectId !== 'string') {
        return res.status(400).json({
          error: 'Assigned subject ID is required',
          code: 'INVALID_INPUT',
        });
      }

      if (!file) {
        return res.status(400).json({
          error: 'No document file was uploaded',
          code: 'FILE_MISSING',
        });
      }

      // Validate ownership of both Class and Subject
      await assertTeacherOwnsClass(teacherId, classId);
      const subject = await assertTeacherOwnsSubject(teacherId, subjectId);

      // Verify that subject actually belongs to the specified class
      if (subject.classId !== classId) {
        return res.status(400).json({
          error: 'Selected subject does not belong to the selected class',
          code: 'INVALID_CLASS_SUBJECT_RELATION',
        });
      }

      // Validate file type
      if (!isAllowedFile(file.originalname, file.mimetype)) {
        return res.status(400).json({
          error:
            'Unsupported file format. Please upload educational materials in PDF, DOCX, PPTX, or image formats.',
          code: 'UNSUPPORTED_FILE_TYPE',
        });
      }

      const resourceId = randomUUID();
      const sanitizedFilename = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
      const storageKey = `teachers/${teacherId}/resources/${resourceId}/${sanitizedFilename}`;

      // 1. Put file into private S3-compatible storage
      const storage = getStorageProvider();
      await storage.putObject(storageKey, file.buffer, file.mimetype);

      // 2. Insert Prisma records
      const resource = await prisma.resource.create({
        data: {
          id: resourceId,
          name: name.trim(),
          fileType: file.mimetype || 'application/octet-stream',
          fileSize: file.size,
          storagePath: storageKey,
          processingStatus: 'PROCESSING',
          teacherId,
          classId,
          subjectId,
          file: {
            create: {
              originalName: file.originalname,
              mimeType: file.mimetype || 'application/octet-stream',
              sizeBytes: file.size,
              storageProvider: 'local-s3-compatible',
              storageKey,
            },
          },
        },
        include: {
          class: true,
          subject: true,
          file: true,
        },
      });

      // 3. Document Processing (asynchronous foundation for PDF / DOCX)
      const processResult = await processUploadedResource(
        resource.id,
        file.mimetype,
        file.buffer
      );

      const finalResource = await prisma.resource.findUnique({
        where: { id: resource.id },
        include: {
          class: true,
          subject: true,
          file: true,
          pages: {
            orderBy: { pageNumber: 'asc' },
          },
        },
      });

      res.status(201).json({
        message: 'Resource uploaded and processed successfully',
        resource: finalResource,
        processing: processResult,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/resources/:id/file
 * Securely streams the uploaded file from the storage provider.
 * Strictly verifies teacher authentication and ownership.
 */
resourcesRouter.get(
  '/:id/file',
  requireTeacherAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const teacherId = req.teacher!.id;
      const resource = await assertTeacherOwnsResource(teacherId, req.params.id);

      const storage = getStorageProvider();
      const filename = resource.file?.originalName || `${resource.name}.pdf`;
      const contentType = resource.fileType || 'application/pdf';

      // Parse HTTP range header if requested (critical for progressive PDF streaming)
      const rangeHeader = req.headers.range;
      let range: { start?: number; end?: number } | undefined;

      if (rangeHeader && rangeHeader.startsWith('bytes=')) {
        const parts = rangeHeader.replace('bytes=', '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : undefined;
        if (!isNaN(start)) {
          range = { start, end };
        }
      }

      const obj = await storage.getObject(resource.storagePath, range);

      if (!obj) {
        return res.status(404).json({
          error: 'File content not found in storage vault',
          code: 'FILE_NOT_FOUND',
        });
      }

      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Content-Type', obj.contentType || contentType);
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(filename)}"`);
      res.setHeader('Cache-Control', 'private, max-age=86400');

      if (obj.isRange && obj.start !== undefined && obj.end !== undefined) {
        res.status(206);
        res.setHeader('Content-Range', `bytes ${obj.start}-${obj.end}/${obj.totalSize}`);
        res.setHeader('Content-Length', obj.size);
      } else {
        res.status(200);
        res.setHeader('Content-Length', obj.size);
      }

      obj.stream.pipe(res);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * DELETE /api/resources/:id
 * Deletes a resource and its backing storage object. Enforces teacher ownership.
 */
resourcesRouter.delete(
  '/:id',
  requireTeacherAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const teacherId = req.teacher!.id;
      const resource = await assertTeacherOwnsResource(teacherId, req.params.id);

      // 1. Delete backing file from storage
      const storage = getStorageProvider();
      await storage.deleteObject(resource.storagePath);

      // 2. Delete database record (cascade deletes file and pages)
      await prisma.resource.delete({
        where: { id: req.params.id },
      });

      res.json({
        message: 'Resource deleted successfully',
        deletedId: req.params.id,
      });
    } catch (err) {
      next(err);
    }
  }
);
