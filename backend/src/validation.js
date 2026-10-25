import { z } from 'zod';

export const generationRequest = z.object({
  premise: z.string().trim().min(20).max(2000),
  title: z.string().trim().max(100).optional().default(''),
  type: z.string().trim().min(2).max(60).optional().default('General Mystery'),
  difficulty: z.enum(['Easy', 'Medium', 'Hard']).default('Medium'),
  suspectCount: z.coerce.number().int().min(3).max(6).default(4),
  evidenceComplexity: z.string().optional().default('Standard')
});

const str = z.string().min(1);
export const generatedMysterySchema = z.object({
  title: str, description: str,
  victim: z.object({ name: str, description: str }),
  incident: z.object({ location: str, date: str, time: str, description: str }),
  suspects: z.array(z.object({ id: str, name: str, age: z.number(), occupation: str,
    relationshipToIncident: str, background: str, motive: str, alibi: str, personality: str,
    secrets: z.array(str).max(10), suspicionLevel: z.enum(['low', 'medium', 'high']) })).max(6),
  evidence: z.array(z.object({ id: str, type: z.enum(['chat', 'image', 'cctv', 'document', 'witness_statement']),
    title: str, description: str, content: z.unknown(), relatedSuspectIds: z.array(str),
    relatedEvidenceIds: z.array(str).max(20), clueImportance: z.enum(['critical', 'supporting', 'red_herring', 'neutral']) })).max(20),
  timeline: z.array(z.object({ time: str, event: str, suspectIds: z.array(str).max(6), evidenceIds: z.array(str).max(20) })).max(40),
  solution: z.object({ culpritId: str, motive: str, explanation: str, deduction: str,
    evidenceIds: z.array(str).min(3).max(20), redHerrings: z.array(z.object({ evidenceId: str, explanation: str })).max(20) })
});

export function validateConsistency(data, requestedSuspects, difficulty) {
  const ids = data.suspects.map(s => s.id);
  const evidenceIds = data.evidence.map(e => e.id);
  if (ids.length !== requestedSuspects || new Set(ids).size !== ids.length) throw new Error('The generated suspect list did not match the requested count.');
  if (new Set(evidenceIds).size !== evidenceIds.length) throw new Error('The generated evidence contains duplicate identifiers.');
  if (!ids.includes(data.solution.culpritId)) throw new Error('The generated culprit does not match a suspect.');
  if (data.evidence.length < ({ Easy: 6, Medium: 8, Hard: 10 }[difficulty])) throw new Error('The generated case does not contain enough evidence.');
  const allSuspects = new Set(ids), allEvidence = new Set(evidenceIds);
  for (const item of data.evidence) {
    if (item.relatedSuspectIds.some(id => !allSuspects.has(id))) throw new Error('Evidence references an unknown suspect.');
    if (item.relatedEvidenceIds.some(id => !allEvidence.has(id))) throw new Error('Evidence references an unknown item.');
  }
  if (data.solution.evidenceIds.length < 3 || data.solution.evidenceIds.some(id => !allEvidence.has(id))) throw new Error('The solution must connect at least three valid evidence items.');
  const eliminatingClues = data.evidence.filter(item =>
    ['critical', 'supporting'].includes(item.clueImportance) &&
    item.relatedSuspectIds.some(id => id !== data.solution.culpritId)
  );
  if (eliminatingClues.length < 2) throw new Error('The case must include evidence that questions at least two non-culprit suspects.');
  if (data.solution.redHerrings.some(item => !allEvidence.has(item.evidenceId))) throw new Error('The solution references an unknown red herring.');
  if (data.timeline.some(item => item.evidenceIds.some(id => !allEvidence.has(id)) || item.suspectIds.some(id => !allSuspects.has(id)))) throw new Error('The timeline references unknown case details.');
  return data;
}
