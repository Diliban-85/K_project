import { Router, Response } from 'express';
import prisma from '../db';
import { requireTeacherAuth, AuthenticatedRequest } from '../middleware';
import { assertTeacherOwnsSubject, assertTeacherOwnsClass, AuthorizationError } from '../authorization';

const router = Router();

// Enforce teacher authentication on all subject routes
router.use(requireTeacherAuth);

/**
 * GET /api/subjects
 * List subjects belonging to the authenticated teacher (with optional classId filter)
 */
router.get('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const teacherId = req.teacher!.id;
    const { classId } = req.query;

    const whereClause: Record<string, any> = { teacherId };

    if (classId && typeof classId === 'string') {
      // Confirm the requested class belongs to the teacher
      await assertTeacherOwnsClass(teacherId, classId);
      whereClause.classId = classId;
    }

    const subjects = await prisma.subject.findMany({
      where: whereClause,
      include: {
        class: {
          select: {
            id: true,
            name: true,
            grade: true,
            section: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    res.status(200).json({ subjects });
  } catch (err: any) {
    if (err instanceof AuthorizationError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    console.error('List subjects error:', err);
    res.status(500).json({ error: 'Failed to fetch subjects' });
  }
});

/**
 * POST /api/subjects
 * Create a new subject under a class owned by the authenticated teacher
 */
router.post('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const teacherId = req.teacher!.id;
    const { name, code, description, classId } = req.body || {};

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({ error: 'Subject name is required' });
      return;
    }

    if (!classId || typeof classId !== 'string') {
      res.status(400).json({ error: 'A valid classId is required for the subject' });
      return;
    }

    // Enforce class ownership: teacher can only add subjects to their own class
    await assertTeacherOwnsClass(teacherId, classId);

    const trimmedName = name.trim();

    // Check duplicate subject name within the same class
    const existing = await prisma.subject.findFirst({
      where: {
        classId,
        name: {
          equals: trimmedName,
        },
      },
    });

    if (existing) {
      res.status(400).json({
        error: `A subject named "${trimmedName}" already exists in this class`,
      });
      return;
    }

    const newSubject = await prisma.subject.create({
      data: {
        name: trimmedName,
        code: code ? String(code).trim().toUpperCase() : null,
        description: description ? String(description).trim() : null,
        classId,
        teacherId,
      },
      include: {
        class: {
          select: {
            id: true,
            name: true,
            grade: true,
            section: true,
          },
        },
      },
    });

    res.status(201).json({
      message: 'Subject created successfully',
      subject: newSubject,
    });
  } catch (err: any) {
    if (err instanceof AuthorizationError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    console.error('Create subject error:', err);
    res.status(500).json({ error: 'Failed to create subject' });
  }
});

/**
 * GET /api/subjects/:id
 * Get single subject with ownership verification
 */
router.get('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const teacherId = req.teacher!.id;
    const subjectId = req.params.id;

    const subject = await assertTeacherOwnsSubject(teacherId, subjectId);

    res.status(200).json({ subject });
  } catch (err: any) {
    if (err instanceof AuthorizationError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    console.error('Get subject error:', err);
    res.status(500).json({ error: 'Failed to fetch subject details' });
  }
});

/**
 * PATCH /api/subjects/:id
 * Rename / update subject with ownership verification
 */
router.patch('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const teacherId = req.teacher!.id;
    const subjectId = req.params.id;

    const currentSubject = await assertTeacherOwnsSubject(teacherId, subjectId);

    const { name, code, description, classId } = req.body || {};

    const updateData: Record<string, any> = {};

    let targetClassId = currentSubject.classId;
    if (classId !== undefined && classId !== currentSubject.classId) {
      // Must verify teacher owns new class
      await assertTeacherOwnsClass(teacherId, classId);
      targetClassId = classId;
      updateData.classId = classId;
    }

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        res.status(400).json({ error: 'Subject name cannot be empty' });
        return;
      }
      const trimmedName = name.trim();
      // Check duplicate in target class excluding this subject
      const duplicate = await prisma.subject.findFirst({
        where: {
          classId: targetClassId,
          name: trimmedName,
          NOT: { id: subjectId },
        },
      });
      if (duplicate) {
        res.status(400).json({
          error: `Another subject named "${trimmedName}" already exists in this class`,
        });
        return;
      }
      updateData.name = trimmedName;
    }

    if (code !== undefined) updateData.code = code ? String(code).trim().toUpperCase() : null;
    if (description !== undefined) updateData.description = description ? String(description).trim() : null;

    const updated = await prisma.subject.update({
      where: { id: subjectId },
      data: updateData,
      include: {
        class: {
          select: {
            id: true,
            name: true,
            grade: true,
            section: true,
          },
        },
      },
    });

    res.status(200).json({
      message: 'Subject updated successfully',
      subject: updated,
    });
  } catch (err: any) {
    if (err instanceof AuthorizationError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    console.error('Update subject error:', err);
    res.status(500).json({ error: 'Failed to update subject' });
  }
});

/**
 * DELETE /api/subjects/:id
 * Delete subject with ownership verification
 */
router.delete('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const teacherId = req.teacher!.id;
    const subjectId = req.params.id;

    await assertTeacherOwnsSubject(teacherId, subjectId);

    await prisma.subject.delete({
      where: { id: subjectId },
    });

    res.status(200).json({
      message: 'Subject deleted successfully',
      deletedId: subjectId,
    });
  } catch (err: any) {
    if (err instanceof AuthorizationError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    console.error('Delete subject error:', err);
    res.status(500).json({ error: 'Failed to delete subject' });
  }
});

export default router;
