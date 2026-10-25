import mongoose from 'mongoose';

const suspectSchema = new mongoose.Schema({
  id: { type: String, required: true }, name: String, age: Number, occupation: String,
  profileImageUrl: { type: String, default: '' }, relationshipToIncident: String,
  background: String, motive: String, alibi: String, personality: String,
  secrets: [String], suspicionLevel: String
}, { _id: false });

const evidenceSchema = new mongoose.Schema({
  id: { type: String, required: true }, type: String, title: String, description: String,
  content: { type: mongoose.Schema.Types.Mixed }, mediaUrl: { type: String, default: '' },
  relatedSuspectIds: [String], relatedEvidenceIds: [String], clueImportance: String
}, { _id: false });

const mysterySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  title: { type: String, required: true }, premise: { type: String, required: true },
  description: String, type: String, difficulty: String,
  victim: { name: String, description: String },
  incident: { location: String, date: String, time: String, description: String },
  suspects: [suspectSchema], evidence: [evidenceSchema],
  timeline: [{ time: String, event: String, suspectIds: [String], evidenceIds: [String] }],
  solution: { culpritId: String, motive: String, explanation: String, deduction: String,
    evidenceIds: [String], redHerrings: [{ evidenceId: String, explanation: String }] }
}, { timestamps: true });

const investigationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  mysteryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Mystery', required: true },
  reviewedEvidenceIds: [String], notes: { type: String, default: '' },
  selectedSuspectId: String, accusationAttempts: [{ suspectId: String, correct: Boolean, submittedAt: Date }],
  status: { type: String, enum: ['investigating', 'accused', 'completed'], default: 'investigating' },
  result: { type: String, enum: ['correct', 'incorrect', null], default: null },
  solutionRevealed: { type: Boolean, default: false }
}, { timestamps: true });

const userSchema = new mongoose.Schema({
  name: { type: String, required: true }, email: { type: String, required: true, unique: true, lowercase: true },
  passwordHash: { type: String, required: true }
}, { timestamps: true });

export const Mystery = mongoose.model('Mystery', mysterySchema);
export const Investigation = mongoose.model('Investigation', investigationSchema);
export const User = mongoose.model('User', userSchema);
