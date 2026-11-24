import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
vi.mock('@tanstack/react-query', () => ({ useQuery: ({queryKey}: {queryKey:string[]}) => ({ data: queryKey[1] === 'opportunities' ? [{public_id:'a',opportunity_name:'기회 하나',account_name:'거래처 A',stage:'PROPOSAL',amount:120,version:1,currency:'USD'}] : queryKey[1] === 'contracts' ? [{public_id:'c',contract_name:'달러 계약',account_name:'거래처 A',status:'DRAFT',contract_amount:1000,currency:'USD'}] : queryKey[1] === 'pipeline' ? { byStage: [{stage:'PROPOSAL',currency:'USD',amount:120,opportunity_count:1},{stage:'PROPOSAL',currency:'KRW',amount:1000,opportunity_count:1}], forecast: [] } : queryKey[1] === 'contract-details' ? undefined : [], isPending:false, refetch:vi.fn() }), useQueryClient: () => ({invalidateQueries:vi.fn()}) }));
vi.mock('react-router-dom', () => ({ useSearchParams: () => [new URLSearchParams(),vi.fn()] }));
vi.mock('./HqMockProvider', () => ({ useHqMock: () => ({session:{user:{userId:1,permissions:['OPPORTUNITY.WRITE']}}}) }));
vi.mock('../market/globalization-context', () => ({useGlobalization:()=>({globalization:{locale:'ko-KR',currencyCode:'KRW'}})}));
import { HqOpportunitiesPage, HqPipelineView, HqContractsPage } from './HqSalesPages';
it('opens a searchable opportunity list without selecting the first record', () => {
  const html=renderToStaticMarkup(<HqOpportunitiesPage />);
  expect(html).toContain('기회 하나');
  expect(html).toContain('기회 검색');
  expect(html).toContain('기회 등록');
  expect(html).not.toContain('기회 생성</h2>');
  expect(html).not.toContain('저장된 단계:');
  expect(html).toContain('USD');
});
it('renders each mock contract in its own currency', () => {
  const html=renderToStaticMarkup(<HqContractsPage />);
  expect(html).toContain('달러 계약'); expect(html).toContain('US$');
});
it('separates pipeline currencies and does not show unapproved weighted forecasts', () => {
  const html=renderToStaticMarkup(<HqPipelineView />);
  expect(html).toContain('PROPOSAL · USD'); expect(html).toContain('PROPOSAL · KRW'); expect(html).not.toContain('가중 금액');
});
