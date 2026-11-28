import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LeadMobileCards } from './LeadMobileCards';

describe('LeadMobileCards', () => {
  it('shows accessible lead identity, owner and status without initiating calls', () => {
    const html = renderToStaticMarkup(<LeadMobileCards rows={[{ public_id: 'test-id', version: 1, hospital_name: '시험병원', keyman_name: '시험담당', owner_name: '시험영업', status: 'NEW', phone: '010-0000-1234' }]} onOpen={() => {}} statusLabel={() => '신규등록'} />);
    expect(html).toContain('시험병원');
    expect(html).toContain('시험담당');
    expect(html).toContain('시험영업');
    expect(html).toContain('신규등록');
    expect(html).toContain('tel:010-0000-1234');
    expect(html).toContain('data-lead-id="test-id"');
  });
});
