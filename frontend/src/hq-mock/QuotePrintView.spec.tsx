import { describe,it,expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { QuotePrintView } from './QuotePrintView';
describe('견적 인쇄 미리보기',()=>{it('견적 제품과 합계를 안전한 텍스트로 표시한다',()=>{const html=renderToStaticMarkup(<QuotePrintView quote={{name:'<견적>',currency:'KRW',subtotal:100000,tax:3000,shipping:2000,total:105000,lines:[{item_name:'임플란트',quantity:1,proposed_unit_price:100000,amount:100000}]}}/>);expect(html).toContain('&lt;견적&gt;');expect(html).toContain('임플란트');expect(html).toContain('105,000');});});
