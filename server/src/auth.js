// Owner authentication guard.
//
// The project has no registration/accounts, so protection is opt-in: when the
// OWNER_TOKEN environment variable is set, owner-only endpoints require the
// matching `x-owner-token` header. When it is unset (local demo, E2E tests) the
// endpoints stay open, preserving the original out-of-the-box experience.
export function requireOwner(req, res, next) {
  const expected = process.env.OWNER_TOKEN;
  if (!expected) {
    return next();
  }

  const provided = req.get('x-owner-token');
  if (provided !== expected) {
    return res.status(401).json({ error: 'Owner authentication required.' });
  }

  return next();
}
