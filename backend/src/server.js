import dotenv from 'dotenv';
import express from 'express';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { Mystery, Investigation, User } from './models.js';
import { generateMystery } from './gemini.js';
import { generationRequest } from './validation.js';

dotenv.config({ path: new URL('../../.env', import.meta.url) });

const app = express();
const generationLocks = new Set();
app.use(express.json({ limit: '1mb' }));

function auth(req, _res, next) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) return next();
  try { req.user = jwt.verify(token, process.env.JWT_SECRET); } catch { return next(Object.assign(new Error('Your session has expired. Please sign in again.'), { status: 401 })); }
  next();
}
app.use(auth);
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const cleanSuspect = ({ id, name, age, occupation, profileImageUrl, relationshipToIncident, background, motive, alibi, personality, secrets, suspicionLevel }) => ({ id, name, age, occupation, profileImageUrl, relationshipToIncident, background, motive, alibi, personality, secrets, suspicionLevel });
function publicMystery(mystery) {
  const m = mystery.toObject ? mystery.toObject() : mystery;
  return { id: String(m._id), title: m.title, premise: m.premise, description: m.description, type: m.type, difficulty: m.difficulty,
    victim: m.victim, incident: m.incident, suspects: m.suspects.map(cleanSuspect),
    evidence: m.evidence.map(({ clueImportance, ...item }) => item), timeline: m.timeline, createdAt: m.createdAt };
}
async function ownedInvestigation(req) {
  if (!mongoose.isValidObjectId(req.params.id)) throw Object.assign(new Error('Investigation not found.'), { status: 404 });
  const investigation = await Investigation.findById(req.params.id);
  if (!investigation || (investigation.userId && String(investigation.userId) !== req.user?.id)) throw Object.assign(new Error('Investigation not found.'), { status: 404 });
  return investigation;
}
async function investigationPayload(investigation) {
  const mystery = await Mystery.findById(investigation.mysteryId);
  if (!mystery) throw Object.assign(new Error('Case file not found.'), { status: 404 });
  return { investigation: { id: String(investigation._id), mysteryId: String(mystery._id), notes: investigation.notes,
    reviewedEvidenceIds: investigation.reviewedEvidenceIds, status: investigation.status, result: investigation.result,
    attempts: investigation.accusationAttempts.length, solutionRevealed: investigation.solutionRevealed }, mystery: publicMystery(mystery),
    solution: investigation.solutionRevealed ? mystery.solution : undefined };
}

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'AI Mystery Room' }));

app.post('/api/auth/register', wrap(async (req, res) => {
  const body = z.object({ name: z.string().trim().min(2).max(80), email: z.string().email().max(200), password: z.string().min(8).max(100) }).parse(req.body);
  const email = body.email.toLowerCase();
  if (await User.exists({ email })) return res.status(409).json({ error: 'An account with that email already exists.' });
  const user = await User.create({ name: body.name, email, passwordHash: await bcrypt.hash(body.password, 12) });
  const token = jwt.sign({ id: String(user._id) }, process.env.JWT_SECRET, { expiresIn: '7d' });
  res.status(201).json({ token, user: { id: String(user._id), name: user.name, email: user.email } });
}));
app.post('/api/auth/login', wrap(async (req, res) => {
  const body = z.object({ email: z.string().email(), password: z.string().min(1) }).parse(req.body);
  const user = await User.findOne({ email: body.email.toLowerCase() });
  if (!user || !(await bcrypt.compare(body.password, user.passwordHash))) return res.status(401).json({ error: 'Email or password is incorrect.' });
  const token = jwt.sign({ id: String(user._id) }, process.env.JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: String(user._id), name: user.name, email: user.email } });
}));
app.get('/api/auth/me', (req, res) => req.user ? res.json({ user: req.user }) : res.status(401).json({ error: 'Sign in to continue.' }));

app.get('/api/mysteries', wrap(async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Sign in to view saved mysteries.' });
  const mysteries = await Mystery.find({ userId: req.user.id }).sort({ updatedAt: -1 });
  res.json({ mysteries: mysteries.map(m => ({ id: String(m._id), title: m.title, description: m.description, difficulty: m.difficulty, createdAt: m.createdAt })) });
}));
app.get('/api/mysteries/:id', wrap(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw Object.assign(new Error('Mystery not found.'), { status: 404 });
  const mystery = await Mystery.findById(req.params.id);
  if (!mystery || (mystery.userId && String(mystery.userId) !== req.user?.id)) throw Object.assign(new Error('Mystery not found.'), { status: 404 });
  res.json({ mystery: publicMystery(mystery) });
}));
app.post('/api/mysteries/generate', wrap(async (req, res) => {
  const input = generationRequest.parse(req.body);
  const lock = req.user?.id || req.ip;
  if (generationLocks.has(lock)) throw Object.assign(new Error('A case is already being generated for this session.'), { status: 409 });
  generationLocks.add(lock);
  try {
    const data = await generateMystery(input);
    const mystery = await Mystery.create({ ...data, title: input.title || data.title, premise: input.premise, type: input.type, difficulty: input.difficulty, userId: req.user?.id || null });
    const investigation = await Investigation.create({ mysteryId: mystery._id, userId: req.user?.id || null });
    res.status(201).json({ ...await investigationPayload(investigation), message: 'Your case file is ready.' });
  } finally { generationLocks.delete(lock); }
}));

