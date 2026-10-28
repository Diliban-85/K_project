import { Router, Response, NextFunction } from 'express';
import prisma from '../db';
import { requireTeacherAuth, AuthenticatedRequest } from '../middleware';
import { assertTeacherOwnsClass, assertTeacherOwnsSubject } from '../authorization';

export const questionBankRouter = Router();

questionBankRouter.use(requireTeacherAuth);

/**
 * GET /api/question-bank
 * List all question bank questions with filtering, search, sorting and archive support.
 */
questionBankRouter.get(
  '/',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const teacherId = req.teacher!.id;
      const {
        search,
        classId,
        subjectId,
        questionType,
        difficulty,
        minMarks,
        maxMarks,
        isArchived,
        sortBy = 'updatedAt',
        sortOrder = 'desc',
      } = req.query;

      const whereClause: any = { teacherId };

      if (isArchived === 'true') {
        whereClause.isArchived = true;
      } else if (isArchived === 'false' || isArchived === undefined) {
        whereClause.isArchived = false;
      }

      if (classId && typeof classId === 'string' && classId !== 'ALL') {
        whereClause.classId = classId;
      }

      if (subjectId && typeof subjectId === 'string' && subjectId !== 'ALL') {
        whereClause.subjectId = subjectId;
      }

      if (questionType && typeof questionType === 'string' && questionType !== 'ALL') {
        whereClause.questionType = questionType;
      }

      if (difficulty && typeof difficulty === 'string' && difficulty !== 'ALL') {
        whereClause.difficulty = difficulty;
      }

      if (minMarks || maxMarks) {
        whereClause.marks = {};
        if (minMarks) whereClause.marks.gte = Number(minMarks);
        if (maxMarks) whereClause.marks.lte = Number(maxMarks);
      }

      if (search && typeof search === 'string' && search.trim()) {
        const query = search.trim();
        whereClause.OR = [
          { questionText: { contains: query } },
          { chapter: { contains: query } },
          { topic: { contains: query } },
        ];
      }

      const orderBy: any = {};
      if (sortBy === 'marks') {
        orderBy.marks = sortOrder === 'asc' ? 'asc' : 'desc';
      } else if (sortBy === 'questionText') {
        orderBy.questionText = sortOrder === 'asc' ? 'asc' : 'desc';
      } else if (sortBy === 'createdAt') {
        orderBy.createdAt = sortOrder === 'asc' ? 'asc' : 'desc';
      } else {
        orderBy.updatedAt = sortOrder === 'asc' ? 'asc' : 'desc';
      }

      const questions = await prisma.bankQuestion.findMany({
        where: whereClause,
        orderBy,
      });

      // Fetch class & subject names for display
      const classes = await prisma.class.findMany({
        where: { teacherId },
        select: { id: true, name: true, grade: true, section: true },
      });
      const subjects = await prisma.subject.findMany({
        where: { teacherId },
        select: { id: true, name: true, code: true, classId: true },
      });

      const classMap = new Map(classes.map((c) => [c.id, c]));
      const subjectMap = new Map(subjects.map((s) => [s.id, s]));

      const enrichedQuestions = questions.map((q) => ({
        ...q,
        class: q.classId ? classMap.get(q.classId) || null : null,
        subject: q.subjectId ? subjectMap.get(q.subjectId) || null : null,
      }));

      res.json({
        questions: enrichedQuestions,
        total: enrichedQuestions.length,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/question-bank
 * Create a new question in the central Question Bank.
 */
questionBankRouter.post(
  '/',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const teacherId = req.teacher!.id;
      const {
        questionText,
        marks = 1,
        questionType = 'SUBJECTIVE',
        difficulty = 'MEDIUM',
        classId,
        subjectId,
        chapter,
        topic,
        visualAssetUrl,
        cropCoordinates,
        sourceResourceId,
        sourcePageNumber,
        sourceQuestionNumber,
      } = req.body;

      if (!questionText || typeof questionText !== 'string' || !questionText.trim()) {
        return res.status(400).json({
          error: 'Question text is required and cannot be empty.',
          code: 'INVALID_INPUT',
        });
      }

      const marksNum = Number(marks) || 1;
      if (marksNum < 1) {
        return res.status(400).json({
          error: 'Marks must be at least 1.',
          code: 'INVALID_INPUT',
        });
      }

      if (classId) {
        await assertTeacherOwnsClass(teacherId, classId);
      }
      if (subjectId) {
        await assertTeacherOwnsSubject(teacherId, subjectId);
      }

      const newQuestion = await prisma.bankQuestion.create({
        data: {
          teacherId,
          questionText: questionText.trim(),
          marks: marksNum,
          questionType: questionType || 'SUBJECTIVE',
          difficulty: difficulty || 'MEDIUM',
          classId: classId || null,
          subjectId: subjectId || null,
          chapter: chapter ? chapter.trim() : null,
          topic: topic ? topic.trim() : null,
          visualAssetUrl: visualAssetUrl || null,
          cropCoordinates: cropCoordinates || null,
          sourceResourceId: sourceResourceId || null,
          sourcePageNumber: sourcePageNumber ? Number(sourcePageNumber) : null,
          sourceQuestionNumber: sourceQuestionNumber ? String(sourceQuestionNumber) : null,
          isArchived: false,
        },
      });

      await prisma.auditLog.create({
        data: {
          teacherId,
          action: 'QUESTION_CREATED',
          entityType: 'QUESTION',
          entityId: newQuestion.id,
          details: JSON.stringify({
            questionText: newQuestion.questionText.slice(0, 80),
            marks: newQuestion.marks,
            questionType: newQuestion.questionType,
          }),
        },
      });

      res.status(201).json({
        success: true,
        message: 'Question added to Question Bank.',
        question: newQuestion,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PUT /api/question-bank/:id & PATCH /api/question-bank/:id
 * Update an existing bank question.
 */
const handleUpdateQuestion = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const teacherId = req.teacher!.id;
    const { id } = req.params;
    const {
      questionText,
      marks,
      questionType,
      difficulty,
      classId,
      subjectId,
      chapter,
      topic,
      visualAssetUrl,
      cropCoordinates,
    } = req.body;

    const existing = await prisma.bankQuestion.findFirst({
      where: { id, teacherId },
    });

    if (!existing) {
      return res.status(404).json({
        error: 'Question not found in Question Bank.',
        code: 'NOT_FOUND',
      });
    }

    if (questionText !== undefined) {
      if (typeof questionText !== 'string' || !questionText.trim()) {
        return res.status(400).json({
          error: 'Question text cannot be empty.',
          code: 'INVALID_INPUT',
        });
      }
    }

    if (classId) {
      await assertTeacherOwnsClass(teacherId, classId);
    }
    if (subjectId) {
      await assertTeacherOwnsSubject(teacherId, subjectId);
    }

    const updated = await prisma.bankQuestion.update({
      where: { id },
      data: {
        questionText: questionText !== undefined ? questionText.trim() : existing.questionText,
        marks: marks ? Number(marks) : existing.marks,
        questionType: questionType || existing.questionType,
        difficulty: difficulty || existing.difficulty,
        classId: classId !== undefined ? classId : existing.classId,
        subjectId: subjectId !== undefined ? subjectId : existing.subjectId,
        chapter: chapter !== undefined ? (chapter ? chapter.trim() : null) : existing.chapter,
        topic: topic !== undefined ? (topic ? topic.trim() : null) : existing.topic,
        visualAssetUrl: visualAssetUrl !== undefined ? visualAssetUrl : existing.visualAssetUrl,
        cropCoordinates: cropCoordinates !== undefined ? cropCoordinates : existing.cropCoordinates,
      },
    });

    await prisma.auditLog.create({
      data: {
        teacherId,
        action: 'QUESTION_UPDATED',
        entityType: 'QUESTION',
        entityId: updated.id,
        details: JSON.stringify({
          questionText: updated.questionText.slice(0, 80),
          marks: updated.marks,
        }),
      },
    });

    res.json({
      success: true,
      message: 'Question updated successfully.',
      question: updated,
    });
  } catch (err) {
    next(err);
  }
};

questionBankRouter.put('/:id', handleUpdateQuestion);
questionBankRouter.patch('/:id', handleUpdateQuestion);

/**
 * POST /api/question-bank/:id/duplicate
 * Duplicate a bank question.
 */
questionBankRouter.post(
  '/:id/duplicate',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const teacherId = req.teacher!.id;
      const { id } = req.params;

      const existing = await prisma.bankQuestion.findFirst({
        where: { id, teacherId },
      });

      if (!existing) {
        return res.status(404).json({
          error: 'Question not found.',
          code: 'NOT_FOUND',
        });
      }

      const duplicated = await prisma.bankQuestion.create({
        data: {
          teacherId,
          questionText: `${existing.questionText} (Copy)`,
          marks: existing.marks,
          questionType: existing.questionType,
          difficulty: existing.difficulty,
          classId: existing.classId,
          subjectId: existing.subjectId,
          chapter: existing.chapter,
          topic: existing.topic,
          visualAssetUrl: existing.visualAssetUrl,
          cropCoordinates: existing.cropCoordinates,
          sourceResourceId: existing.sourceResourceId,
          sourcePageNumber: existing.sourcePageNumber,
          sourceQuestionNumber: existing.sourceQuestionNumber,
          isArchived: false,
        },
      });

      await prisma.auditLog.create({
        data: {
          teacherId,
          action: 'QUESTION_CREATED',
          entityType: 'QUESTION',
          entityId: duplicated.id,
          details: `Duplicated from question ${existing.id}`,
        },
      });

      res.status(201).json({
        success: true,
        message: 'Question duplicated successfully.',
        question: duplicated,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/question-bank/:id/archive
 * Toggle archive status of a question.
 */
questionBankRouter.post(
  '/:id/archive',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const teacherId = req.teacher!.id;
      const { id } = req.params;

      const existing = await prisma.bankQuestion.findFirst({
        where: { id, teacherId },
      });

      if (!existing) {
        return res.status(404).json({
          error: 'Question not found.',
          code: 'NOT_FOUND',
        });
      }

      const nextArchived = !existing.isArchived;

      const updated = await prisma.bankQuestion.update({
        where: { id },
        data: { isArchived: nextArchived },
      });

      await prisma.auditLog.create({
        data: {
          teacherId,
          action: nextArchived ? 'QUESTION_ARCHIVED' : 'QUESTION_RESTORED',
          entityType: 'QUESTION',
          entityId: updated.id,
          details: `Question ${nextArchived ? 'archived' : 'restored from archive'}`,
        },
      });

      res.json({
        success: true,
        message: nextArchived ? 'Question archived.' : 'Question restored to active list.',
        question: updated,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * DELETE /api/question-bank/:id
 * Delete or soft-archive a question with safety checks.
 */
questionBankRouter.delete(
  '/:id',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const teacherId = req.teacher!.id;
      const { id } = req.params;
      const force = req.query.force === 'true';

      const existing = await prisma.bankQuestion.findFirst({
        where: { id, teacherId },
      });

      if (!existing) {
        return res.status(404).json({
          error: 'Question not found.',
          code: 'NOT_FOUND',
        });
      }

      // Check if this text or source is referenced in papers
      const referencingPapers = await prisma.paperQuestion.findMany({
        where: {
          questionText: existing.questionText,
          paper: { teacherId },
        },
        select: {
          paperId: true,
          paper: { select: { examinationName: true } },
        },
        take: 5,
      });

      if (referencingPapers.length > 0 && !force) {
        return res.status(409).json({
          warning: `This question text appears in ${referencingPapers.length} examination paper(s) (e.g., "${referencingPapers[0].paper.examinationName}"). Archiving is recommended instead of deleting.`,
          code: 'QUESTION_IN_USE',
          referencingCount: referencingPapers.length,
          canArchive: true,
        });
      }

      await prisma.bankQuestion.delete({
        where: { id },
      });

      await prisma.auditLog.create({
        data: {
          teacherId,
          action: 'QUESTION_DELETED',
          entityType: 'QUESTION',
          entityId: id,
          details: `Permanently deleted question: ${existing.questionText.slice(0, 60)}`,
        },
      });

      res.json({
        success: true,
        message: 'Question deleted from Question Bank.',
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/question-bank/import-from-paper/:paperId
 * Batch import all questions from an existing examination paper into the Question Bank.
 */
questionBankRouter.post(
  '/import-from-paper/:paperId',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const teacherId = req.teacher!.id;
      const { paperId } = req.params;

      const paper = await prisma.paper.findFirst({
        where: { id: paperId, teacherId },
        include: {
          questions: true,
        },
      });

      if (!paper) {
        return res.status(404).json({
          error: 'Examination paper not found.',
          code: 'NOT_FOUND',
        });
      }

      let importedCount = 0;

      for (const q of paper.questions) {
        if (!q.questionText || !q.questionText.trim()) continue;

        // Check if question already exists in bank
        const exists = await prisma.bankQuestion.findFirst({
          where: {
            teacherId,
            questionText: q.questionText.trim(),
            subjectId: paper.subjectId,
          },
        });

        if (!exists) {
          await prisma.bankQuestion.create({
            data: {
              teacherId,
              classId: paper.classId,
              subjectId: paper.subjectId,
              questionText: q.questionText.trim(),
              marks: q.marks || 1,
              questionType: 'SUBJECTIVE',
              difficulty: 'MEDIUM',
              chapter: q.sourceChapter || null,
              visualAssetUrl: q.visualAssetUrl || null,
              cropCoordinates: q.cropCoordinates || null,
              sourceResourceId: q.sourceResourceId || null,
              sourcePageNumber: q.sourcePageNumber || null,
              sourceQuestionNumber: q.sourceQuestionNumber || null,
              isArchived: false,
            },
          });
          importedCount++;
        }
      }

      await prisma.auditLog.create({
        data: {
          teacherId,
          action: 'QUESTION_CREATED',
          entityType: 'QUESTION',
          entityId: paper.id,
          details: `Imported ${importedCount} questions from paper "${paper.examinationName}" into Question Bank`,
        },
      });

      res.json({
        success: true,
        message: `Successfully imported ${importedCount} question(s) from "${paper.examinationName}" into Question Bank.`,
        importedCount,
      });
    } catch (err) {
      next(err);
    }
  }
);
