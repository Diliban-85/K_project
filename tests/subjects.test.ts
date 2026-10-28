import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createExpressApp } from '../src/server/app';
import prisma from '../src/server/db';
import { hashPassword, signToken } from '../src/server/auth';

const app = createExpressApp();

describe('Subject Management CRUD', () => {
  let teacherId: string;
  let teacherToken: string;
  let classId: string;
  let createdSubjectId: string;

  beforeAll(async () => {
    const email = `subject_teacher_${Date.now()}@school.edu`;
    const passwordHash = await hashPassword('Pass@123');
    const teacher = await prisma.user.create({
      data: {
        name: 'Subject Test Teacher',
        email,
        passwordHash,
        role: 'TEACHER',
      },
    });

    teacherId = teacher.id;
    teacherToken = signToken({
      id: teacher.id,
      email: teacher.email,
      name: teacher.name,
      role: teacher.role,
    });

    // Create a class to host subjects
    const cls = await prisma.class.create({
      data: {
        name: 'Grade 12 STEM',
        grade: '12',
        teacherId,
      },
    });
    classId = cls.id;
  });

  it('blocks unauthenticated subject requests with 401', async () => {
    const res = await request(app).get('/api/subjects');
    expect(res.status).toBe(401);
  });

  it('creates a new subject attached to teacher class', async () => {
    const res = await request(app)
      .post('/api/subjects')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        name: 'Organic Chemistry',
        code: 'CHEM-401',
        description: 'Reactions, mechanisms and stereochemistry',
        classId,
      });

    expect(res.status).toBe(201);
    expect(res.body.subject).toBeDefined();
    expect(res.body.subject.name).toBe('Organic Chemistry');
    expect(res.body.subject.classId).toBe(classId);
    expect(res.body.subject.teacherId).toBe(teacherId);
    createdSubjectId = res.body.subject.id;
  });

  it('rejects subject creation without classId or name', async () => {
    const res = await request(app)
      .post('/api/subjects')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        name: 'Missing Class',
      });

    expect(res.status).toBe(400);
  });

  it('prevents duplicate subject name within the same class', async () => {
    const res = await request(app)
      .post('/api/subjects')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        name: 'Organic Chemistry',
        classId,
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('already exists in this class');
  });

  it('lists subjects for teacher with class details', async () => {
    const res = await request(app)
      .get('/api/subjects')
      .set('Authorization', `Bearer ${teacherToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.subjects)).toBe(true);
    expect(res.body.subjects.some((s: any) => s.id === createdSubjectId)).toBe(true);
  });

  it('filters subjects by classId', async () => {
    const res = await request(app)
      .get(`/api/subjects?classId=${classId}`)
      .set('Authorization', `Bearer ${teacherToken}`);

    expect(res.status).toBe(200);
    expect(res.body.subjects.every((s: any) => s.class.id === classId)).toBe(true);
  });

  it('renames and updates subject', async () => {
    const res = await request(app)
      .patch(`/api/subjects/${createdSubjectId}`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        name: 'Advanced Organic Chemistry',
        code: 'CHEM-402',
      });

    expect(res.status).toBe(200);
    expect(res.body.subject.name).toBe('Advanced Organic Chemistry');
    expect(res.body.subject.code).toBe('CHEM-402');
  });

  it('deletes subject successfully', async () => {
    const res = await request(app)
      .delete(`/api/subjects/${createdSubjectId}`)
      .set('Authorization', `Bearer ${teacherToken}`);

    expect(res.status).toBe(200);
    expect(res.body.deletedId).toBe(createdSubjectId);

    // Verify it is gone
    const verifyRes = await request(app)
      .get(`/api/subjects/${createdSubjectId}`)
      .set('Authorization', `Bearer ${teacherToken}`);
    expect(verifyRes.status).toBe(404);
  });
});
