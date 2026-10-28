import prisma from './db';

export class AuthorizationError extends Error {
  statusCode: number;
  code: string;

  constructor(message: string, statusCode: number = 403, code: string = 'FORBIDDEN') {
    super(message);
    this.name = 'AuthorizationError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

/**
 * Ensures that the given class exists and is owned by the specified teacher.
 * Throws 404 if class does not exist.
 * Throws 403 if class belongs to another teacher.
 */
export async function assertTeacherOwnsClass(teacherId: string, classId: string) {
  if (!classId) {
    throw new AuthorizationError('Class ID is required', 400, 'INVALID_INPUT');
  }

  const classRecord = await prisma.class.findUnique({
    where: { id: classId },
  });

  if (!classRecord) {
    throw new AuthorizationError('Class not found', 404, 'CLASS_NOT_FOUND');
  }

  if (classRecord.teacherId !== teacherId) {
    throw new AuthorizationError(
      'Access denied. You do not have permission to view or manage this class.',
      403,
      'CROSS_TEACHER_ACCESS_DENIED'
    );
  }

  return classRecord;
}

/**
 * Ensures that the given subject exists and is owned by the specified teacher.
 * Throws 404 if subject does not exist.
 * Throws 403 if subject belongs to another teacher.
 */
export async function assertTeacherOwnsSubject(teacherId: string, subjectId: string) {
  if (!subjectId) {
    throw new AuthorizationError('Subject ID is required', 400, 'INVALID_INPUT');
  }

  const subjectRecord = await prisma.subject.findUnique({
    where: { id: subjectId },
    include: {
      class: true,
    },
  });

  if (!subjectRecord) {
    throw new AuthorizationError('Subject not found', 404, 'SUBJECT_NOT_FOUND');
  }

  if (subjectRecord.teacherId !== teacherId) {
    throw new AuthorizationError(
      'Access denied. You do not have permission to view or manage this subject.',
      403,
      'CROSS_TEACHER_ACCESS_DENIED'
    );
  }

  return subjectRecord;
}

/**
 * Ensures that the given resource exists and is owned by the specified teacher.
 * Throws 404 if resource does not exist.
 * Throws 403 if resource belongs to another teacher.
 */
export async function assertTeacherOwnsResource(teacherId: string, resourceId: string) {
  if (!resourceId) {
    throw new AuthorizationError('Resource ID is required', 400, 'INVALID_INPUT');
  }

  const resource = await prisma.resource.findUnique({
    where: { id: resourceId },
    include: {
      class: true,
      subject: true,
      file: true,
      pages: {
        orderBy: { pageNumber: 'asc' },
      },
    },
  });

  if (!resource) {
    throw new AuthorizationError('Resource not found', 404, 'RESOURCE_NOT_FOUND');
  }

  if (resource.teacherId !== teacherId) {
    throw new AuthorizationError(
      'Access denied. You do not have permission to view or access this resource.',
      403,
      'CROSS_TEACHER_ACCESS_DENIED'
    );
  }

  return resource;
}

/**
 * Ensures that the given paper exists and is owned by the specified teacher.
 * Throws 404 if paper does not exist.
 * Throws 403 if paper belongs to another teacher.
 */
export async function assertTeacherOwnsPaper(teacherId: string, paperId: string) {
  if (!paperId) {
    throw new AuthorizationError('Paper ID is required', 400, 'INVALID_INPUT');
  }

  const paper = await prisma.paper.findUnique({
    where: { id: paperId },
    include: {
      class: true,
      subject: true,
      sections: {
        orderBy: { position: 'asc' },
        include: {
          choiceGroups: {
            orderBy: { position: 'asc' },
          },
          questions: {
            orderBy: { position: 'asc' },
            include: {
              sourceResource: {
                select: { id: true, name: true, fileType: true },
              },
            },
          },
        },
      },
      choiceGroups: {
        orderBy: { position: 'asc' },
      },
      questions: {
        orderBy: { position: 'asc' },
        include: {
          sourceResource: {
            select: { id: true, name: true, fileType: true },
          },
        },
      },
    },
  });

  if (!paper) {
    throw new AuthorizationError('Paper not found', 404, 'PAPER_NOT_FOUND');
  }

  if (paper.teacherId !== teacherId) {
    throw new AuthorizationError(
      'Access denied. You do not have permission to view or manage this examination paper.',
      403,
      'CROSS_TEACHER_ACCESS_DENIED'
    );
  }

  return paper;
}


