import { z } from 'zod';

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const date = new Date(value + 'T00:00:00Z');
  return Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === value;
});
const localTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/).refine(value => {
  const date = new Date(value + ':00Z');
  return Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 16) === value;
});
const common = { subject: z.string().trim().min(1).max(200), note: z.string().max(4000) };
const task = z.object({kind:z.literal('TASK'), ...common, dueDate:day, status:z.enum(['OPEN','COMPLETED']), priority:z.enum(['NORMAL','HIGH'])}).strict();
const call = z.object({kind:z.literal('CALL'), ...common, calledAt:localTime}).strict();
const event = z.object({kind:z.literal('EVENT'), ...common, startAt:localTime, endAt:localTime}).strict().refine(value=>value.endAt>=value.startAt, {message:'End must not precede start'});
const schema=z.union([task,call,event]);
export type LeadTimelineInput=z.infer<typeof schema>;
export function parseLeadTimelineInput(input: unknown): LeadTimelineInput {
  return schema.parse(input);
}
