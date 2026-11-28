import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ calendar: {} as Record<string, unknown>, permissions: ['ACTIVITY.WRITE'] as string[], view: 'day', selected: '', screen: 'browse' }));
vi.mock('react', async importOriginal => {
  const actual = await importOriginal<typeof import('react')>();
  return { ...actual, useState: (initial: unknown) => actual.useState(initial === 'list' ? state.view : initial === 'browse' ? state.screen : initial === 'activity-list' ? 'calendar' : initial === '' && state.selected ? state.selected : initial) };
});
vi.mock('@tanstack/react-query', () => ({
  useQuery: ({ queryKey }: { queryKey: string[] }) => queryKey[0] === 'hq-activity-calendar' ? state.calendar : queryKey[0] === 'hq-activity-detail' ? { ...state.calendar, data: (state.calendar.data as any[] | undefined)?.find(row => row.public_id === state.selected) } : { data: [] },
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('./HqMockProvider', () => ({ useHqMock: () => ({ session: { user: { userId: 1, permissions: state.permissions } } }) }));
import { HqActivitiesPage } from './HqActivityPages';

describe('activity schedule feedback', () => {
  beforeEach(() => { state.view = 'day'; state.screen = 'browse'; state.selected = ''; state.permissions = ['ACTIVITY.WRITE']; state.calendar = { data: [], isLoading: false, isError: false, refetch: vi.fn() }; });
  it('shows error and retry without claiming an empty result', () => {
    state.calendar = { isLoading: false, isError: true, error: new Error('network failed'), refetch: vi.fn() };
    const html = renderToStaticMarkup(<MemoryRouter><HqActivitiesPage /></MemoryRouter>);
    expect(html).toContain('network failed');
    expect(html).toContain('hqActivity.retryCalendar');
    expect(html).not.toContain('hqActivity.noDay');
  });
  it('shows loading without claiming an empty result', () => {
    state.calendar = { isLoading: true, isError: false, refetch: vi.fn() };
    const html = renderToStaticMarkup(<MemoryRouter><HqActivitiesPage /></MemoryRouter>);
    expect(html).toContain('common.loading');
    expect(html).not.toContain('hqActivity.noDay');
  });
  it('shows an empty result and mobile bulk guidance when loading succeeds', () => {
    const html = renderToStaticMarkup(<MemoryRouter><HqActivitiesPage /></MemoryRouter>);
    expect(html).toContain('hqActivity.noDay');
    state.screen = 'register';
    const registration = renderToStaticMarkup(<MemoryRouter><HqActivitiesPage /></MemoryRouter>);
    expect(registration).toContain('hqActivity.bulkPcOnly');
    expect(registration).toContain('hq-act-mobile-only');
  });
  it('does not offer registration guidance without write permission', () => {
    state.permissions = [];
    const html = renderToStaticMarkup(<MemoryRouter><HqActivitiesPage /></MemoryRouter>);
    expect(html).not.toContain('hqActivity.bulkPcOnly');
    expect(html).not.toContain('hqActivity.bulkPlan');
  });
  it('distinguishes a successful empty month from loading or failure', () => {
    state.view = 'month';
    const empty = renderToStaticMarkup(<MemoryRouter><HqActivitiesPage /></MemoryRouter>);
    expect(empty).toContain('hqActivity.noMonth');
    expect(empty).not.toContain('hqActivity.noDay');
    state.calendar = { isLoading: true, isError: false, refetch: vi.fn() };
    const loading = renderToStaticMarkup(<MemoryRouter><HqActivitiesPage /></MemoryRouter>);
    expect(loading).not.toContain('hq-act-month');
    state.calendar = { isLoading: false, isError: true, error: new Error('failed'), refetch: vi.fn() };
    const error = renderToStaticMarkup(<MemoryRouter><HqActivitiesPage /></MemoryRouter>);
    expect(error).not.toContain('hq-act-month');
    expect(error).not.toContain('hqActivity.noMonth');
  });
  it('hides previously selected details when a calendar refetch fails', () => {
    state.screen = 'detail';
    state.selected = 'old-id';
    state.calendar = { data: [{ public_id: 'old-id', status: 'PLANNED', owner_user_id: 1, related_name_snapshot: 'old record', target_latitude: 35 }], isLoading: false, isError: true, error: new Error('failed'), refetch: vi.fn() };
    const html = renderToStaticMarkup(<MemoryRouter><HqActivitiesPage /></MemoryRouter>);
    expect(html).not.toContain('SCR-ACT-002');
    expect(html).not.toContain('IN (GPS)');
    state.calendar = { ...state.calendar, isError: false, isFetching: true };
    expect(renderToStaticMarkup(<MemoryRouter><HqActivitiesPage /></MemoryRouter>)).not.toContain('SCR-ACT-002');
  });
  it('restores detail only if a successful refresh still includes the selected activity', () => {
    state.screen = 'detail';
    state.selected = 'old-id';
    state.calendar = { data: [{ public_id: 'old-id', status: 'PLANNED', owner_user_id: 1, related_name_snapshot: 'current record' }], isLoading: false, isFetching: false, isError: false, refetch: vi.fn() };
    expect(renderToStaticMarkup(<MemoryRouter><HqActivitiesPage /></MemoryRouter>)).toContain('SCR-ACT-002');
    state.calendar = { ...state.calendar, data: [] };
    expect(renderToStaticMarkup(<MemoryRouter><HqActivitiesPage /></MemoryRouter>)).not.toContain('SCR-ACT-002');
  });
});
