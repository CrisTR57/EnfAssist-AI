const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { prisma } = require('../lib/prisma');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
const validRoles = new Set(['ADMIN', 'ENFERMERO', 'PACIENTE']);

function publicUser(user) {
  return {
    id: user.id,
    dni: user.dni,
    nombres: user.nombres,
    apellidos: user.apellidos,
    correo: user.correo,
    activo: user.activo,
    rol: user.rol,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

function createToken(user) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not configured');

  return jwt.sign(
    { sub: user.id, role: user.rol },
    secret,
    { expiresIn: process.env.JWT_EXPIRES_IN || '1h' }
  );
}

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

router.post('/register', async (req, res, next) => {
  try {
    const dni = normalizeText(req.body.dni);
    const nombres = normalizeText(req.body.nombres);
    const apellidos = normalizeText(req.body.apellidos);
    const correo = normalizeText(req.body.correo).toLowerCase();
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    const rol = normalizeText(req.body.rol || 'PACIENTE').toUpperCase();

    if (!dni || !nombres || !apellidos || !correo || password.length < 8) {
      return res.status(400).json({ error: 'invalid_registration_data' });
    }
    if (!validRoles.has(rol)) {
      return res.status(400).json({ error: 'invalid_role' });
    }
    if (rol !== 'PACIENTE') {
      return res.status(403).json({ error: 'privileged_role_registration_forbidden' });
    }

    const existing = await prisma.user.findFirst({
      where: { OR: [{ dni }, { correo }] },
      select: { dni: true, correo: true }
    });
    if (existing) {
      return res.status(409).json({ error: 'user_already_exists' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { dni, nombres, apellidos, correo, passwordHash, rol }
    });

    return res.status(201).json({
      user: publicUser(user),
      token: createToken(user)
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const identifier = normalizeText(req.body.identifier || req.body.correo || req.body.dni).toLowerCase();
    const password = typeof req.body.password === 'string' ? req.body.password : '';

    if (!identifier || !password) {
      return res.status(400).json({ error: 'credentials_required' });
    }

    const user = await prisma.user.findFirst({
      where: { OR: [{ correo: identifier }, { dni: identifier }] }
    });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ error: 'invalid_credentials' });
    }
    if (!user.activo) {
      return res.status(403).json({ error: 'user_inactive' });
    }

    return res.json({ user: publicUser(user), token: createToken(user) });
  } catch (error) {
    return next(error);
  }
});

router.get('/me', authenticateToken, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.auth.userId } });
    if (!user || !user.activo) return res.status(401).json({ error: 'user_not_available' });
    return res.json({ user: publicUser(user) });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
