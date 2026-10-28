import { Router, Response, NextFunction } from 'express';
import prisma from '../db';
import { requireTeacherAuth, AuthenticatedRequest } from '../middleware';

export const settingsRouter = Router();

settingsRouter.use(requireTeacherAuth);

/**
 * GET /api/settings
 * Retrieve or initialize system and school profile settings for the authenticated teacher.
 */
settingsRouter.get(
  '/',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const teacherId = req.teacher!.id;

      let settings = await prisma.systemSettings.findUnique({
        where: { teacherId },
      });

      if (!settings) {
        settings = await prisma.systemSettings.create({
          data: {
            teacherId,
            schoolName: 'Springfield High School',
            schoolAddress: '123 Education Lane, Academic City',
            contactPhone: '+1 (555) 019-2834',
            contactEmail: req.teacher!.email,
            academicYear: '2025-2026',
            defaultExamName: 'Annual Examination',
            defaultTotalMarks: 100,
            defaultDuration: '3 Hours',
            defaultInstructions:
              '1. All questions are compulsory unless specified.\n2. Read all questions carefully before answering.\n3. Write your Roll Number clearly on the answer sheet.\n4. Programmable calculators are not allowed unless stated.',
            fontSizePreference: 'NORMAL',
            showWatermark: false,
          },
        });
      }

      res.json({
        settings,
        teacher: {
          id: req.teacher!.id,
          name: req.teacher!.name,
          email: req.teacher!.email,
          role: req.teacher!.role,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PUT /api/settings
 * Update system and school profile settings.
 */
settingsRouter.put(
  '/',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const teacherId = req.teacher!.id;
      const {
        schoolName,
        schoolAddress,
        contactPhone,
        contactEmail,
        website,
        logoUrl,
        academicYear,
        defaultExamName,
        defaultClassId,
        defaultSubjectId,
        defaultTotalMarks,
        defaultDuration,
        defaultInstructions,
        fontSizePreference,
        showWatermark,
        watermarkText,
      } = req.body;

      if (!schoolName || typeof schoolName !== 'string' || !schoolName.trim()) {
        return res.status(400).json({
          error: 'School name is required and cannot be empty.',
          code: 'INVALID_INPUT',
        });
      }

      const totalMarksNum = Number(defaultTotalMarks) || 100;
      if (totalMarksNum <= 0 || totalMarksNum > 1000) {
        return res.status(400).json({
          error: 'Default total marks must be a positive integer between 1 and 1000.',
          code: 'INVALID_INPUT',
        });
      }

      const updated = await prisma.systemSettings.upsert({
        where: { teacherId },
        update: {
          schoolName: schoolName.trim(),
          schoolAddress: schoolAddress ? schoolAddress.trim() : null,
          contactPhone: contactPhone ? contactPhone.trim() : null,
          contactEmail: contactEmail ? contactEmail.trim() : null,
          website: website ? website.trim() : null,
          logoUrl: logoUrl ? logoUrl.trim() : null,
          academicYear: academicYear ? academicYear.trim() : '2025-2026',
          defaultExamName: defaultExamName ? defaultExamName.trim() : 'Annual Examination',
          defaultClassId: defaultClassId || null,
          defaultSubjectId: defaultSubjectId || null,
          defaultTotalMarks: totalMarksNum,
          defaultDuration: defaultDuration ? defaultDuration.trim() : '3 Hours',
          defaultInstructions: defaultInstructions ? defaultInstructions.trim() : null,
          fontSizePreference: ['COMPACT', 'NORMAL', 'LARGE'].includes(fontSizePreference)
            ? fontSizePreference
            : 'NORMAL',
          showWatermark: Boolean(showWatermark),
          watermarkText: watermarkText ? watermarkText.trim() : null,
        },
        create: {
          teacherId,
          schoolName: schoolName.trim(),
          schoolAddress: schoolAddress ? schoolAddress.trim() : null,
          contactPhone: contactPhone ? contactPhone.trim() : null,
          contactEmail: contactEmail ? contactEmail.trim() : null,
          website: website ? website.trim() : null,
          logoUrl: logoUrl ? logoUrl.trim() : null,
          academicYear: academicYear ? academicYear.trim() : '2025-2026',
          defaultExamName: defaultExamName ? defaultExamName.trim() : 'Annual Examination',
          defaultClassId: defaultClassId || null,
          defaultSubjectId: defaultSubjectId || null,
          defaultTotalMarks: totalMarksNum,
          defaultDuration: defaultDuration ? defaultDuration.trim() : '3 Hours',
          defaultInstructions: defaultInstructions ? defaultInstructions.trim() : null,
          fontSizePreference: ['COMPACT', 'NORMAL', 'LARGE'].includes(fontSizePreference)
            ? fontSizePreference
            : 'NORMAL',
          showWatermark: Boolean(showWatermark),
          watermarkText: watermarkText ? watermarkText.trim() : null,
        },
      });

      // Log audit event
      await prisma.auditLog.create({
        data: {
          teacherId,
          action: 'SETTINGS_UPDATED',
          entityType: 'SETTINGS',
          entityId: updated.id,
          details: JSON.stringify({
            schoolName: updated.schoolName,
            academicYear: updated.academicYear,
            defaultExamName: updated.defaultExamName,
            defaultTotalMarks: updated.defaultTotalMarks,
          }),
        },
      });

      res.json({
        success: true,
        message: 'School profile and system preferences successfully updated.',
        settings: updated,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/settings/audit-logs
 * Retrieve system audit activity log.
 */
settingsRouter.get(
  '/audit-logs',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const teacherId = req.teacher!.id;
      const limit = Number(req.query.limit) || 100;

      const logs = await prisma.auditLog.findMany({
        where: { teacherId },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      res.json({ logs });
    } catch (err) {
      next(err);
    }
  }
);
