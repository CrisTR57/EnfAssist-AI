const express = require('express');
const { prisma } = require('../lib/prisma');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

const router = express.Router();
const editableFields = [
  'dni',
  'nombres',
  'apellidos',
  'fechaNacimiento',
  'sexo',
  'historiaClinica',
  'qrCode',
  'qrStatus',
  'tipoSangre',
  'direccion',
  'telefono',
  'alergias',
  'enfermedadesCronicas',
  'medicamentosHabituales',
  'estado'
];

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function optionalText(value) {
  const normalized = text(value);
  return normalized || null;
}

function parseDate(value) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    const error = new Error('invalid_birth_date');
    error.statusCode = 400;
    throw error;
  }
  return parsed;
}

function createQrCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const block = () => Array.from({ length: 4 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
  return `PAT-${block()}-${block()}-${block()}`;
}

function publicPatient(patient) {
  return {
    id: patient.id,
    dni: patient.dni,
    nombres: patient.nombres,
    apellidos: patient.apellidos,
    fechaNacimiento: patient.fechaNacimiento,
    sexo: patient.sexo,
    historiaClinica: patient.historiaClinica,
    qrCode: patient.qrCode,
    qrStatus: patient.qrStatus,
    tipoSangre: patient.tipoSangre,
    direccion: patient.direccion,
    telefono: patient.telefono,
    alergias: patient.alergias,
    enfermedadesCronicas: patient.enfermedadesCronicas,
    medicamentosHabituales: patient.medicamentosHabituales,
    estado: patient.estado,
    createdAt: patient.createdAt,
    updatedAt: patient.updatedAt
  };
}

function accessScope(req) {
  return req.auth.role === 'PACIENTE'
    ? { usuarios: { some: { userId: req.auth.userId } } }
    : {};
}

function patientLookup(value) {
  const identifier = text(value);
  return {
    AND: [
      accessScope,
      { OR: [{ id: identifier }, { qrCode: identifier }, { dni: identifier }] }
    ]
  };
}

function handlePrismaError(error, res, next) {
  if (error?.code === 'P2002') {
    return res.status(409).json({ error: 'patient_unique_field_conflict' });
  }
  return next(error);
}

router.use(authenticateToken);

router.get('/', async (req, res, next) => {
  try {
    const search = text(req.query.search);
    const where = {
      ...accessScope(req),
      ...(search
        ? {
            OR: [
              { dni: { contains: search, mode: 'insensitive' } },
              { nombres: { contains: search, mode: 'insensitive' } },
              { apellidos: { contains: search, mode: 'insensitive' } },
              { qrCode: { contains: search, mode: 'insensitive' } }
            ]
          }
        : {})
    };
    const patients = await prisma.patient.findMany({
      where,
      orderBy: [{ apellidos: 'asc' }, { nombres: 'asc' }]
    });
    return res.json({ patients: patients.map(publicPatient) });
  } catch (error) {
    return next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const patient = await prisma.patient.findFirst({ where: patientLookup(req.params.id) });
    if (!patient) return res.status(404).json({ error: 'patient_not_found' });
    return res.json({ patient: publicPatient(patient) });
  } catch (error) {
    return next(error);
  }
});

router.post('/', authorizeRoles('ADMIN', 'ENFERMERO'), async (req, res, next) => {
  try {
    const dni = text(req.body.dni);
    const nombres = text(req.body.nombres);
    const apellidos = text(req.body.apellidos);
    if (!dni || !nombres || !apellidos) {
      return res.status(400).json({ error: 'patient_required_fields' });
    }

    const patient = await prisma.patient.create({
      data: {
        dni,
        nombres,
        apellidos,
        fechaNacimiento: parseDate(req.body.fechaNacimiento),
        sexo: optionalText(req.body.sexo),
        historiaClinica: optionalText(req.body.historiaClinica),
        qrCode: optionalText(req.body.qrCode) || createQrCode(),
        qrStatus: optionalText(req.body.qrStatus) || 'Activo',
        tipoSangre: optionalText(req.body.tipoSangre),
        direccion: optionalText(req.body.direccion),
        telefono: optionalText(req.body.telefono),
        alergias: optionalText(req.body.alergias),
        enfermedadesCronicas: optionalText(req.body.enfermedadesCronicas),
        medicamentosHabituales: optionalText(req.body.medicamentosHabituales),
        estado: optionalText(req.body.estado) || 'ACTIVO'
      }
    });
    return res.status(201).json({ patient: publicPatient(patient) });
  } catch (error) {
    return handlePrismaError(error, res, next);
  }
});

router.patch('/:id', authorizeRoles('ADMIN', 'ENFERMERO'), async (req, res, next) => {
  try {
    const existing = await prisma.patient.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'patient_not_found' });

    const data = {};
    for (const field of editableFields) {
      if (!Object.prototype.hasOwnProperty.call(req.body, field)) continue;
      if (field === 'fechaNacimiento') data[field] = parseDate(req.body[field]);
      else if (field === 'dni' || field === 'nombres' || field === 'apellidos') data[field] = text(req.body[field]);
      else data[field] = optionalText(req.body[field]);
    }
    if (data.dni === '' || data.nombres === '' || data.apellidos === '') {
      return res.status(400).json({ error: 'patient_required_fields' });
    }

    const patient = await prisma.patient.update({ where: { id: req.params.id }, data });
    return res.json({ patient: publicPatient(patient) });
  } catch (error) {
    return handlePrismaError(error, res, next);
  }
});

module.exports = router;
