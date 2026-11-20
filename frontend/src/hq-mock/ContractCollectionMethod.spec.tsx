import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { ContractCollectionMethod } from './ContractCollectionMethod';

it('offers Salesforce methods and preserves a legacy selected method', () => {
  const html = renderToStaticMarkup(<ContractCollectionMethod value="BANK_TRANSFER" onChange={() => {}} />);
  expect(html).toContain('<select');
  expect(html).toContain('현금 일시불');
  expect(html).toContain('CMS자동이체');
  expect(html).toContain('BANK_TRANSFER');
});
