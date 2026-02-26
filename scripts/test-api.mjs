import fetch from 'node-fetch';
import { randomUUID } from 'crypto';

const BASE_URL = 'http://localhost:3000';
let cookie = '';

async function login() {
  const res = await fetch(`${BASE_URL}/api/auth/callback/credentials?`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'email=admin%40parwestgroup.com&password=admin123%40&redirect=false'
  });
  
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) {
    // Extract NextAuth session cookie
    const cookies = setCookie.split(', ').map(c => c.split(';')[0]);
    cookie = cookies.join('; ');
    console.log('Login successful, got cookies');
  } else {
    console.log('Login failed', await res.text());
  }
}

async function testUsersAPI() {
  console.log('--- Testing /api/users ---');
  // 1. Create User
  const newEmail = `testuser_${randomUUID()}@example.com`;
  const createRes = await fetch(`${BASE_URL}/api/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
    body: JSON.stringify({
      name: 'Integration Test',
      email: newEmail,
      roleId: 'role-id-will-fail-if-invalid', // We need a real roleId
      contactNumber: '1234567890',
      password: 'password123',
      status: 'ACTIVE'
    })
  });
  console.log('Create User Status:', createRes.status);
  const createData = await createRes.json();
  console.log('Create User Response:', createData);
}

async function run() {
  await login();
  await testUsersAPI();
}
run();
