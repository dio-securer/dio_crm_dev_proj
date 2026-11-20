import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {expect,it} from 'vitest';
import {ContractObservedFields} from './ContractObservedFields';
it('표시 권한이 없는 금액을 0으로 추정하지 않는다',()=>{const html=renderToStaticMarkup(<ContractObservedFields row={{contract_date:'2026-11-10',product_amount:0,goods_amount:null,special_terms:'합성 특약'}} money={v=>`${v}원`}/>);expect(html).toContain('0원');expect(html).toContain('확인 불가');expect(html).toContain('합성 특약');});