app.get('/api/investigations', wrap(async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Sign in to view saved investigations.' });
  const rows = await Investigation.find({ userId: req.user.id }).sort({ updatedAt: -1 }).populate('mysteryId');
  res.json({ investigations: rows.filter(row => row.mysteryId).map(row => ({ id: String(row._id), title: row.mysteryId.title,
    description: row.mysteryId.description, difficulty: row.mysteryId.difficulty, status: row.status, result: row.result, updatedAt: row.updatedAt })) });
}));
app.get('/api/investigations/:id', wrap(async (req, res) => res.json(await investigationPayload(await ownedInvestigation(req)))));
app.patch('/api/investigations/:id/notes', wrap(async (req, res) => {
  const { notes } = z.object({ notes: z.string().max(10000) }).parse(req.body);
  const row = await ownedInvestigation(req); row.notes = notes; await row.save(); res.json({ notes: row.notes });
}));
app.patch('/api/investigations/:id/evidence/:evidenceId', wrap(async (req, res) => {
  const row = await ownedInvestigation(req); const mystery = await Mystery.findById(row.mysteryId);
  if (!mystery?.evidence.some(item => item.id === req.params.evidenceId)) throw Object.assign(new Error('Evidence item not found.'), { status: 404 });
  if (!row.reviewedEvidenceIds.includes(req.params.evidenceId)) row.reviewedEvidenceIds.push(req.params.evidenceId);
  await row.save(); res.json({ reviewedEvidenceIds: row.reviewedEvidenceIds });
}));
app.post('/api/investigations/:id/accusation', wrap(async (req, res) => {
  const { suspectId } = z.object({ suspectId: z.string().min(1) }).parse(req.body);
  const row = await ownedInvestigation(req); const mystery = await Mystery.findById(row.mysteryId);
  if (row.status === 'completed') throw Object.assign(new Error('This case is already closed.'), { status: 409 });
  if (!mystery.suspects.some(suspect => suspect.id === suspectId)) throw Object.assign(new Error('Choose a suspect from this case.'), { status: 400 });
  const correct = mystery.solution.culpritId === suspectId;
  row.selectedSuspectId = suspectId; row.result = correct ? 'correct' : 'incorrect';
  row.status = correct ? 'completed' : 'investigating'; row.solutionRevealed = correct;
  row.accusationAttempts.push({ suspectId, correct, submittedAt: new Date() }); await row.save();
  res.json({ correct, selectedSuspectId: suspectId, status: row.status,
    message: correct ? 'Your deduction is correct.' : 'That accusation does not fit the evidence. You can keep investigating or reveal the solution.',
    solutionRevealed: row.solutionRevealed, ...(correct ? { solution: mystery.solution } : {}) });
}));
app.post('/api/investigations/:id/reveal-solution', wrap(async (req, res) => {
  const row = await ownedInvestigation(req);
  if (!row.accusationAttempts.length) return res.status(403).json({ error: 'Submit an accusation before revealing the solution.' });
  row.solutionRevealed = true; row.status = 'completed'; await row.save();
  const mystery = await Mystery.findById(row.mysteryId); res.json({ solution: mystery.solution });
}));
app.delete('/api/investigations/:id', wrap(async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Sign in to delete saved investigations.' });
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Investigation not found.' });
  const row = await Investigation.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
  if (row) await Mystery.findOneAndDelete({ _id: row.mysteryId, userId: req.user.id });
  res.status(row ? 204 : 404).end();
}));

if (process.env.NODE_ENV === 'production') {
  const frontendDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../frontend/dist');
  app.use(express.static(frontendDist));
  app.get(/^(?!\/api(?:\/|$)).*/, (req, res, next) => {
    if (req.method !== 'GET') return next();
    res.sendFile(path.join(frontendDist, 'index.html'), error => error && next(error));
  });
}

app.use((err, _req, res, _next) => {
  const status = err.status || (err.name === 'ZodError' ? 400 : 500);
  const message = err.name === 'ZodError' ? err.issues?.[0]?.message || 'Invalid request.' : err.message || 'Something went wrong.';
  if (status >= 500) console.error(err);
  res.status(status).json({ error: message });
});

const port = Number(process.env.PORT || 5000);
if (process.env.NODE_ENV === 'production') {
  const missing = ['MONGODB_URI', 'GEMINI_API_KEY', 'JWT_SECRET'].filter(key => !process.env[key]);
  if (missing.length) throw new Error(`Missing required production environment variables: ${missing.join(', ')}`);
}
await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/ai-mystery-room');
app.listen(port, '0.0.0.0', () => console.log(`AI Mystery Room API listening on ${port}`));
