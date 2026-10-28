import { Router, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import prisma from '../db';
import { requireTeacherAuth, AuthenticatedRequest } from '../middleware';
import {
  assertTeacherOwnsClass,
  assertTeacherOwnsSubject,
  assertTeacherOwnsResource,
  assertTeacherOwnsPaper,
  AuthorizationError,
} from '../authorization';

export const papersRouter = Router();

// Require teacher authentication for all paper routes
papersRouter.use(requireTeacherAuth);

/**
 * GET /api/papers
 * List all papers created by the authenticated teacher.
 * Supports filtering by classId or subjectId.
 */
papersRouter.get(
  '/',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const teacherId = req.teacher!.id;
      const { classId, subjectId, search, status, isArchived, academicYear } = req.query;

      const whereClause: any = { teacherId };

      if (isArchived === 'true') {
        whereClause.isArchived = true;
      } else if (isArchived === 'false' || isArchived === undefined) {
        whereClause.isArchived = false;
      }

      if (classId && typeof classId === 'string' && classId !== 'ALL') {
        await assertTeacherOwnsClass(teacherId, classId);
        whereClause.classId = classId;
      }

      if (subjectId && typeof subjectId === 'string' && subjectId !== 'ALL') {
        await assertTeacherOwnsSubject(teacherId, subjectId);
        whereClause.subjectId = subjectId;
      }

      if (status && typeof status === 'string' && status !== 'ALL') {
        whereClause.status = status;
      }

      if (academicYear && typeof academicYear === 'string' && academicYear !== 'ALL') {
        whereClause.academicYear = academicYear;
      }

      if (search && typeof search === 'string' && search.trim()) {
        const query = search.trim();
        whereClause.OR = [
          { examinationName: { contains: query } },
          { schoolName: { contains: query } },
          { class: { name: { contains: query } } },
          { subject: { name: { contains: query } } },
        ];
      }

      const papers = await prisma.paper.findMany({
        where: whereClause,
        orderBy: { updatedAt: 'desc' },
        include: {
          class: {
            select: { id: true, name: true, grade: true, section: true },
          },
          subject: {
            select: { id: true, name: true, code: true },
          },
          _count: {
            select: {
              sections: true,
              questions: true,
            },
          },
          questions: {
            select: { marks: true, choiceGroupId: true },
          },
        },
      });

      // Calculate total allocated marks on each paper
      const formattedPapers = papers.map((p) => {
        // Only count one question per choice group if marks are shared, or sum distinct marks
        const seenChoiceGroups = new Set<string>();
        let actualMarks = 0;

        for (const q of p.questions) {
          if (q.choiceGroupId) {
            if (!seenChoiceGroups.has(q.choiceGroupId)) {
              seenChoiceGroups.add(q.choiceGroupId);
              actualMarks += q.marks;
            }
          } else {
            actualMarks += q.marks;
          }
        }

        return {
          id: p.id,
          examinationName: p.examinationName,
          schoolName: p.schoolName,
          academicYear: p.academicYear || '2025-2026',
          date: p.date,
          duration: p.duration,
          totalMarks: p.totalMarks,
          actualMarks,
          creationMode: p.creationMode,
          status: p.status,
          isArchived: Boolean(p.isArchived),
          pdfGeneratedAt: (p as any).pdfGeneratedAt,
          pdfVersion: (p as any).pdfVersion || 0,
          class: p.class,
          subject: p.subject,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
          sectionsCount: p._count.sections,
          questionsCount: p._count.questions,
        };
      });

      res.json({ papers: formattedPapers });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/papers
 * Create a new examination paper under the authenticated teacher.
 */
papersRouter.post(
  '/',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const teacherId = req.teacher!.id;
      const {
        classId,
        subjectId,
        examinationName,
        schoolName,
        date,
        duration,
        totalMarks,
        initialSectionName = 'Part A',
        parts,
      } = req.body;

      if (!classId || typeof classId !== 'string') {
        return res.status(400).json({
          error: 'Class ID is required',
          code: 'INVALID_INPUT',
        });
      }

      if (!subjectId || typeof subjectId !== 'string') {
        return res.status(400).json({
          error: 'Subject ID is required',
          code: 'INVALID_INPUT',
        });
      }

      if (!examinationName || typeof examinationName !== 'string' || !examinationName.trim()) {
        return res.status(400).json({
          error: 'Examination name is required',
          code: 'INVALID_INPUT',
        });
      }

      const parsedTotal = parseInt(totalMarks, 10);
      if (isNaN(parsedTotal) || parsedTotal <= 0) {
        return res.status(400).json({
          error: 'Total marks must be a positive number',
          code: 'INVALID_INPUT',
        });
      }

      // Verify class & subject ownership
      await assertTeacherOwnsClass(teacherId, classId);
      const subject = await assertTeacherOwnsSubject(teacherId, subjectId);

      if (subject.classId !== classId) {
        return res.status(400).json({
          error: 'Selected subject does not belong to the selected class',
          code: 'INVALID_CLASS_SUBJECT_RELATION',
        });
      }

      const paperId = randomUUID();

      // Configure predefined parts structure
      const sectionsToCreate =
        Array.isArray(parts) && parts.length > 0
          ? parts.map((p: any, idx: number) => {
              const qToAnswer = Number(p.questionsToAnswer) || Number(p.targetQuestions) || 0;
              const qProvided = Number(p.questionsProvided) || qToAnswer || 0;
              return {
                name: p.name?.trim() || `Part ${String.fromCharCode(65 + idx)}`,
                instructions: p.instructions ? String(p.instructions).trim() : null,
                position: idx,
                targetQuestions: qProvided,
                questionsProvided: qProvided,
                questionsToAnswer: qToAnswer,
                compulsoryQuestions: p.compulsoryQuestions ? String(p.compulsoryQuestions).trim() : null,
                marksPerQuestion: Number(p.marksPerQuestion) || 1,
                hasInternalChoice: Boolean(p.hasInternalChoice),
                choiceCount: Number(p.choiceCount) || 0,
              };
            })
          : [
              {
                name: initialSectionName.trim() || 'Part A',
                instructions: null,
                position: 0,
                targetQuestions: 0,
                questionsProvided: 0,
                questionsToAnswer: 0,
                compulsoryQuestions: null,
                marksPerQuestion: 1,
                hasInternalChoice: false,
                choiceCount: 0,
              },
            ];

      // Create paper with predefined parts
      const paper = await prisma.paper.create({
        data: {
          id: paperId,
          teacherId,
          classId,
          subjectId,
          examinationName: examinationName.trim(),
          schoolName: schoolName ? String(schoolName).trim() : null,
          date: date ? String(date).trim() : null,
          duration: duration ? String(duration).trim() : '3 Hours',
          totalMarks: parsedTotal,
          creationMode: 'MANUAL',
          status: 'DRAFT',
          sections: {
            create: sectionsToCreate,
          },
        },
        include: {
          class: true,
          subject: true,
          sections: {
            orderBy: { position: 'asc' },
            include: {
              questions: true,
              choiceGroups: true,
            },
          },
        },
      });

      res.status(201).json({
        message: 'Examination paper created successfully',
        paper,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/papers/:id
 * Retrieve a full examination paper draft with sections, choice groups, and questions.
 */
papersRouter.get(
  '/:id',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const teacherId = req.teacher!.id;
      const paper = await assertTeacherOwnsPaper(teacherId, req.params.id);

      res.json({ paper });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PATCH /api/papers/:id
 * Update paper metadata (exam name, date, duration, totalMarks, status).
 */
papersRouter.patch(
  '/:id',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const teacherId = req.teacher!.id;
      await assertTeacherOwnsPaper(teacherId, req.params.id);

      const { examinationName, schoolName, date, duration, totalMarks, status } = req.body;

      const updateData: any = {};
      if (examinationName !== undefined) {
        if (typeof examinationName !== 'string' || !examinationName.trim()) {
          return res.status(400).json({ error: 'Examination name cannot be empty', code: 'INVALID_INPUT' });
        }
        updateData.examinationName = examinationName.trim();
      }
      if (schoolName !== undefined) updateData.schoolName = schoolName ? String(schoolName).trim() : null;
      if (date !== undefined) updateData.date = date ? String(date).trim() : null;
      if (duration !== undefined) updateData.duration = duration ? String(duration).trim() : null;
      if (totalMarks !== undefined) {
        const tm = parseInt(totalMarks, 10);
        if (isNaN(tm) || tm <= 0) {
          return res.status(400).json({ error: 'Total marks must be a positive integer', code: 'INVALID_INPUT' });
        }
        updateData.totalMarks = tm;
      }
      if (status !== undefined) {
        if (!['DRAFT', 'READY', 'PUBLISHED'].includes(status)) {
          return res.status(400).json({ error: 'Invalid paper status', code: 'INVALID_INPUT' });
        }
        updateData.status = status;
      }

      const updated = await prisma.paper.update({
        where: { id: req.params.id },
        data: updateData,
        include: {
          class: true,
          subject: true,
          sections: {
            orderBy: { position: 'asc' },
            include: {
              choiceGroups: true,
              questions: true,
            },
          },
        },
      });

      res.json({ message: 'Paper metadata updated', paper: updated });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * DELETE /api/papers/:id
 * Delete an entire examination paper safely across all relations.
 */
papersRouter.delete(
  '/:id',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const teacherId = req.teacher!.id;
      await assertTeacherOwnsPaper(teacherId, req.params.id);

      // Perform deletion in transactional sequence to guarantee database integrity
      await prisma.$transaction(async (tx) => {
        await tx.paperQuestion.deleteMany({ where: { paperId: req.params.id } });
        await tx.choiceGroup.deleteMany({ where: { paperId: req.params.id } });
        await tx.paperSection.deleteMany({ where: { paperId: req.params.id } });
        await tx.paper.delete({ where: { id: req.params.id } });
      });

      res.json({ message: 'Paper deleted successfully', deletedId: req.params.id });
    } catch (err) {
      next(err);
    }
  }
);

/* =========================================================================
   SECTIONS & STRUCTURE ENDPOINTS
   ========================================================================= */

/**
 * PUT /api/papers/:id/structure
 * Update or synchronize the entire Paper Parts structure.
 */
papersRouter.put(
  '/:id/structure',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const teacherId = req.teacher!.id;
      const paper = await assertTeacherOwnsPaper(teacherId, req.params.id);

      const { parts, totalMarks } = req.body;
      if (!Array.isArray(parts) || parts.length === 0) {
        return res.status(400).json({
          error: 'At least one Part must be defined in the structure',
          code: 'INVALID_INPUT',
        });
      }

      await prisma.$transaction(async (tx) => {
        // 1. Process each part: update existing or create new
        for (let i = 0; i < parts.length; i++) {
          const p = parts[i];
          const qToAnswer = Number(p.questionsToAnswer) || Number(p.targetQuestions) || 0;
          const qProvided = Number(p.questionsProvided) || qToAnswer || 0;
          const partData = {
            name: p.name?.trim() || `Part ${String.fromCharCode(65 + i)}`,
            instructions: p.instructions ? String(p.instructions).trim() : null,
            position: i,
            targetQuestions: qProvided,
            questionsProvided: qProvided,
            questionsToAnswer: qToAnswer,
            compulsoryQuestions: p.compulsoryQuestions ? String(p.compulsoryQuestions).trim() : null,
            marksPerQuestion: Number(p.marksPerQuestion) || 1,
            hasInternalChoice: Boolean(p.hasInternalChoice),
            choiceCount: Number(p.choiceCount) || 0,
          };

          if (p.id && paper.sections.some((s) => s.id === p.id)) {
            await tx.paperSection.update({
              where: { id: p.id },
              data: partData,
            });
          } else {
            await tx.paperSection.create({
              data: {
                ...partData,
                paperId: paper.id,
              },
            });
          }
        }

        // 2. Optionally update paper totalMarks if provided
        if (totalMarks !== undefined) {
          const tm = parseInt(totalMarks, 10);
          if (!isNaN(tm) && tm > 0) {
            await tx.paper.update({
              where: { id: paper.id },
              data: { totalMarks: tm },
            });
          }
        }
      });

      // Reload fresh paper with updated sections
      const updatedPaper = await prisma.paper.findUnique({
        where: { id: req.params.id },
        include: {
          class: true,
          subject: true,
          sections: {
            orderBy: { position: 'asc' },
            include: {
              questions: {
                orderBy: { position: 'asc' },
                include: {
                  sourceResource: {
                    select: { id: true, name: true, fileType: true },
                  },
                },
              },
              choiceGroups: {
                include: { questions: true },
              },
            },
          },
        },
      });

      res.json({ message: 'Paper structure updated successfully', paper: updatedPaper });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/papers/:id/sections
 * Add a new part/section to an existing paper.
 */
papersRouter.post(
  '/:id/sections',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const teacherId = req.teacher!.id;
      const paper = await assertTeacherOwnsPaper(teacherId, req.params.id);

      const {
        name,
        instructions,
        targetQuestions = 0,
        questionsProvided,
        questionsToAnswer,
        compulsoryQuestions,
        marksPerQuestion = 1,
        hasInternalChoice = false,
        choiceCount = 0,
      } = req.body;

      if (!name || typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ error: 'Part name is required', code: 'INVALID_INPUT' });
      }

      const nextPosition = paper.sections.length;
      const qToAnswer = Number(questionsToAnswer) || Number(targetQuestions) || 0;
      const qProvided = Number(questionsProvided) || qToAnswer || 0;

      const section = await prisma.paperSection.create({
        data: {
          paperId: paper.id,
          name: name.trim(),
          instructions: instructions ? String(instructions).trim() : null,
          position: nextPosition,
          targetQuestions: qProvided,
          questionsProvided: qProvided,
          questionsToAnswer: qToAnswer,
          compulsoryQuestions: compulsoryQuestions ? String(compulsoryQuestions).trim() : null,
          marksPerQuestion: Number(marksPerQuestion) || 1,
          hasInternalChoice: Boolean(hasInternalChoice),
          choiceCount: Number(choiceCount) || 0,
        },
        include: {
          questions: true,
          choiceGroups: true,
        },
      });

      res.status(201).json({ message: 'Part added successfully', section });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PATCH /api/papers/:id/sections/:sectionId
 * Rename, update instructions, reorder, or update structure of a part.
 */
papersRouter.patch(
  '/:id/sections/:sectionId',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const teacherId = req.teacher!.id;
      await assertTeacherOwnsPaper(teacherId, req.params.id);

      const { sectionId } = req.params;
      const {
        name,
        instructions,
        position,
        targetQuestions,
        questionsProvided,
        questionsToAnswer,
        compulsoryQuestions,
        marksPerQuestion,
        hasInternalChoice,
        choiceCount,
      } = req.body;

      const updateData: any = {};
      if (name !== undefined) {
        if (typeof name !== 'string' || !name.trim()) {
          return res.status(400).json({ error: 'Part name cannot be empty', code: 'INVALID_INPUT' });
        }
        updateData.name = name.trim();
      }
      if (instructions !== undefined) {
        updateData.instructions = instructions ? String(instructions).trim() : null;
      }
      if (position !== undefined && typeof position === 'number') {
        updateData.position = position;
      }
      if (targetQuestions !== undefined || questionsProvided !== undefined || questionsToAnswer !== undefined) {
        const qToAnswer = Number(questionsToAnswer) || Number(targetQuestions) || 0;
        const qProvided = Number(questionsProvided) || qToAnswer || 0;
        updateData.targetQuestions = qProvided;
        updateData.questionsProvided = qProvided;
        updateData.questionsToAnswer = qToAnswer;
      }
      if (compulsoryQuestions !== undefined) {
        updateData.compulsoryQuestions = compulsoryQuestions ? String(compulsoryQuestions).trim() : null;
      }
      if (marksPerQuestion !== undefined) {
        updateData.marksPerQuestion = Number(marksPerQuestion) || 1;
      }
      if (hasInternalChoice !== undefined) {
        updateData.hasInternalChoice = Boolean(hasInternalChoice);
      }
      if (choiceCount !== undefined) {
        updateData.choiceCount = Number(choiceCount) || 0;
      }

      const updated = await prisma.paperSection.update({
        where: { id: sectionId },
        data: updateData,
        include: {
          questions: true,
          choiceGroups: true,
        },
      });

      res.json({ message: 'Part updated successfully', section: updated });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * DELETE /api/papers/:id/sections/:sectionId
 * Delete a section from the paper.
 */
papersRouter.delete(
  '/:id/sections/:sectionId',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const teacherId = req.teacher!.id;
      const paper = await assertTeacherOwnsPaper(teacherId, req.params.id);

      const { sectionId } = req.params;
      const section = paper.sections.find((s) => s.id === sectionId);
      if (!section) {
        return res.status(404).json({ error: 'Section not found', code: 'SECTION_NOT_FOUND' });
      }

      // Check if this is the only section in the paper
      if (paper.sections.length <= 1) {
        return res.status(400).json({
          error: 'An examination paper must retain at least one section.',
          code: 'CANNOT_DELETE_LAST_SECTION',
        });
      }

      await prisma.paperSection.delete({
        where: { id: sectionId },
      });

      // Re-normalize remaining section positions
      const remaining = paper.sections
        .filter((s) => s.id !== sectionId)
        .sort((a, b) => a.position - b.position);

      for (let i = 0; i < remaining.length; i++) {
        if (remaining[i].position !== i) {
          await prisma.paperSection.update({
            where: { id: remaining[i].id },
            data: { position: i },
          });
        }
      }

      res.json({ message: 'Section deleted successfully', deletedId: sectionId });
    } catch (err) {
      next(err);
    }
  }
);

/* =========================================================================
   QUESTIONS ENDPOINTS
   ========================================================================= */

/**
 * POST /api/papers/:id/questions
 * Add a question to a section.
 * Supports adding manual questions or selecting from a Phase 2 Resource.
 * Never modifies the original resource.
 */
papersRouter.post(
  '/:id/questions',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const teacherId = req.teacher!.id;
      const paper = await assertTeacherOwnsPaper(teacherId, req.params.id);

      const {
        sectionId,
        questionText,
        marks = 1,
        isCompulsory = false,
        choiceGroupId,
        choiceOption,
        originalSourceText,
        sourceResourceId,
        sourcePageNumber,
        sourceQuestionNumber,
        sourceChapter,
        visualAssetUrl,
        cropCoordinates,
      } = req.body;

      if (!sectionId || typeof sectionId !== 'string') {
        return res.status(400).json({ error: 'Target section ID is required', code: 'INVALID_INPUT' });
      }

      // Ensure section belongs to this paper
      const section = paper.sections.find((s) => s.id === sectionId);
      if (!section) {
        return res.status(404).json({ error: 'Specified section was not found on this paper', code: 'SECTION_NOT_FOUND' });
      }

      // If visualAssetUrl is provided, questionText can default to "[Visual Question]" if not supplied or empty
      const textToSave = (questionText && typeof questionText === 'string' && questionText.trim())
        ? questionText.trim()
        : (visualAssetUrl ? '[Visual Question]' : '');

      if (!textToSave) {
        return res.status(400).json({ error: 'Question text or visual selection is required', code: 'INVALID_INPUT' });
      }

      const parsedMarks = parseInt(marks, 10);
      if (isNaN(parsedMarks) || parsedMarks < 0) {
        return res.status(400).json({ error: 'Marks must be a non-negative integer', code: 'INVALID_INPUT' });
      }

      // If sourceResourceId is specified, verify that the teacher owns the resource
      if (sourceResourceId) {
        await assertTeacherOwnsResource(teacherId, sourceResourceId);
      }

      // Position is next in the section
      const countInSec = await prisma.paperQuestion.count({
        where: { paperId: paper.id, sectionId },
      });

      const question = await prisma.paperQuestion.create({
        data: {
          paperId: paper.id,
          sectionId,
          choiceGroupId: choiceGroupId || null,
          choiceOption: choiceOption || null,
          position: countInSec,
          questionText: textToSave,
          originalSourceText: originalSourceText ? String(originalSourceText).trim() : null,
          marks: parsedMarks,
          isCompulsory: Boolean(isCompulsory),
          sourceResourceId: sourceResourceId || null,
          sourcePageNumber: sourcePageNumber ? parseInt(sourcePageNumber, 10) : null,
          sourceQuestionNumber: sourceQuestionNumber ? String(sourceQuestionNumber).trim() : null,
          sourceChapter: sourceChapter ? String(sourceChapter).trim() : null,
          visualAssetUrl: visualAssetUrl ? String(visualAssetUrl) : null,
          cropCoordinates: cropCoordinates ? (typeof cropCoordinates === 'string' ? cropCoordinates : JSON.stringify(cropCoordinates)) : null,
        },
        include: {
          sourceResource: {
            select: { id: true, name: true, fileType: true },
          },
        },
      });

      res.status(201).json({ message: 'Question added successfully', question });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PATCH /api/papers/:id/questions/:questionId
 * Edit question text, marks, reorder, or move to another section.
 * Preserves originalSourceText intact.
 */
papersRouter.patch(
  '/:id/questions/:questionId',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const teacherId = req.teacher!.id;
      const paper = await assertTeacherOwnsPaper(teacherId, req.params.id);

      const { questionId } = req.params;
      const question = paper.questions.find((q) => q.id === questionId);
      if (!question) {
        return res.status(404).json({ error: 'Question not found on this paper', code: 'QUESTION_NOT_FOUND' });
      }

      const {
        questionText,
        marks,
        isCompulsory,
        sectionId,
        position,
        choiceGroupId,
        choiceOption,
      } = req.body;

      const updateData: any = {};

      if (isCompulsory !== undefined) {
        updateData.isCompulsory = Boolean(isCompulsory);
      }

      if (questionText !== undefined) {
        if (typeof questionText !== 'string' || !questionText.trim()) {
          return res.status(400).json({ error: 'Question text cannot be empty', code: 'INVALID_INPUT' });
        }
        updateData.questionText = questionText.trim();
      }

      if (marks !== undefined) {
        const m = parseInt(marks, 10);
        if (isNaN(m) || m < 0) {
          return res.status(400).json({ error: 'Marks must be a non-negative integer', code: 'INVALID_INPUT' });
        }
        updateData.marks = m;
      }

      if (sectionId !== undefined && sectionId !== question.sectionId) {
        // Validate target section belongs to this paper
        const targetSection = paper.sections.find((s) => s.id === sectionId);
        if (!targetSection) {
          return res.status(404).json({ error: 'Target section not found on this paper', code: 'SECTION_NOT_FOUND' });
        }
        updateData.sectionId = sectionId;
        // Place at end of target section
        const targetCount = await prisma.paperQuestion.count({
          where: { paperId: paper.id, sectionId },
        });
        updateData.position = targetCount;
      } else if (position !== undefined && typeof position === 'number') {
        updateData.position = position;
      }

      if (choiceGroupId !== undefined) {
        updateData.choiceGroupId = choiceGroupId || null;
      }

      if (choiceOption !== undefined) {
        updateData.choiceOption = choiceOption || null;
      }

      if (req.body.visualAssetUrl !== undefined) {
        updateData.visualAssetUrl = req.body.visualAssetUrl ? String(req.body.visualAssetUrl) : null;
      }

      if (req.body.cropCoordinates !== undefined) {
        updateData.cropCoordinates = req.body.cropCoordinates
          ? (typeof req.body.cropCoordinates === 'string' ? req.body.cropCoordinates : JSON.stringify(req.body.cropCoordinates))
          : null;
      }

      const updated = await prisma.paperQuestion.update({
        where: { id: questionId },
        data: updateData,
        include: {
          sourceResource: {
            select: { id: true, name: true, fileType: true },
          },
        },
      });

      res.json({ message: 'Question updated successfully', question: updated });
    } catch (err) {
      next(err);
    }
  }
);

// Alias PUT /api/papers/:id/questions/:questionId
papersRouter.put(
  '/:id/questions/:questionId',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const teacherId = req.teacher!.id;
      const paper = await assertTeacherOwnsPaper(teacherId, req.params.id);

      const { questionId } = req.params;
      const question = paper.questions.find((q) => q.id === questionId);
      if (!question) {
        return res.status(404).json({ error: 'Question not found on this paper', code: 'QUESTION_NOT_FOUND' });
      }

      const {
        questionText,
        marks,
        sectionId,
        position,
        choiceGroupId,
        choiceOption,
        visualAssetUrl,
        cropCoordinates,
      } = req.body;

      const updateData: any = {};

      if (questionText !== undefined) {
        updateData.questionText = questionText.trim();
      }

      if (marks !== undefined) {
        const m = parseInt(marks, 10);
        if (!isNaN(m) && m >= 0) {
          updateData.marks = m;
        }
      }

      if (sectionId !== undefined && sectionId !== question.sectionId) {
        const targetSection = paper.sections.find((s) => s.id === sectionId);
        if (targetSection) {
          updateData.sectionId = sectionId;
          const targetCount = await prisma.paperQuestion.count({
            where: { paperId: paper.id, sectionId },
          });
          updateData.position = targetCount;
        }
      } else if (position !== undefined && typeof position === 'number') {
        updateData.position = position;
      }

      if (choiceGroupId !== undefined) {
        updateData.choiceGroupId = choiceGroupId || null;
      }

      if (choiceOption !== undefined) {
        updateData.choiceOption = choiceOption || null;
      }

      if (visualAssetUrl !== undefined) {
        updateData.visualAssetUrl = visualAssetUrl ? String(visualAssetUrl) : null;
      }

      if (cropCoordinates !== undefined) {
        updateData.cropCoordinates = cropCoordinates
          ? (typeof cropCoordinates === 'string' ? cropCoordinates : JSON.stringify(cropCoordinates))
          : null;
      }

      const updated = await prisma.paperQuestion.update({
        where: { id: questionId },
        data: updateData,
        include: {
          sourceResource: {
            select: { id: true, name: true, fileType: true },
          },
        },
      });

      res.json({ message: 'Question updated successfully', question: updated });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PUT /api/papers/:id/questions/:questionId/reorder
 * Move a single question up or down within its section
 */
papersRouter.put(
  '/:id/questions/:questionId/reorder',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const teacherId = req.teacher!.id;
      const paper = await assertTeacherOwnsPaper(teacherId, req.params.id);

      const { questionId } = req.params;
      const { direction } = req.body; // 'UP' or 'DOWN'

      const currentQ = paper.questions.find((q) => q.id === questionId);
      if (!currentQ) {
        return res.status(404).json({ error: 'Question not found on this paper', code: 'QUESTION_NOT_FOUND' });
      }

      const sectionQuestions = await prisma.paperQuestion.findMany({
        where: { paperId: paper.id, sectionId: currentQ.sectionId },
        orderBy: { position: 'asc' },
      });

      const currentIndex = sectionQuestions.findIndex((q) => q.id === questionId);
      if (currentIndex === -1) {
        return res.status(404).json({ error: 'Question not found in section' });
      }

      const targetIndex = direction === 'UP' ? currentIndex - 1 : currentIndex + 1;
      if (targetIndex >= 0 && targetIndex < sectionQuestions.length) {
        // Swap positions
        const targetQ = sectionQuestions[targetIndex];
        await prisma.$transaction([
          prisma.paperQuestion.update({
            where: { id: currentQ.id },
            data: { position: targetQ.position },
          }),
          prisma.paperQuestion.update({
            where: { id: targetQ.id },
            data: { position: currentQ.position },
          }),
        ]);
      }

      res.json({ message: 'Question position updated' });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * DELETE /api/papers/:id/questions/:questionId
 * Delete a question from the paper.
 */
papersRouter.delete(
  '/:id/questions/:questionId',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const teacherId = req.teacher!.id;
      const paper = await assertTeacherOwnsPaper(teacherId, req.params.id);

      const { questionId } = req.params;
      const question = paper.questions.find((q) => q.id === questionId);
      if (!question) {
        return res.status(404).json({ error: 'Question not found on this paper', code: 'QUESTION_NOT_FOUND' });
      }

      await prisma.paperQuestion.delete({
        where: { id: questionId },
      });

      // Re-order remaining questions in the same section
      const remaining = await prisma.paperQuestion.findMany({
        where: { paperId: paper.id, sectionId: question.sectionId },
        orderBy: { position: 'asc' },
      });

      for (let i = 0; i < remaining.length; i++) {
        if (remaining[i].position !== i) {
          await prisma.paperQuestion.update({
            where: { id: remaining[i].id },
            data: { position: i },
          });
        }
      }

      res.json({ message: 'Question removed from paper', deletedId: questionId });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/papers/:id/reorder-questions
 * Reorder questions within a section.
 */
papersRouter.post(
  '/:id/reorder-questions',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const teacherId = req.teacher!.id;
      const paper = await assertTeacherOwnsPaper(teacherId, req.params.id);

      const { sectionId, questionIds } = req.body;
      if (!sectionId || !Array.isArray(questionIds)) {
        return res.status(400).json({ error: 'sectionId and questionIds array are required', code: 'INVALID_INPUT' });
      }

      for (let i = 0; i < questionIds.length; i++) {
        await prisma.paperQuestion.updateMany({
          where: {
            id: questionIds[i],
            paperId: paper.id,
            sectionId,
          },
          data: { position: i },
        });
      }

      res.json({ message: 'Questions reordered successfully' });
    } catch (err) {
      next(err);
    }
  }
);

/* =========================================================================
   INTERNAL CHOICES (ChoiceGroup) ENDPOINTS
   ========================================================================= */

/**
 * POST /api/papers/:id/choice-groups
 * Create an internal choice group with two alternatives (A and B).
 */
papersRouter.post(
  '/:id/choice-groups',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const teacherId = req.teacher!.id;
      const paper = await assertTeacherOwnsPaper(teacherId, req.params.id);

      const {
        sectionId,
        label = 'Answer either Option A OR Option B:',
        marks = 5,
        questionA,
        questionB,
      } = req.body;

      if (!sectionId) {
        return res.status(400).json({ error: 'sectionId is required', code: 'INVALID_INPUT' });
      }

      const section = paper.sections.find((s) => s.id === sectionId);
      if (!section) {
        return res.status(404).json({ error: 'Section not found', code: 'SECTION_NOT_FOUND' });
      }

      if (!questionA || !questionA.questionText?.trim()) {
        return res.status(400).json({ error: 'Option A question text is required', code: 'INVALID_INPUT' });
      }

      if (!questionB || !questionB.questionText?.trim()) {
        return res.status(400).json({ error: 'Option B question text is required', code: 'INVALID_INPUT' });
      }

      const parsedMarks = parseInt(marks, 10);
      if (isNaN(parsedMarks) || parsedMarks < 0) {
        return res.status(400).json({ error: 'Marks must be a non-negative integer', code: 'INVALID_INPUT' });
      }

      // Verify resources if attached
      if (questionA.sourceResourceId) {
        await assertTeacherOwnsResource(teacherId, questionA.sourceResourceId);
      }
      if (questionB.sourceResourceId) {
        await assertTeacherOwnsResource(teacherId, questionB.sourceResourceId);
      }

      const countInSec = await prisma.paperQuestion.count({
        where: { paperId: paper.id, sectionId },
      });

      const choiceGroupId = randomUUID();

      // Create Choice Group
      const choiceGroup = await prisma.choiceGroup.create({
        data: {
          id: choiceGroupId,
          paperId: paper.id,
          sectionId,
          position: countInSec,
          label: label.trim(),
          marks: parsedMarks,
        },
      });

      // Create Question A
      const createdA = await prisma.paperQuestion.create({
        data: {
          paperId: paper.id,
          sectionId,
          choiceGroupId,
          choiceOption: 'A',
          position: countInSec,
          questionText: questionA.questionText.trim(),
          originalSourceText: questionA.originalSourceText ? String(questionA.originalSourceText).trim() : null,
          marks: parsedMarks,
          sourceResourceId: questionA.sourceResourceId || null,
          sourcePageNumber: questionA.sourcePageNumber ? parseInt(questionA.sourcePageNumber, 10) : null,
        },
      });

      // Create Question B
      const createdB = await prisma.paperQuestion.create({
        data: {
          paperId: paper.id,
          sectionId,
          choiceGroupId,
          choiceOption: 'B',
          position: countInSec + 1,
          questionText: questionB.questionText.trim(),
          originalSourceText: questionB.originalSourceText ? String(questionB.originalSourceText).trim() : null,
          marks: parsedMarks,
          sourceResourceId: questionB.sourceResourceId || null,
          sourcePageNumber: questionB.sourcePageNumber ? parseInt(questionB.sourcePageNumber, 10) : null,
        },
      });

      res.status(201).json({
        message: 'Choice group created successfully',
        choiceGroup,
        questions: [createdA, createdB],
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * DELETE /api/papers/:id/choice-groups/:choiceGroupId
 * Remove a choice group and its associated questions.
 */
papersRouter.delete(
  '/:id/choice-groups/:choiceGroupId',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const teacherId = req.teacher!.id;
      const paper = await assertTeacherOwnsPaper(teacherId, req.params.id);

      const { choiceGroupId } = req.params;

      // Delete questions in choice group
      await prisma.paperQuestion.deleteMany({
        where: { paperId: paper.id, choiceGroupId },
      });

      // Delete choice group record
      await prisma.choiceGroup.delete({
        where: { id: choiceGroupId },
      });

      res.json({ message: 'Choice group removed successfully', deletedId: choiceGroupId });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/papers/:id/generate-pdf
 * Register/record the generation of the PDF for the paper.
 * Validates structure, increments pdfVersion, sets status to READY.
 */
papersRouter.post(
  '/:id/generate-pdf',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const teacherId = req.teacher!.id;
      const paper = await assertTeacherOwnsPaper(teacherId, req.params.id);

      const warnings: string[] = [];
      const sections = paper.sections || [];
      const questions = paper.questions || [];

      if (sections.length === 0) {
        return res.status(400).json({
          error: 'Paper has no Parts defined. Please configure paper structure first.',
          code: 'NO_PARTS',
        });
      }

      if (questions.length === 0) {
        return res.status(400).json({
          error: 'Paper has no questions selected. Please add questions to the paper before generating PDF.',
          code: 'NO_QUESTIONS',
        });
      }

      // Check for empty question contents & invalid marks
      for (const q of questions) {
        const hasText = q.questionText && q.questionText.trim().length > 0 && q.questionText !== '[Visual Question]';
        const hasVisual = Boolean(q.visualAssetUrl);
        if (!hasText && !hasVisual) {
          return res.status(400).json({
            error: 'One or more questions have empty content (missing both text and visual clipping).',
            code: 'EMPTY_QUESTION_CONTENT',
          });
        }
        if (!q.marks || q.marks <= 0) {
          return res.status(400).json({
            error: 'One or more questions have invalid marks (must be greater than 0).',
            code: 'INVALID_QUESTION_MARKS',
          });
        }
      }

      // Deep validate Sections, Choice Groups, and Compulsory Question ranges
      let runningQNumber = 1;
      let totalCalculatedMarks = 0;

      for (const section of sections) {
        const secQuestions = section.questions || [];
        const secChoiceGroups = section.choiceGroups || [];
        const provided = Number(section.questionsProvided || section.targetQuestions || secQuestions.length || 0);
        const toAnswer = Number(section.questionsToAnswer || section.targetQuestions || provided || 0);
        const marksPerQ = Number(section.marksPerQuestion) || 1;

        if (toAnswer > provided && provided > 0) {
          return res.status(400).json({
            error: `${section.name}: Questions to answer (${toAnswer}) cannot exceed questions provided (${provided}).`,
            code: 'INVALID_SECTION_CONFIG',
          });
        }

        // Validate choice groups in this section
        for (const group of secChoiceGroups) {
          const groupQs = secQuestions.filter((q) => q.choiceGroupId === group.id);
          if (groupQs.length === 0) {
            return res.status(400).json({
              error: `${section.name}: Internal choice group has no questions assigned.`,
              code: 'EMPTY_CHOICE_GROUP',
            });
          }
          if (groupQs.length === 1) {
            return res.status(400).json({
              error: `${section.name}: Incomplete internal choice pair. Option (b) is missing.`,
              code: 'INCOMPLETE_CHOICE_GROUP',
            });
          }
          if (groupQs.length > 2) {
            return res.status(400).json({
              error: `${section.name}: Internal choice group contains more than 2 questions.`,
              code: 'CHOICE_GROUP_OVERFLOW',
            });
          }
          if (groupQs.length === 2 && groupQs[0].marks !== groupQs[1].marks) {
            return res.status(400).json({
              error: `${section.name}: Internal choice options have mismatched marks (${groupQs[0].marks} vs ${groupQs[1].marks}).`,
              code: 'CHOICE_MARKS_MISMATCH',
            });
          }
        }

        // Count unique filled slots
        const uniqueChoiceIds = new Set<string>();
        let uniqueSlots = 0;
        for (const q of secQuestions) {
          if (q.choiceGroupId) {
            if (!uniqueChoiceIds.has(q.choiceGroupId)) {
              uniqueChoiceIds.add(q.choiceGroupId);
              uniqueSlots++;
            }
          } else {
            uniqueSlots++;
          }
        }

        const startQ = runningQNumber;
        const span = Math.max(provided, uniqueSlots, 1);
        const endQ = startQ + span - 1;

        // Validate compulsory questions
        if (section.compulsoryQuestions && section.compulsoryQuestions.trim()) {
          const compNumbers = section.compulsoryQuestions
            .split(',')
            .map((s) => parseInt(s.trim(), 10))
            .filter((n) => !isNaN(n));

          for (const num of compNumbers) {
            if (num < startQ || num > endQ) {
              return res.status(400).json({
                error: `${section.name}: Compulsory question #${num} is out of bounds (${section.name} only spans Q.${startQ} – Q.${endQ}).`,
                code: 'INVALID_COMPULSORY_REFERENCE',
              });
            }
          }
        }

        // Calculate marks contribution
        if (toAnswer > 0) {
          totalCalculatedMarks += toAnswer * marksPerQ;
        } else {
          const seenChoice = new Set<string>();
          for (const q of secQuestions) {
            if (q.choiceGroupId) {
              if (!seenChoice.has(q.choiceGroupId)) {
                seenChoice.add(q.choiceGroupId);
                totalCalculatedMarks += q.marks;
              }
            } else {
              totalCalculatedMarks += q.marks;
            }
          }
        }

        if (provided > secQuestions.length) {
          warnings.push(
            `${section.name}: Has ${secQuestions.length} questions out of ${provided} planned slots.`
          );
        }

        runningQNumber = endQ + 1;
      }

      if (totalCalculatedMarks !== paper.totalMarks) {
        return res.status(400).json({
          error: `Total Marks Mismatch: Configured examination maximum marks is ${paper.totalMarks}, but Parts configuration totals ${totalCalculatedMarks} marks. Please adjust your paper marks or Part structures before generating final PDF.`,
          code: 'MARKS_MISMATCH',
        });
      }

      const nextVersion = ((paper as any).pdfVersion || 0) + 1;

      const updated = await prisma.paper.update({
        where: { id: paper.id },
        data: {
          pdfGeneratedAt: new Date(),
          pdfVersion: nextVersion,
          status: 'READY',
        },
        include: {
          class: true,
          subject: true,
          sections: {
            orderBy: { position: 'asc' },
            include: {
              choiceGroups: { orderBy: { position: 'asc' } },
              questions: {
                orderBy: { position: 'asc' },
                include: {
                  sourceResource: { select: { id: true, name: true, fileType: true } },
                },
              },
            },
          },
        },
      });

      // Record PDF version history
      const totalQuestionsCount = paper.sections.reduce(
        (acc, sec) => acc + (sec.questions?.length || 0),
        0
      );
      await prisma.pdfHistory.create({
        data: {
          paperId: paper.id,
          version: nextVersion,
          status: 'READY',
          totalMarks: paper.totalMarks,
          questionCount: totalQuestionsCount,
          pageCount: Math.max(1, Math.ceil(totalQuestionsCount / 5)),
          notes: `Generated at ${new Date().toLocaleTimeString()} - Total Marks: ${paper.totalMarks}`,
        },
      });

      // Record audit log
      await prisma.auditLog.create({
        data: {
          teacherId,
          action: 'PDF_GENERATED',
          entityType: 'PAPER',
          entityId: paper.id,
          details: JSON.stringify({
            examinationName: paper.examinationName,
            pdfVersion: nextVersion,
            totalMarks: paper.totalMarks,
          }),
        },
      });

      res.json({
        success: true,
        message: `PDF Version ${nextVersion} successfully generated and registered.`,
        pdfVersion: nextVersion,
        pdfGeneratedAt: updated.pdfGeneratedAt,
        warnings,
        paper: updated,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/papers/:id/duplicate
 * Safe duplication of an existing paper and its nested sections, choice groups, and questions.
 */
papersRouter.post(
  '/:id/duplicate',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const teacherId = req.teacher!.id;
      const { id } = req.params;

      const sourcePaper = await assertTeacherOwnsPaper(teacherId, id);

      // Load deep structure of source paper
      const originalPaper = await prisma.paper.findUnique({
        where: { id: sourcePaper.id },
        include: {
          sections: {
            orderBy: { position: 'asc' },
            include: {
              choiceGroups: { orderBy: { position: 'asc' } },
              questions: { orderBy: { position: 'asc' } },
            },
          },
        },
      });

      if (!originalPaper) {
        return res.status(404).json({
          error: 'Original examination paper not found.',
          code: 'NOT_FOUND',
        });
      }

      const newPaperId = randomUUID();
      const duplicatedExamName = `${originalPaper.examinationName} (Copy)`;

      // Create duplicated paper
      const newPaper = await prisma.paper.create({
        data: {
          id: newPaperId,
          teacherId,
          classId: originalPaper.classId,
          subjectId: originalPaper.subjectId,
          schoolName: originalPaper.schoolName,
          examinationName: duplicatedExamName,
          academicYear: originalPaper.academicYear || '2025-2026',
          date: originalPaper.date,
          duration: originalPaper.duration,
          totalMarks: originalPaper.totalMarks,
          generalInstructions: originalPaper.generalInstructions,
          creationMode: originalPaper.creationMode,
          status: 'DRAFT',
          isArchived: false,
          pdfVersion: 0,
          pdfGeneratedAt: null,
        },
      });

      // Clone sections, choice groups, and questions mapping IDs safely
      for (const sec of originalPaper.sections) {
        const newSecId = randomUUID();
        await prisma.paperSection.create({
          data: {
            id: newSecId,
            paperId: newPaperId,
            name: sec.name,
            instructions: sec.instructions,
            position: sec.position,
            targetQuestions: sec.targetQuestions,
            questionsProvided: sec.questionsProvided,
            questionsToAnswer: sec.questionsToAnswer,
            compulsoryQuestions: sec.compulsoryQuestions,
            marksPerQuestion: sec.marksPerQuestion,
            hasInternalChoice: sec.hasInternalChoice,
            choiceCount: sec.choiceCount,
          },
        });

        // Map choice group IDs
        const choiceGroupMap = new Map<string, string>();
        for (const cg of sec.choiceGroups) {
          const newCgId = randomUUID();
          choiceGroupMap.set(cg.id, newCgId);
          await prisma.choiceGroup.create({
            data: {
              id: newCgId,
              paperId: newPaperId,
              sectionId: newSecId,
              position: cg.position,
              label: cg.label,
              marks: cg.marks,
            },
          });
        }

        // Duplicate questions
        for (const q of sec.questions) {
          const newQId = randomUUID();
          const mappedCgId = q.choiceGroupId ? choiceGroupMap.get(q.choiceGroupId) || null : null;

          await prisma.paperQuestion.create({
            data: {
              id: newQId,
              paperId: newPaperId,
              sectionId: newSecId,
              choiceGroupId: mappedCgId,
              choiceOption: q.choiceOption,
              position: q.position,
              questionText: q.questionText,
              originalSourceText: q.originalSourceText,
              marks: q.marks,
              isCompulsory: q.isCompulsory,
              sourceResourceId: q.sourceResourceId,
              sourcePageNumber: q.sourcePageNumber,
              sourceQuestionNumber: q.sourceQuestionNumber,
              sourceChapter: q.sourceChapter,
              visualAssetUrl: q.visualAssetUrl,
              cropCoordinates: q.cropCoordinates,
            },
          });
        }
      }

      await prisma.auditLog.create({
        data: {
          teacherId,
          action: 'PAPER_DUPLICATED',
          entityType: 'PAPER',
          entityId: newPaper.id,
          details: `Duplicated from "${originalPaper.examinationName}" -> "${duplicatedExamName}"`,
        },
      });

      const fullNewPaper = await prisma.paper.findUnique({
        where: { id: newPaperId },
        include: {
          class: true,
          subject: true,
          sections: {
            include: {
              choiceGroups: true,
              questions: true,
            },
          },
        },
      });

      res.status(201).json({
        success: true,
        message: `Paper duplicated successfully as "${duplicatedExamName}".`,
        paper: fullNewPaper,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/papers/:id/archive
 * Toggle or set paper archive status.
 */
papersRouter.post(
  '/:id/archive',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const teacherId = req.teacher!.id;
      const { id } = req.params;

      const paper = await assertTeacherOwnsPaper(teacherId, id);

      const updated = await prisma.paper.update({
        where: { id: paper.id },
        data: { isArchived: true },
      });

      await prisma.auditLog.create({
        data: {
          teacherId,
          action: 'PAPER_ARCHIVED',
          entityType: 'PAPER',
          entityId: paper.id,
          details: `Archived examination paper "${paper.examinationName}"`,
        },
      });

      res.json({
        success: true,
        message: `Paper "${paper.examinationName}" moved to archive.`,
        paper: updated,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/papers/:id/restore
 * Restore an archived paper back to active papers list.
 */
papersRouter.post(
  '/:id/restore',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const teacherId = req.teacher!.id;
      const { id } = req.params;

      const paper = await assertTeacherOwnsPaper(teacherId, id);

      const updated = await prisma.paper.update({
        where: { id: paper.id },
        data: { isArchived: false },
      });

      await prisma.auditLog.create({
        data: {
          teacherId,
          action: 'PAPER_RESTORED',
          entityType: 'PAPER',
          entityId: paper.id,
          details: `Restored examination paper "${paper.examinationName}" to active list`,
        },
      });

      res.json({
        success: true,
        message: `Paper "${paper.examinationName}" restored to active papers.`,
        paper: updated,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/papers/:id/pdf-history
 * Retrieve generation logs and version history of generated PDFs for a paper.
 */
papersRouter.get(
  '/:id/pdf-history',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const teacherId = req.teacher!.id;
      const { id } = req.params;

      const paper = await assertTeacherOwnsPaper(teacherId, id);

      const history = await prisma.pdfHistory.findMany({
        where: { paperId: paper.id },
        orderBy: { version: 'desc' },
      });

      res.json({
        paperId: paper.id,
        examinationName: paper.examinationName,
        currentVersion: (paper as any).pdfVersion || 0,
        pdfGeneratedAt: (paper as any).pdfGeneratedAt,
        history,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/papers/:id/pdf-history
 * Record a PDF generation event with incrementing version and metadata.
 */
papersRouter.post(
  '/:id/pdf-history',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const teacherId = req.teacher!.id;
      const { id } = req.params;
      const { totalMarks, questionCount, pageCount, status } = req.body || {};

      const paper = await assertTeacherOwnsPaper(teacherId, id);

      const currentVersion = ((paper as any).pdfVersion || 0) + 1;
      const now = new Date();

      // Create PDF History record
      const pdfHistory = await prisma.pdfHistory.create({
        data: {
          paperId: paper.id,
          version: currentVersion,
          generatedAt: now,
          totalMarks: Number(totalMarks) || paper.totalMarks || 0,
          questionCount: Number(questionCount) || 0,
          pageCount: Number(pageCount) || 1,
          status: status ? String(status) : 'GENERATED',
        },
      });

      // Update paper with new pdfVersion and pdfGeneratedAt
      const updatedPaper = await prisma.paper.update({
        where: { id: paper.id },
        data: {
          pdfVersion: currentVersion,
          pdfGeneratedAt: now,
          status: 'READY',
        },
      });

      // Record Audit Log
      await prisma.auditLog.create({
        data: {
          teacherId,
          action: 'PDF_GENERATED',
          entityType: 'PAPER',
          entityId: paper.id,
          details: `Generated PDF v${currentVersion} for "${paper.examinationName}" (${pdfHistory.questionCount} questions, ${pdfHistory.totalMarks} marks)`,
        },
      });

      res.status(201).json({
        success: true,
        message: `PDF v${currentVersion} recorded successfully.`,
        pdfHistory,
        paper: updatedPaper,
      });
    } catch (err) {
      next(err);
    }
  }
);


