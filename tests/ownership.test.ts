import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createExpressApp } from '../src/server/app';
import prisma from '../src/server/db';
import { hashPassword, signToken } from '../src/server/auth';

const app = createExpressApp();

describe('Teacher Ownership & Cross-Teacher Access Enforcement', () => {
  let teacherA: { id: string; token: string; classId: string; subjectId: string };
  let teacherB: { id: string; token: string; classId: string; subjectId: string };

  beforeAll(async () => {
    const passwordHash = await hashPassword('Secret@123');

    // Create Teacher A
    const userA = await prisma.user.create({
      data: {
        name: 'Teacher Alpha',
        email: `alpha_${Date.now()}@school.edu`,
        passwordHash,
      },
    });
    const tokenA = signToken({ id: userA.id, email: userA.email, name: userA.name, role: userA.role });

    const classA = await prisma.class.create({
      data: {
        name: 'Alpha Physics Room',
        teacherId: userA.id,
      },
    });

    const subjectA = await prisma.subject.create({
      data: {
        name: 'Quantum Theory',
        classId: classA.id,
        teacherId: userA.id,
      },
    });

    teacherA = { id: userA.id, token: tokenA, classId: classA.id, subjectId: subjectA.id };

    // Create Teacher B
    const userB = await prisma.user.create({
      data: {
        name: 'Teacher Beta',
        email: `beta_${Date.now()}@school.edu`,
        passwordHash,
      },
    });
    const tokenB = signToken({ id: userB.id, email: userB.email, name: userB.name, role: userB.role });

    const classB = await prisma.class.create({
      data: {
        name: 'Beta Literature Lab',
        teacherId: userB.id,
      },
    });

    const subjectB = await prisma.subject.create({
      data: {
        name: 'World Literature',
        classId: classB.id,
        teacherId: userB.id,
      },
    });

    teacherB = { id: userB.id, token: tokenB, classId: classB.id, subjectId: subjectB.id };
  });

  it('prevents Teacher A from listing Teacher B classes', async () => {
    const res = await request(app)
      .get('/api/classes')
      .set('Authorization', `Bearer ${teacherA.token}`);

    expect(res.status).toBe(200);
    const ids = res.body.classes.map((c: any) => c.id);
    expect(ids).toContain(teacherA.classId);
    expect(ids).not.toContain(teacherB.classId);
  });

  it('prevents Teacher A from reading Teacher B class with 403', async () => {
    const res = await request(app)
      .get(`/api/classes/${teacherB.classId}`)
      .set('Authorization', `Bearer ${teacherA.token}`);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('CROSS_TEACHER_ACCESS_DENIED');
  });

  it('prevents Teacher A from updating/renaming Teacher B class with 403', async () => {
    const res = await request(app)
      .patch(`/api/classes/${teacherB.classId}`)
      .set('Authorization', `Bearer ${teacherA.token}`)
      .send({ name: 'Hacked Class Name' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('CROSS_TEACHER_ACCESS_DENIED');

    // Confirm name was not changed in db
    const check = await prisma.class.findUnique({ where: { id: teacherB.classId } });
    expect(check?.name).toBe('Beta Literature Lab');
  });

  it('prevents Teacher A from deleting Teacher B class with 403', async () => {
    const res = await request(app)
      .delete(`/api/classes/${teacherB.classId}`)
      .set('Authorization', `Bearer ${teacherA.token}`);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('CROSS_TEACHER_ACCESS_DENIED');

    // Confirm class still exists
    const check = await prisma.class.findUnique({ where: { id: teacherB.classId } });
    expect(check).not.toBeNull();
  });

  it('prevents Teacher A from creating a subject under Teacher B class with 403', async () => {
    const res = await request(app)
      .post('/api/subjects')
      .set('Authorization', `Bearer ${teacherA.token}`)
      .send({
        name: 'Unauthorized Subject Injection',
        classId: teacherB.classId,
      });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('CROSS_TEACHER_ACCESS_DENIED');
  });

  it('prevents Teacher A from listing Teacher B subjects', async () => {
    const res = await request(app)
      .get('/api/subjects')
      .set('Authorization', `Bearer ${teacherA.token}`);

    expect(res.status).toBe(200);
    const ids = res.body.subjects.map((s: any) => s.id);
    expect(ids).toContain(teacherA.subjectId);
    expect(ids).not.toContain(teacherB.subjectId);
  });

  it('prevents Teacher A from reading Teacher B subject with 403', async () => {
    const res = await request(app)
      .get(`/api/subjects/${teacherB.subjectId}`)
      .set('Authorization', `Bearer ${teacherA.token}`);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('CROSS_TEACHER_ACCESS_DENIED');
  });

  it('prevents Teacher A from updating Teacher B subject with 403', async () => {
    const res = await request(app)
      .patch(`/api/subjects/${teacherB.subjectId}`)
      .set('Authorization', `Bearer ${teacherA.token}`)
      .send({ name: 'Renamed by Unauthorized Teacher' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('CROSS_TEACHER_ACCESS_DENIED');
  });

  it('prevents Teacher A from deleting Teacher B subject with 403', async () => {
    const res = await request(app)
      .delete(`/api/subjects/${teacherB.subjectId}`)
      .set('Authorization', `Bearer ${teacherA.token}`);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('CROSS_TEACHER_ACCESS_DENIED');

    // Confirm subject still exists
    const check = await prisma.subject.findUnique({ where: { id: teacherB.subjectId } });
    expect(check).not.toBeNull();
  });
});
