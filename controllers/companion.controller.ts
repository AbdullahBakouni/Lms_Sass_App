import { Request, Response } from 'express';
import { db } from '../src/db';
import { companions } from '../src/db/schema';

// @ts-ignore
import { canUserCreateCompanion } from './user.controller';

export const createCompanion = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { userId, name, subject, helpWith, voice, durationMinutes } = req.body;

  if (!userId || !name || !subject || !helpWith || !voice || !durationMinutes) {
    res.status(400).json({ error: 'Missing required fields' });
    return;
  }
  const style =
    req.body.style === undefined || req.body.style === 'none' || !req.body.style
      ? null
      : req.body.style;
  const check = await canUserCreateCompanion(
    userId,
    voice,
    style,
    durationMinutes,
  );

  if (!check.allowed) {
    res
      .status(403)
      .json({ error: check.reason || 'Not allowed to create companion' });
    return;
  }
  try {
    const result = await db.transaction(async (tx) => {
      const [createdCompanion] = await tx
        .insert(companions)
        .values({
          userId,
          name,
          subject,
          helpWith,
          voice,
          style,
          durationMinutes,
        })
        .returning();

      return createdCompanion;
    });

    res.status(201).json({ companion: result });
  } catch (err) {
    console.error('Create companion error:', err);
    res.status(500).json({ error: 'Something went wrong' });
  }
};
