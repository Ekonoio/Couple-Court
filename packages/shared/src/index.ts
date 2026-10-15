import { z } from 'zod'

export const sideSchema = z.enum(['A', 'B'])
export type Side = z.infer<typeof sideSchema>
export const modeSchema = z.enum(['remote', 'same_device', 'solo'])
export type Mode = z.infer<typeof modeSchema>
const shortText = z.string().trim().max(2000)
export const basicsSchema = z.object({ title: z.string().trim().min(1).max(80), cause: shortText.min(1), course: shortText.min(1), outcome: shortText }).strict()
export type Basics = z.infer<typeof basicsSchema>
export const statementSchema = z.object({ why: shortText, happened: shortText.min(1), disagreement: shortText, discomfort: shortText, ownFault: shortText, resolution: shortText }).strict()
export type Statement = z.infer<typeof statementSchema>
export const evidenceSubmissionSchema = z.object({ id: z.string().uuid(), left: sideSchema, right: sideSchema, note: z.string().trim().max(200) }).strict().refine(v => v.left !== v.right, '左右人物不能相同')
export const submitSchema = z.object({ statement: statementSchema, evidence: z.array(evidenceSubmissionSchema).max(6) }).strict()
export type Submission = z.infer<typeof submitSchema>
export interface Evidence { id: string; owner: Side; left: Side; right: Side; note: string; position: number }
export interface Material { basics: Basics; mode: Mode; statements: { A: Statement; B?: Statement }; evidence: Evidence[] }
export interface RuleConfig {
 version: string; name: string; dimensions: { id: string; name: string; description: string }[];
 scale: { score: number; label: string }[]; maxScore: number; closeGap: number; lowTotal: number;
 evidenceRules: string[]; antiDoubleCount: string; safety: string;
}
export const findingSchema = z.object({ text: z.string().min(1).max(2000), refs: z.array(z.string().max(100)).min(1).max(20) }).strict()
const gradeSchema = z.object({ score: z.number().int().min(0).max(5).nullable(), reason: z.string().min(1).max(2000), refs: z.array(z.string().max(100)).min(1).max(20), behaviorIds: z.array(z.string().max(100)).max(20) }).strict()
export const judgeOutputSchema = z.object({
 facts: z.array(z.object({ category: z.enum(['agreed','supported','unilateral','disputed','unknown']), text: z.string().min(1).max(2000), refs: z.array(z.string()).min(1).max(20) }).strict()).min(1).max(40),
 dimensions: z.array(z.object({ id: z.string(), A: gradeSchema, B: gradeSchema }).strict()).min(1).max(20),
 reasoning: z.array(findingSchema).min(1).max(20),
 reasonable: z.object({ A: z.array(findingSchema).max(20), B: z.array(findingSchema).max(20) }).strict(),
 uncertainties: z.array(findingSchema).max(20),
 suggestions: z.object({ A: z.array(z.string().min(1).max(1000)).min(1).max(10), B: z.array(z.string().min(1).max(1000)).min(1).max(10) }).strict(),
 keyFactsSufficient: z.boolean(),
 seriousFaults: z.array(findingSchema).max(10),
 safety: z.object({ detected: z.boolean(), message: z.string().max(2000), refs: z.array(z.string()).max(20) }).strict()
}).strict()
export type JudgeOutput = z.infer<typeof judgeOutputSchema>
export function schemaForRules(maxScore:number){
 const grade=gradeSchema.extend({score:z.number().int().min(0).max(maxScore).nullable()})
 return judgeOutputSchema.extend({dimensions:z.array(z.object({id:z.string(),A:grade,B:grade}).strict()).min(1).max(20)})
}
export type Verdict = 'A' | 'B' | 'close' | 'none' | 'insufficient' | 'safety'
export const verdictLabels: Record<Verdict, string> = { A:'本次争执，主要过错偏向甲方', B:'本次争执，主要过错偏向乙方', close:'双方过错程度接近', none:'暂无明显过错', insufficient:'证据不足，无法确定主要过错方', safety:'优先关注人身安全，暂停责任评分' }
export interface Judgment {
 id: string; output: JudgeOutput; totals: { A: number | null; B: number | null }; verdict: Verdict;
 rules: RuleConfig; model: string; provider: string; promptVersion: string; mock: boolean;
 durationMs: number; usage: { input: number; output: number } | null; estimatedCost: number | null;
 createdAt: string; limitation: string | null;
 rawOutput: unknown;
}
export interface CaseView {
 id: string; basics: Basics; mode: Mode; role: Side; status: 'collecting'|'ready'|'judging'|'judged';
 submitted: Record<Side,boolean>; statements: Partial<Record<Side,Statement>>;
 evidence: Evidence[]; judgment: Judgment | null; createdAt: string; expiresAt: string;
}
export interface Credential { caseId: string; token: string; role: Side }
export interface Fixture { id: string; title: string; description: string; material: Material; expected: Verdict; mockOutput: JudgeOutput }
