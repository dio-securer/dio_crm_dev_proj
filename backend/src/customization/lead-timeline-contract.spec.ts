import { parseLeadTimelineInput } from './lead-timeline-contract';

describe('lead timeline input', () => {
  it('accepts a task with valid date, status and priority', () => {
    expect(parseLeadTimelineInput({kind:'TASK',subject:'시험',note:'메모',dueDate:'2026-11-21',status:'OPEN',priority:'HIGH'})).toMatchObject({kind:'TASK',dueDate:'2026-11-21',priority:'HIGH'});
  });
  it('rejects an impossible task due date', () => {
    expect(() => parseLeadTimelineInput({kind:'TASK',subject:'시험',note:'',dueDate:'2026-02-30',status:'OPEN',priority:'NORMAL'})).toThrow();
  });
  it('rejects an event whose end precedes its start', () => {
    expect(() => parseLeadTimelineInput({kind:'EVENT',subject:'시험',note:'',startAt:'2026-11-21T11:00',endAt:'2026-11-21T10:00'})).toThrow();
  });
  it('accepts a call without task-only fields and rejects unrelated fields', () => {
    expect(parseLeadTimelineInput({kind:'CALL',subject:'통화',note:'기록',calledAt:'2026-11-21T10:00'}).kind).toBe('CALL');
    expect(() => parseLeadTimelineInput({kind:'CALL',subject:'통화',note:'',calledAt:'2026-11-21T10:00',priority:'HIGH'})).toThrow();
  });
});
