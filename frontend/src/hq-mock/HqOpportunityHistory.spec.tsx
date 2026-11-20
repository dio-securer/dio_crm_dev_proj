import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe,it,expect} from 'vitest';
import {HqOpportunityHistory} from './HqOpportunityHistory';
describe('기회 변경 이력',()=>{
 it('빈 값, 0, 줄바꿈을 구분하고 변경 전후를 표시한다',()=>{const html=renderToStaticMarkup(<HqOpportunityHistory history={[{action:'INFORMATION_UPDATED',at:'2026-11-10',changes:[{field:'description',before:null,after:'설명\n다음 줄'},{field:'success_probability',before:0,after:35},{field:'stock_status',before:'재고 10',after:''}]}]}/>);expect(html).toContain('설명');expect(html).toContain('변경 전');expect(html).toContain('변경 후');expect(html).toContain('비어 있음');expect(html).toContain('>0<');expect(html).toContain('성공 확률');expect(html).toContain('재고 상황');expect(html).not.toContain('undefined');});
 it('단계, 가격목록, 사유를 사람이 읽을 수 있게 표시한다',()=>{const html=renderToStaticMarkup(<HqOpportunityHistory history={[{from:'NEEDS_ANALYSIS',to:'PROPOSAL',reason:'상담 완료'},{action:'PRICE_LIST_CHANGED',from:'ERP_STANDARD',to:'CUSTOM_QUOTE'}]}/>);expect(html).toContain('니즈파악');expect(html).toContain('제안');expect(html).toContain('상담 완료');expect(html).toContain('가격 목록 변경');expect(html).toContain('ERP 표준가격');});
 it('이력이 없음을 명확히 알리고 입력된 HTML을 실행하지 않는다',()=>{expect(renderToStaticMarkup(<HqOpportunityHistory history={[]}/>)).toContain('변경 이력이 없습니다');const html=renderToStaticMarkup(<HqOpportunityHistory history={[{changes:[{field:'description',before:null,after:'<script>alert(1)</script>'}]}]}/>);expect(html).toContain('&lt;script&gt;');expect(html).not.toContain('<script>');});
});
