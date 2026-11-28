import {hqAssert} from './model.js';
export const opportunityProductInfoKeys=['productAmount','goodsAmount','surchargeRate','discountRate','description'];
/** Independent observed metadata: percentages do not change quantity × package price. Bounds are local input safeguards. */
export function opportunityProductInfo(input:Record<string,unknown>){
 const out:Record<string,unknown>={};
 for(const key of opportunityProductInfoKeys){if(input[key]===undefined)continue;const value=input[key];if(key==='description'){hqAssert(typeof value==='string'&&value.length<=4000,400,'PRODUCT_DESCRIPTION_INVALID');out.description=value;}
 else{const max=key==='surchargeRate'||key==='discountRate'?100:1e12;hqAssert(typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=max,400,'PRODUCT_METADATA_INVALID',key);out[key.replace(/[A-Z]/g,x=>`_${x.toLowerCase()}`)]=value;}}
 return out;
}
