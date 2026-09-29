const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'test-only-jwt-secret';
const { authenticateToken } = require('../middleware/auth');

function responseDouble() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    }
  };
}

test('missing credentials return 401', () => {
  const res = responseDouble();
  let called = false;

  authenticateToken({ headers: {}, query: {} }, res, () => { called = true; });

  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.body, { error: 'Access denied' });
  assert.equal(called, false);
});

test('invalid credentials return 401 so stale sessions can be cleared', async () => {
  const res = responseDouble();
  let called = false;

  authenticateToken(
    { headers: { authorization: 'Bearer invalid-token' }, query: {} },
    res,
    () => { called = true; }
  );

  await new Promise(resolve => setImmediate(resolve));
  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.body, { error: 'Invalid token' });
  assert.equal(called, false);
});

test('valid credentials continue with the decoded user', async () => {
  const user = { id: 7, role: 'admin' };
  const token = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: '1h' });
  const req = { headers: { authorization: `Bearer ${token}` }, query: {} };
  const res = responseDouble();
  let decoded;

  authenticateToken(req, res, () => { decoded = req.user; });

  await new Promise(resolve => setImmediate(resolve));
  assert.equal(decoded.id, user.id);
  assert.equal(decoded.role, user.role);
  assert.equal(res.statusCode, 200);
});
