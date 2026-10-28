import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createExpressApp } from '../src/server/app';
import prisma from '../src/server/db';
import { hashPassword, signToken } from '../src/server/auth';
import { getStorageProvider } from '../src/server/storage';

const app = createExpressApp();

const samplePdfBuffer = Buffer.from(
  `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << >> >>
endobj
4 0 obj
<< /Length 44 >>
stream
BT
/F1 12 Tf
72 712 Td
(Hello School Assessment PDF) Tj
ET
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000216 00000 n 
trailer
<< /Size 5 /Root 1 0 R >>
startxref
310
%%EOF`
);

describe('Phase 2 - Resource Management, Storage & Authorization', () => {
  let teacherA: { id: string; token: string; classId: string; subjectId: string };
  let teacherB: { id: string; token: string; classId: string; subjectId: string };
  let createdResourceId: string;

  beforeAll(async () => {
    const passwordHash = await hashPassword('ResourcePass@123');

    // Create Teacher A
    const userA = await prisma.user.create({
      data: {
        name: 'Teacher Resource Alpha',
        email: `res_alpha_${Date.now()}@school.edu`,
        passwordHash,
      },
    });
    const tokenA = signToken({ id: userA.id, email: userA.email, name: userA.name, role: userA.role });

    const classA = await prisma.class.create({
      data: { name: `Alpha Class ${Date.now()}`, teacherId: userA.id },
    });

    const subjectA = await prisma.subject.create({
      data: { name: 'Alpha Physics', classId: classA.id, teacherId: userA.id },
    });

    teacherA = { id: userA.id, token: tokenA, classId: classA.id, subjectId: subjectA.id };

    // Create Teacher B
    const userB = await prisma.user.create({
      data: {
        name: 'Teacher Resource Beta',
        email: `res_beta_${Date.now()}@school.edu`,
        passwordHash,
      },
    });
    const tokenB = signToken({ id: userB.id, email: userB.email, name: userB.name, role: userB.role });

    const classB = await prisma.class.create({
      data: { name: `Beta Class ${Date.now()}`, teacherId: userB.id },
    });

    const subjectB = await prisma.subject.create({
      data: { name: 'Beta Literature', classId: classB.id, teacherId: userB.id },
    });

    teacherB = { id: userB.id, token: tokenB, classId: classB.id, subjectId: subjectB.id };
  });

  it('uploads a valid PDF resource, stores file in storage vault, and extracts page text', async () => {
    const res = await request(app)
      .post('/api/resources')
      .set('Authorization', `Bearer ${teacherA.token}`)
      .field('name', 'Kinematics Unit 1 Syllabus')
      .field('classId', teacherA.classId)
      .field('subjectId', teacherA.subjectId)
      .attach('file', samplePdfBuffer, {
        filename: 'kinematics_syllabus.pdf',
        contentType: 'application/pdf',
      });

    expect(res.status).toBe(201);
    expect(res.body.resource).toBeDefined();
    expect(res.body.resource.name).toBe('Kinematics Unit 1 Syllabus');
    expect(res.body.resource.teacherId).toBe(teacherA.id);
    expect(res.body.resource.processingStatus).toBe('READY');
    expect(res.body.resource.file).toBeDefined();
    expect(res.body.resource.file.originalName).toBe('kinematics_syllabus.pdf');

    createdResourceId = res.body.resource.id;

    // Verify file exists in storage provider
    const storage = getStorageProvider();
    const exists = await storage.hasObject(res.body.resource.storagePath);
    expect(exists).toBe(true);

    // Verify page extraction occurred
    const pages = await prisma.resourcePage.findMany({
      where: { resourceId: createdResourceId },
    });
    expect(pages.length).toBeGreaterThanOrEqual(1);
    expect(pages[0].text).toContain('Hello School Assessment PDF');
  });

  it('rejects uploads with unsupported file types with 400', async () => {
    const res = await request(app)
      .post('/api/resources')
      .set('Authorization', `Bearer ${teacherA.token}`)
      .field('name', 'Malicious File')
      .field('classId', teacherA.classId)
      .field('subjectId', teacherA.subjectId)
      .attach('file', Buffer.from('#!/bin/bash\necho bad'), {
        filename: 'script.sh',
        contentType: 'application/x-sh',
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('UNSUPPORTED_FILE_TYPE');
  });

  it('rejects upload when subject does not belong to the selected class', async () => {
    const res = await request(app)
      .post('/api/resources')
      .set('Authorization', `Bearer ${teacherA.token}`)
      .field('name', 'Mismatched Resource')
      .field('classId', teacherA.classId)
      .field('subjectId', teacherB.subjectId) // Belongs to teacher B's class
      .attach('file', samplePdfBuffer, {
        filename: 'sample.pdf',
        contentType: 'application/pdf',
      });

    // Subject ownership check or mismatch check triggers
    expect([400, 403]).toContain(res.status);
  });

  it('lists only resources owned by the requesting teacher', async () => {
    const resA = await request(app)
      .get('/api/resources')
      .set('Authorization', `Bearer ${teacherA.token}`);

    expect(resA.status).toBe(200);
    const idsA = resA.body.resources.map((r: any) => r.id);
    expect(idsA).toContain(createdResourceId);

    const resB = await request(app)
      .get('/api/resources')
      .set('Authorization', `Bearer ${teacherB.token}`);

    expect(resB.status).toBe(200);
    const idsB = resB.body.resources.map((r: any) => r.id);
    expect(idsB).not.toContain(createdResourceId);
  });

  it('prevents Teacher B from reading Teacher A resource with 403 Forbidden', async () => {
    const res = await request(app)
      .get(`/api/resources/${createdResourceId}`)
      .set('Authorization', `Bearer ${teacherB.token}`);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('CROSS_TEACHER_ACCESS_DENIED');
  });

  it('prevents Teacher B from streaming/downloading Teacher A resource file with 403 Forbidden', async () => {
    const res = await request(app)
      .get(`/api/resources/${createdResourceId}/file`)
      .set('Authorization', `Bearer ${teacherB.token}`);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('CROSS_TEACHER_ACCESS_DENIED');
  });

  it('allows Teacher A to stream/download their own uploaded PDF with valid headers', async () => {
    const res = await request(app)
      .get(`/api/resources/${createdResourceId}/file`)
      .set('Authorization', `Bearer ${teacherA.token}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
    expect(res.headers['content-disposition']).toContain('kinematics_syllabus.pdf');
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('prevents Teacher B from deleting Teacher A resource with 403 Forbidden', async () => {
    const res = await request(app)
      .delete(`/api/resources/${createdResourceId}`)
      .set('Authorization', `Bearer ${teacherB.token}`);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('CROSS_TEACHER_ACCESS_DENIED');

    // Confirm resource still exists
    const check = await prisma.resource.findUnique({ where: { id: createdResourceId } });
    expect(check).not.toBeNull();
  });

  it('allows Teacher A to delete their own resource and cleans up storage', async () => {
    const res = await request(app)
      .delete(`/api/resources/${createdResourceId}`)
      .set('Authorization', `Bearer ${teacherA.token}`);

    expect(res.status).toBe(200);

    // Confirm record removed from database
    const check = await prisma.resource.findUnique({ where: { id: createdResourceId } });
    expect(check).toBeNull();

    // Confirm pages deleted
    const pageCheck = await prisma.resourcePage.findMany({ where: { resourceId: createdResourceId } });
    expect(pageCheck.length).toBe(0);
  });
});
