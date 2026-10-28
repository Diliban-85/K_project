import { Router, Response, NextFunction } from 'express';
import prisma from '../db';
import { requireTeacherAuth, AuthenticatedRequest } from '../middleware';

export const backupRouter = Router();

backupRouter.use(requireTeacherAuth);

/**
 * GET /api/backup/export
 * Administrative structured JSON export of teacher data (excluding secrets).
 */
backupRouter.get(
  '/export',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const teacherId = req.teacher!.id;

      const [settings, classes, subjects, bankQuestions, papers, auditLogs] =
        await Promise.all([
          prisma.systemSettings.findUnique({ where: { teacherId } }),
          prisma.class.findMany({
            where: { teacherId },
            include: { subjects: true },
          }),
          prisma.subject.findMany({ where: { teacherId } }),
          prisma.bankQuestion.findMany({ where: { teacherId } }),
          prisma.paper.findMany({
            where: { teacherId },
            include: {
              class: { select: { id: true, name: true, grade: true, section: true } },
              subject: { select: { id: true, name: true, code: true } },
              sections: {
                include: {
                  choiceGroups: {
                    include: { questions: true },
                  },
                  questions: true,
                },
              },
              pdfHistories: true,
            },
          }),
          prisma.auditLog.findMany({
            where: { teacherId },
            orderBy: { createdAt: 'desc' },
            take: 100,
          }),
        ]);

      const exportPayload = {
        meta: {
          app: 'School Examination Assessment Portal',
          version: '1.0.0',
          phase: 'Phase 6 Production',
          exportedAt: new Date().toISOString(),
          teacher: {
            name: req.teacher!.name,
            email: req.teacher!.email,
          },
        },
        settings: settings || null,
        classes,
        subjects,
        bankQuestions,
        papers,
        auditLogsCount: auditLogs.length,
      };

      await prisma.auditLog.create({
        data: {
          teacherId,
          action: 'BACKUP_EXPORTED',
          entityType: 'BACKUP',
          details: `Exported ${papers.length} paper(s) and ${bankQuestions.length} bank question(s)`,
        },
      });

      res.setHeader('Content-Type', 'application/json');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="exam-portal-backup-${new Date().toISOString().slice(0, 10)}.json"`
      );
      res.json(exportPayload);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/backup/export-csv
 * CSV export of examination papers summary.
 */
backupRouter.get(
  '/export-csv',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const teacherId = req.teacher!.id;

      const papers = await prisma.paper.findMany({
        where: { teacherId },
        include: {
          class: true,
          subject: true,
          _count: { select: { sections: true, questions: true } },
        },
        orderBy: { updatedAt: 'desc' },
      });

      const rows: string[] = [];
      // CSV Header
      rows.push(
        [
          'Paper ID',
          'Examination Name',
          'Class',
          'Subject',
          'Academic Year',
          'Duration',
          'Total Marks',
          'Status',
          'Sections Count',
          'Questions Count',
          'PDF Generated',
          'PDF Version',
          'Created Date',
        ].map((f) => `"${f.replace(/"/g, '""')}"`).join(',')
      );

      for (const p of papers) {
        rows.push(
          [
            p.id,
            p.examinationName,
            p.class?.name || '',
            p.subject?.name || '',
            p.academicYear || '2025-2026',
            p.duration || '',
            String(p.totalMarks),
            p.status,
            String(p._count.sections),
            String(p._count.questions),
            p.pdfGeneratedAt ? new Date(p.pdfGeneratedAt).toISOString() : 'None',
            String(p.pdfVersion || 0),
            new Date(p.createdAt).toISOString(),
          ].map((f) => `"${String(f).replace(/"/g, '""')}"`).join(',')
        );
      }

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="papers-export-${new Date().toISOString().slice(0, 10)}.csv"`
      );
      res.send(rows.join('\n'));
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/backup/restore
 * Safe validation and selective restoration from structured JSON backup.
 */
backupRouter.post(
  '/restore',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const teacherId = req.teacher!.id;
      const { backupData, restoreSettings = true, restoreQuestions = true } = req.body;

      if (!backupData || typeof backupData !== 'object') {
        return res.status(400).json({
          error: 'Invalid backup payload. Expected structured JSON object.',
          code: 'INVALID_BACKUP_FORMAT',
        });
      }

      // Check structure validity
      if (!backupData.meta || !backupData.meta.app) {
        return res.status(400).json({
          error: 'Unrecognized backup file format. Missing metadata header.',
          code: 'INVALID_SCHEMA',
        });
      }

      let restoredQuestions = 0;
      let restoredSettings = false;

      // Restore settings if present and requested
      if (restoreSettings && backupData.settings) {
        const s = backupData.settings;
        await prisma.systemSettings.upsert({
          where: { teacherId },
          update: {
            schoolName: s.schoolName || 'Springfield High School',
            schoolAddress: s.schoolAddress || null,
            contactPhone: s.contactPhone || null,
            contactEmail: s.contactEmail || null,
            website: s.website || null,
            academicYear: s.academicYear || '2025-2026',
            defaultExamName: s.defaultExamName || 'Annual Examination',
            defaultTotalMarks: Number(s.defaultTotalMarks) || 100,
            defaultDuration: s.defaultDuration || '3 Hours',
            defaultInstructions: s.defaultInstructions || null,
            fontSizePreference: s.fontSizePreference || 'NORMAL',
            showWatermark: Boolean(s.showWatermark),
          },
          create: {
            teacherId,
            schoolName: s.schoolName || 'Springfield High School',
            schoolAddress: s.schoolAddress || null,
            contactPhone: s.contactPhone || null,
            contactEmail: s.contactEmail || null,
            website: s.website || null,
            academicYear: s.academicYear || '2025-2026',
            defaultExamName: s.defaultExamName || 'Annual Examination',
            defaultTotalMarks: Number(s.defaultTotalMarks) || 100,
            defaultDuration: s.defaultDuration || '3 Hours',
            defaultInstructions: s.defaultInstructions || null,
            fontSizePreference: s.fontSizePreference || 'NORMAL',
            showWatermark: Boolean(s.showWatermark),
          },
        });
        restoredSettings = true;
      }

      // Restore Question Bank items safely (deduplicating existing)
      if (restoreQuestions && Array.isArray(backupData.bankQuestions)) {
        for (const q of backupData.bankQuestions) {
          if (!q.questionText || !q.questionText.trim()) continue;

          const exists = await prisma.bankQuestion.findFirst({
            where: {
              teacherId,
              questionText: q.questionText.trim(),
            },
          });

          if (!exists) {
            await prisma.bankQuestion.create({
              data: {
                teacherId,
                questionText: q.questionText.trim(),
                marks: Number(q.marks) || 1,
                questionType: q.questionType || 'SUBJECTIVE',
                difficulty: q.difficulty || 'MEDIUM',
                chapter: q.chapter || null,
                topic: q.topic || null,
                visualAssetUrl: q.visualAssetUrl || null,
                cropCoordinates: q.cropCoordinates || null,
                isArchived: Boolean(q.isArchived),
              },
            });
            restoredQuestions++;
          }
        }
      }

      await prisma.auditLog.create({
        data: {
          teacherId,
          action: 'BACKUP_RESTORED',
          entityType: 'BACKUP',
          details: `Restored backup: ${restoredQuestions} question(s) imported, settings updated: ${restoredSettings}`,
        },
      });

      res.json({
        success: true,
        message: 'Backup restored successfully without destructive overwrites.',
        summary: {
          restoredSettings,
          restoredQuestions,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);
