import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createExpressApp } from '../src/server/app';
import prisma from '../src/server/db';
import { hashPassword, signToken } from '../src/server/auth';

const app = createExpressApp();

describe('Class Management CRUD', () => {
  let teacherId: string;
  let teacherToken: string;
  let createdClassId: string;

  beforeAll(async () => {
    // Create dedicated teacher for class tests
    const email = `class_teacher_${Date.now()}@school.edu`;
    const passwordHash = await hashPassword('Pass@123');
    const teacher = await prisma.user.create({
      data: {
        name: 'Class Test Teacher',
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
  });

  it('blocks unauthenticated requests to /api/classes', async () => {
    const res = await request(app).get('/api/classes');
    expect(res.status).toBe(401);
  });

  it('creates a new class successfully', async () => {
    const res = await request(app)
      .post('/api/classes')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        name: 'Grade 10 Biology',
        grade: '10',
        section: 'B',
        description: 'Genetics and cell structure',
      });

    expect(res.status).toBe(201);
    expect(res.body.class).toBeDefined();
    expect(res.body.class.name).toBe('Grade 10 Biology');
    expect(res.body.class.teacherId).toBe(teacherId);
    createdClassId = res.body.class.id;
  });

  it('rejects creating class without name with 400', async () => {
    const res = await request(app)
      .post('/api/classes')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        grade: '10',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Class name is required');
  });

  it('prevents creating duplicate class name for the same teacher', async () => {
    const res = await request(app)
      .post('/api/classes')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        name: 'Grade 10 Biology',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('already exists');
  });

  it('lists classes belonging to the authenticated teacher', async () => {
    const res = await request(app)
      .get('/api/classes')
      .set('Authorization', `Bearer ${teacherToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.classes)).toBe(true);
    expect(res.body.classes.length).toBeGreaterThanOrEqual(1);
    expect(res.body.classes.some((c: any) => c.id === createdClassId)).toBe(true);
  });

  it('fetches single class details by ID', async () => {
    const res = await request(app)
      .get(`/api/classes/${createdClassId}`)
      .set('Authorization', `Bearer ${teacherToken}`);

    expect(res.status).toBe(200);
    expect(res.body.class.id).toBe(createdClassId);
    expect(res.body.class.name).toBe('Grade 10 Biology');
  });

  it('renames and updates class metadata', async () => {
    const res = await request(app)
      .patch(`/api/classes/${createdClassId}`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        name: 'Grade 10 Biology Honors',
        description: 'Advanced genetics honors section',
      });

    expect(res.status).toBe(200);
    expect(res.body.class.name).toBe('Grade 10 Biology Honors');
    expect(res.body.class.description).toBe('Advanced genetics honors section');
  });

  it('deletes class successfully', async () => {
    const res = await request(app)
      .delete(`/api/classes/${createdClassId}`)
      .set('Authorization', `Bearer ${teacherToken}`);

    expect(res.status).toBe(200);
    expect(res.body.deletedId).toBe(createdClassId);

    // Verify it is gone
    const verifyRes = await request(app)
      .get(`/api/classes/${createdClassId}`)
      .set('Authorization', `Bearer ${teacherToken}`);
    expect(verifyRes.status).toBe(404);
  });
});
