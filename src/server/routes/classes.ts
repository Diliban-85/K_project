import { Router, Response } from 'express';
import prisma from '../db';
import { requireTeacherAuth, AuthenticatedRequest } from '../middleware';
import { assertTeacherOwnsClass, AuthorizationError } from '../authorization';

const router = Router();

// Enforce teacher authentication on all class routes
router.use(requireTeacherAuth);

/**
 * GET /api/classes
 * List classes belonging to the authenticated teacher
 */
router.get('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const teacherId = req.teacher!.id;

    const classes = await prisma.class.findMany({
      where: { teacherId },
      include: {
        _count: {
          select: { subjects: true },
        },
        subjects: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    res.status(200).json({ classes });
  } catch (err) {
    console.error('List classes error:', err);
    res.status(500).json({ error: 'Failed to fetch classes' });
  }
});

/**
 * POST /api/classes
 * Create a new class under the authenticated teacher
 */
router.post('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const teacherId = req.teacher!.id;
    const { name, grade, section, description } = req.body || {};

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({ error: 'Class name is required' });
      return;
    }

    const trimmedName = name.trim();

    // Check for duplicate class name for this teacher
    const existing = await prisma.class.findFirst({
      where: {
        teacherId,
        name: {
          equals: trimmedName,
        },
      },
    });

    if (existing) {
      res.status(400).json({ error: `A class named "${trimmedName}" already exists in your account` });
      return;
    }

    const newClass = await prisma.class.create({
      data: {
        name: trimmedName,
        grade: grade ? String(grade).trim() : null,
        section: section ? String(section).trim() : null,
        description: description ? String(description).trim() : null,
        teacherId,
      },
      include: {
        _count: {
          select: { subjects: true },
        },
      },
    });

    res.status(201).json({
      message: 'Class created successfully',
      class: newClass,
    });
  } catch (err) {
    console.error('Create class error:', err);
    res.status(500).json({ error: 'Failed to create class' });
  }
});

/**
 * GET /api/classes/:id
 * Get single class with ownership verification
 */
router.get('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const teacherId = req.teacher!.id;
    const classId = req.params.id;

    await assertTeacherOwnsClass(teacherId, classId);

    const classRecord = await prisma.class.findUnique({
      where: { id: classId },
      include: {
        subjects: {
          orderBy: { name: 'asc' },
        },
      },
    });

    res.status(200).json({ class: classRecord });
  } catch (err: any) {
    if (err instanceof AuthorizationError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    console.error('Get class error:', err);
    res.status(500).json({ error: 'Failed to fetch class details' });
  }
});

/**
 * PATCH /api/classes/:id
 * Rename / update class with ownership verification
 */
router.patch('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const teacherId = req.teacher!.id;
    const classId = req.params.id;

    await assertTeacherOwnsClass(teacherId, classId);

    const { name, grade, section, description } = req.body || {};

    const updateData: Record<string, any> = {};

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        res.status(400).json({ error: 'Class name cannot be empty' });
        return;
      }
      const trimmedName = name.trim();
      // Check duplicate name excluding current class
      const duplicate = await prisma.class.findFirst({
        where: {
          teacherId,
          name: trimmedName,
          NOT: { id: classId },
        },
      });
      if (duplicate) {
        res.status(400).json({ error: `Another class named "${trimmedName}" already exists in your account` });
        return;
      }
      updateData.name = trimmedName;
    }

    if (grade !== undefined) updateData.grade = grade ? String(grade).trim() : null;
    if (section !== undefined) updateData.section = section ? String(section).trim() : null;
    if (description !== undefined) updateData.description = description ? String(description).trim() : null;

    const updated = await prisma.class.update({
      where: { id: classId },
      data: updateData,
      include: {
        _count: {
          select: { subjects: true },
        },
      },
    });

    res.status(200).json({
      message: 'Class updated successfully',
      class: updated,
    });
  } catch (err: any) {
    if (err instanceof AuthorizationError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    console.error('Update class error:', err);
    res.status(500).json({ error: 'Failed to update class' });
  }
});

/**
 * DELETE /api/classes/:id
 * Delete class with ownership verification
 */
router.delete('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const teacherId = req.teacher!.id;
    const classId = req.params.id;

    await assertTeacherOwnsClass(teacherId, classId);

    await prisma.class.delete({
      where: { id: classId },
    });

    res.status(200).json({
      message: 'Class and associated subjects deleted successfully',
      deletedId: classId,
    });
  } catch (err: any) {
    if (err instanceof AuthorizationError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    console.error('Delete class error:', err);
    res.status(500).json({ error: 'Failed to delete class' });
  }
});

export default router;
