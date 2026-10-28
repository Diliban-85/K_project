import prisma from './db';
import { hashPassword } from './auth';

export async function seedDatabase() {
  console.log('Seeding initial teacher accounts...');

  const passwordHash = await hashPassword('Teacher@123');

  // Teacher 1: Dr. Eleanor Smith
  const teacher1 = await prisma.user.upsert({
    where: { email: 'smith@school.edu' },
    update: { passwordHash },
    create: {
      email: 'smith@school.edu',
      name: 'Dr. Eleanor Smith',
      passwordHash,
      role: 'TEACHER',
    },
  });

  // Teacher 2: Mr. Robert Johnson
  const teacher2 = await prisma.user.upsert({
    where: { email: 'johnson@school.edu' },
    update: { passwordHash },
    create: {
      email: 'johnson@school.edu',
      name: 'Mr. Robert Johnson',
      passwordHash,
      role: 'TEACHER',
    },
  });

  // Clean existing classes for these teachers to make seed idempotent
  const teacher1Classes = await prisma.class.findMany({ where: { teacherId: teacher1.id } });
  if (teacher1Classes.length === 0) {
    const class1 = await prisma.class.create({
      data: {
        name: 'Grade 10 - Section A',
        grade: '10',
        section: 'A',
        description: 'Sophomore science track',
        teacherId: teacher1.id,
      },
    });

    await prisma.subject.createMany({
      data: [
        {
          name: 'Physics',
          code: 'PHY-101',
          description: 'Mechanics and Thermodynamics',
          classId: class1.id,
          teacherId: teacher1.id,
        },
        {
          name: 'Chemistry',
          code: 'CHEM-101',
          description: 'Inorganic and Physical Chemistry',
          classId: class1.id,
          teacherId: teacher1.id,
        },
      ],
    });

    const class2 = await prisma.class.create({
      data: {
        name: 'Grade 11 - Advanced',
        grade: '11',
        section: 'Adv',
        description: 'Advanced placement cohorts',
        teacherId: teacher1.id,
      },
    });

    await prisma.subject.create({
      data: {
        name: 'AP Physics C',
        code: 'PHY-301',
        description: 'Calculus-based electromagnetism and mechanics',
        classId: class2.id,
        teacherId: teacher1.id,
      },
    });
  }

  const teacher2Classes = await prisma.class.findMany({ where: { teacherId: teacher2.id } });
  if (teacher2Classes.length === 0) {
    const class3 = await prisma.class.create({
      data: {
        name: 'Grade 9 - Algebra Foundations',
        grade: '9',
        section: 'B',
        description: 'Freshman core mathematics',
        teacherId: teacher2.id,
      },
    });

    await prisma.subject.createMany({
      data: [
        {
          name: 'Algebra I',
          code: 'MTH-101',
          description: 'Linear equations, polynomials, and quadratics',
          classId: class3.id,
          teacherId: teacher2.id,
        },
        {
          name: 'Euclidean Geometry',
          code: 'MTH-102',
          description: 'Proof fundamentals and coordinate geometry',
          classId: class3.id,
          teacherId: teacher2.id,
        },
      ],
    });
  }

  console.log('Seed completed successfully!');
  console.log(`Teacher 1: ${teacher1.email} (Password: Teacher@123)`);
  console.log(`Teacher 2: ${teacher2.email} (Password: Teacher@123)`);
}

// Allow direct execution: tsx src/server/seed.ts
if (process.argv[1]?.includes('seed.ts')) {
  seedDatabase()
    .catch((e) => {
      console.error('Seed error:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
