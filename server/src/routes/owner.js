import { Router } from 'express';
import { DEFAULT_OWNER } from '../db.js';

export function ownerRouter() {
  const router = Router();

  router.get('/', (req, res) => {
    res.json(DEFAULT_OWNER);
  });

  return router;
}
