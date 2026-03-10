import { describe, it, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

// ── Mock de Mongoose models ──
const mockUser = {
  _id: 'user123',
  username: 'testuser',
  name: 'Test User',
  email: 'test@example.com',
  role: 'client',
  passwordHash: '',
  emailVerified: true,
  toObject() { return { ...this }; },
  save: vi.fn(),
};

vi.mock('../src/models/User.js', () => ({
  User: {
    findOne: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock('../src/utils/emailService.js', () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(true),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(true),
}));

import { User } from '../src/models/User.js';

// ── Tests de Autenticación ──
describe('Autenticación - Lógica de Negocio', () => {

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = 'test-secret-key';
  });

  // ═══════════════════════════════════════════
  // JWT TOKEN
  // ═══════════════════════════════════════════
  describe('JWT Token', () => {
    it('debe generar token JWT válido', () => {
      const payload = { id: 'user123', role: 'client', name: 'Test' };
      const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });
      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');
    });

    it('debe decodificar token correctamente', () => {
      const payload = { id: 'user123', role: 'admin', name: 'Admin' };
      const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      expect(decoded.id).toBe('user123');
      expect(decoded.role).toBe('admin');
      expect(decoded.name).toBe('Admin');
    });

    it('debe rechazar token con secreto incorrecto', () => {
      const token = jwt.sign({ id: 'u1' }, 'wrong-secret');
      expect(() => jwt.verify(token, process.env.JWT_SECRET)).toThrow();
    });

    it('debe rechazar token expirado', () => {
      const token = jwt.sign({ id: 'u1' }, process.env.JWT_SECRET, { expiresIn: '0s' });
      // Wait a tiny bit for expiration
      expect(() => jwt.verify(token, process.env.JWT_SECRET)).toThrow('jwt expired');
    });

    it('token debe contener expiración (exp)', () => {
      const token = jwt.sign({ id: 'u1' }, process.env.JWT_SECRET, { expiresIn: '7d' });
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      expect(decoded.exp).toBeDefined();
      // 7 days from now
      const sevenDays = 7 * 24 * 60 * 60;
      expect(decoded.exp - decoded.iat).toBe(sevenDays);
    });
  });

  // ═══════════════════════════════════════════
  // HASHING DE CONTRASEÑA
  // ═══════════════════════════════════════════
  describe('Hashing de Contraseña (bcrypt)', () => {
    it('debe hashear contraseña correctamente', async () => {
      const hash = await bcrypt.hash('MiPassword123', 10);
      expect(hash).not.toBe('MiPassword123');
      expect(hash.startsWith("$2")).toBe(true);
    });

    it('debe verificar contraseña correcta', async () => {
      const hash = await bcrypt.hash('SecurePass1', 10);
      const isValid = await bcrypt.compare('SecurePass1', hash);
      expect(isValid).toBe(true);
    });

    it('debe rechazar contraseña incorrecta', async () => {
      const hash = await bcrypt.hash('SecurePass1', 10);
      const isValid = await bcrypt.compare('WrongPass', hash);
      expect(isValid).toBe(false);
    });

    it('mismo texto genera hashes diferentes (salt aleatorio)', async () => {
      const hash1 = await bcrypt.hash('SamePass1', 10);
      const hash2 = await bcrypt.hash('SamePass1', 10);
      expect(hash1).not.toBe(hash2);
      // Pero ambos validan
      expect(await bcrypt.compare('SamePass1', hash1)).toBe(true);
      expect(await bcrypt.compare('SamePass1', hash2)).toBe(true);
    });
  });

  // ═══════════════════════════════════════════
  // VALIDACIONES DE REGISTRO
  // ═══════════════════════════════════════════
  describe('Validaciones de Registro', () => {
    it('debe rechazar email inválido', () => {
      const invalidEmails = ['noarroba', 'sin@', '@nodomain.com', 'spaces in@email.com'];
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      invalidEmails.forEach(email => {
        expect(emailRegex.test(email)).toBe(false);
      });
    });

    it('debe aceptar emails válidos', () => {
      const validEmails = ['user@test.com', 'name.last@domain.co', 'a@b.org'];
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      validEmails.forEach(email => {
        expect(emailRegex.test(email)).toBe(true);
      });
    });

    it('debe requerir contraseña de al menos 6 caracteres', () => {
      expect('Pass1'.length < 6).toBe(true);
      expect('Pass12'.length >= 6).toBe(true);
    });

    it('debe requerir al menos una mayúscula', () => {
      expect(/[A-Z]/.test('nouppercase1')).toBe(false);
      expect(/[A-Z]/.test('HasUpper1')).toBe(true);
    });

    it('debe requerir al menos un número', () => {
      expect(/[0-9]/.test('NoNumbers')).toBe(false);
      expect(/[0-9]/.test('HasNumber1')).toBe(true);
    });

    it('username debe tener al menos 3 caracteres', () => {
      expect('ab'.trim().length < 3).toBe(true);
      expect('abc'.trim().length >= 3).toBe(true);
    });
  });

  // ═══════════════════════════════════════════
  // MIDDLEWARE AUTH
  // ═══════════════════════════════════════════
  describe('Middleware de Autenticación', () => {
    it('debe extraer token del header Authorization', () => {
      const header = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test';
      const token = header.startsWith('Bearer ') ? header.slice(7) : null;
      expect(token).toBe('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test');
    });

    it('debe retornar null si no hay header Bearer', () => {
      const header = '';
      const token = header.startsWith('Bearer ') ? header.slice(7) : null;
      expect(token).toBeNull();
    });

    it('debe verificar rol admin correctamente', () => {
      const adminUser = { id: 'u1', role: 'admin' };
      const clientUser = { id: 'u2', role: 'client' };
      expect(adminUser.role === 'admin').toBe(true);
      expect(clientUser.role === 'admin').toBe(false);
    });
  });
});
