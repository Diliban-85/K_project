import { describe, it, expect } from 'vitest';
import prisma from '../src/server/db';
import { hashPassword } from '../src/server/auth';

describe('Basic Database Operations (Prisma)', () => {
  it('performs basic user, class, and subject relational operations with cascade deletion', async () => {
    const passwordHash = await hashPassword('TestPass@123');
    const email = `db_test_${Date.now()}@school.edu`;

    // 1. Create User
    const user = await prisma.user.create({
      data: {
        email,
        name: 'Database Operations Teacher',
        passwordHash,
      },
    });
    expect(user.id).toBeDefined();
    expect(user.email).toBe(email);

    // 2. Create Class
    const cls = await prisma.class.create({
      data: {
        name: 'Test Database Class',
        grade: '8',
        section: 'C',
        teacherId: user.id,
      },
    });
    expect(cls.id).toBeDefined();
    expect(cls.teacherId).toBe(user.id);

    // 3. Create Subject
    const subject = await prisma.subject.create({
      data: {
        name: 'Computer Science Basics',
        code: 'CS-08',
        classId: cls.id,
        teacherId: user.id,
      },
    });
    expect(subject.id).toBeDefined();
    expect(subject.classId).toBe(cls.id);
    expect(subject.teacherId).toBe(user.id);

    // 4. Query relationships
    const userWithRelations = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        classes: {
          include: {
            subjects: true,
          },
        },
      },
    });
    expect(userWithRelations?.classes.length).toBe(1);
    expect(userWithRelations?.classes[0].subjects.length).toBe(1);
    expect(userWithRelations?.classes[0].subjects[0].name).toBe('Computer Science Basics');

    // 5. Verify Cascade Deletion of Class removes Subjects
    await prisma.class.delete({
      where: { id: cls.id },
    });

    const orphanedSubject = await prisma.subject.findUnique({
      where: { id: subject.id },
    });
    expect(orphanedSubject).toBeNull();

    // 6. Cleanup User
    await prisma.user.delete({
      where: { id: user.id },
    });

    const deletedUser = await prisma.user.findUnique({
      where: { id: user.id },
    });
    expect(deletedUser).toBeNull();
  });
});
