import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ permissions: ['ACTIVITY.WRITE'] as string[], items: [] as any[], screen: 'browse', selected: '', error: false, detail: undefined as any }));
vi.mock('react', async importOriginal => {
  const actual = await importOriginal<typeof import('react')>();
  return { ...actual, useState: (initial: unknown) => actual.useState(initial === 'browse' ? state.screen : initial === '' && state.selected ? state.selected : initial) };
});
vi.mock('@tanstack/react-query', () => ({ useQuery: ({ queryKey }: { queryKey: string[] }) => queryKey[0] === 'hq-activities-list' ? { data: state.items, isError: state.error, error: new Error('list failed'), refetch: vi.fn() } : queryKey[0] === 'hq-activity-detail' ? { data: state.detail, refetch: vi.fn() } : { data: [], refetch: vi.fn() }, useQueryClient: () => ({ invalidateQueries: vi.fn() }) }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('./HqMockProvider', () => ({ useHqMock: () => ({ session: { user: { userId: 1, permissions: state.permissions } } }) }));
import { HqActivitiesPage } from './HqActivityPages';

beforeEach(() => { state.permissions = ['ACTIVITY.WRITE']; state.items = []; state.screen = 'browse'; state.selected = ''; state.error = false; state.detail = undefined; });
it('opens a searchable list first and keeps registration behind a permission-gated entry', () => {
  state.items = [{ public_id: 'a', status: 'PLANNED', planned_at: '2026-01-02T09:00:00Z', related_name_snapshot: '병원 A', visit_purpose: '상담' }, { public_id: 'b', status: 'COMPLETED', planned_at: '2027-05-03T09:00:00Z', related_name_snapshot: '병원 B', visit_purpose: '점검' }];
  const html = renderToStaticMarkup(<MemoryRouter><HqActivitiesPage /></MemoryRouter>);
  for (const value of ['병원 A', '병원 B', '상담', '점검', 'hqActivity.searchActivities', 'hqActivity.statusFilter', 'hqActivity.openRegistration']) expect(html).toContain(value);
  expect(html).not.toContain('hqActivity.singlePlan');
  state.permissions = [];
  expect(renderToStaticMarkup(<MemoryRouter><HqActivitiesPage /></MemoryRouter>)).not.toContain('hqActivity.openRegistration');
});
it('shows registration with return and preserves the desktop bulk form', () => {
  state.screen = 'register';
  const html = renderToStaticMarkup(<MemoryRouter><HqActivitiesPage /></MemoryRouter>);
  expect(html).toContain('hqActivity.singlePlan');
  expect(html).toContain('hqActivity.bulkPlan');
  expect(html).toContain('hqActivity.backToList');
});
it('shows list errors without an empty-result claim', () => {
  state.error = true;
  const html = renderToStaticMarkup(<MemoryRouter><HqActivitiesPage /></MemoryRouter>);
  expect(html).toContain('list failed');
  expect(html).not.toContain('hqActivity.noActivities');
});
it('keeps a selected activity visible from its detail query when it no longer matches the list', () => {
  state.screen = 'detail'; state.selected = 'a'; state.items = [];
  state.detail = { public_id: 'a', status: 'IN_PROGRESS', owner_user_id: 1, related_name_snapshot: '병원 A' };
  const html = renderToStaticMarkup(<MemoryRouter><HqActivitiesPage /></MemoryRouter>);
  expect(html).toContain('SCR-ACT-002');
  expect(html).toContain('병원 A');
});
it('offers completed activity users with report permission a link to reports', () => {
  state.screen = 'detail'; state.selected = 'a'; state.permissions = ['ACTIVITY.REPORT'];
  state.detail = { public_id: 'a', status: 'COMPLETED', owner_user_id: 1, related_name_snapshot: '병원 A', consultation_content: '완료 상담' };
  const html = renderToStaticMarkup(<MemoryRouter><HqActivitiesPage /></MemoryRouter>);
  expect(html).toContain('완료 상담');
  expect(html).toContain('href="/activity-reports"');
  state.permissions = [];
  expect(renderToStaticMarkup(<MemoryRouter><HqActivitiesPage /></MemoryRouter>)).not.toContain('href="/activity-reports"');
});
