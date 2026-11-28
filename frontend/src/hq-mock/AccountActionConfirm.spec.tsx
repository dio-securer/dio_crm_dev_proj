import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {expect,it} from 'vitest';
import {AccountActionConfirm} from './AccountActionConfirm';
it('names the destructive action and disables both actions while pending',()=>{
 const html=renderToStaticMarkup(<AccountActionConfirm title="공유 해제" message="테스트 사용자" confirmLabel="공유 해제 확인" busy onConfirm={()=>{}} onCancel={()=>{}}/>);
 expect(html).toContain('role="alertdialog"');expect(html).toContain('공유 해제');expect(html).toContain('테스트 사용자');expect(html).toContain('처리 중');expect(html.match(/disabled=""/g)).toHaveLength(2);
});
it('renders a distinct confirmation and cancellation before mutation',()=>{
 const html=renderToStaticMarkup(<AccountActionConfirm title="파일 삭제" message="test.txt" confirmLabel="삭제 확인" busy={false} onConfirm={()=>{}} onCancel={()=>{}}/>);
 expect(html).toContain('삭제 확인');expect(html).toContain('취소');expect(html).not.toContain('disabled=""');
});
