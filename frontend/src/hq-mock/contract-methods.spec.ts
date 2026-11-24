import {it,expect} from 'vitest';
import {collectionMethods} from './contract-methods';
it('샌드박스에서 확인한 수금 수단을 제공한다',()=>{expect(collectionMethods).toContain('CMS자동이체');expect(collectionMethods).toContain('현금 일시불');expect(new Set(collectionMethods).size).toBe(collectionMethods.length)});
