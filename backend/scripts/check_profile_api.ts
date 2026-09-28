import jwt from 'jsonwebtoken';

async function main() {
  const secret = process.env.JWT_SECRET || 'your_jwt_secret_here';
  const token = jwt.sign({ id: 1, role: 'admin', roles: ['admin'] }, secret);
  const res = await fetch('http://localhost:3000/api/profile', {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();
  console.log('GET /api/profile response for Admin User:');
  console.log('profilePhotoUrl:', data.data?.profilePhotoUrl);
  console.log('name:', data.data?.name);
  console.log('phone:', data.data?.phone);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
