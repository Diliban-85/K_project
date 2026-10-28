import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createExpressApp } from '../src/server/app';
import prisma from '../src/server/db';
import { hashPassword } from '../src/server/auth';

const app = createExpressApp();

describe('Authentication & Session Protection', () => {
  const testEmail = `auth_test_${Date.now()}@school.edu`;
  const testPassword = 'Password@123';
  let teacherToken: string;

  beforeAll(async () => {
    // Ensure clean state for test email
    await prisma.user.deleteMany({
      where: { email: testEmail },
    });
  });

  it('blocks unauthenticated access to /api/auth/me with 401', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  it('successfully registers a new teacher account', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Prof. Margaret Hamilton',
        email: testEmail,
        password: testPassword,
      });

    expect(res.status).toBe(201);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.email).toBe(testEmail);
    expect(res.body.user.role).toBe('TEACHER');
    expect(res.body.token).toBeDefined();
    teacherToken = res.body.token;
  });

  it('rejects registration with duplicate email with 409', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Another Name',
        email: testEmail,
        password: 'Password@999',
      });

    expect(res.status).toBe(409);
    expect(res.body.error).toContain('already exists');
  });

  it('rejects registration with password under 6 characters with 400', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Short Pass',
        email: 'short@school.edu',
        password: '123',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('at least 6 characters');
  });

  it('authenticates teacher with valid credentials on /api/auth/login', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: testEmail,
        password: testPassword,
      });

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(testEmail);
    expect(res.body.token).toBeDefined();
  });

  it('rejects login with incorrect password with 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: testEmail,
        password: 'WrongPassword!',
      });

    expect(res.status).toBe(401);
    expect(res.body.error).toContain('Invalid email or password');
  });

  it('rejects login with non-existent email with 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'nobody@school.edu',
        password: 'Password@123',
      });

    expect(res.status).toBe(401);
  });

  it('allows access to protected /api/auth/me with Bearer token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${teacherToken}`);

    expect(res.status).toBe(200);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.email).toBe(testEmail);
    expect(res.body.user.name).toBe('Prof. Margaret Hamilton');
  });

  it('clears session cookie on logout', async () => {
    const res = await request(app).post('/api/auth/logout');
    expect(res.status).toBe(200);
    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
  });
});
