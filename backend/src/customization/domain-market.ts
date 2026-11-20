import type {MarketFeatureKey} from '@dio-crm/contracts';
import {getCountryProfile} from '../globalization/country-profile';import {getMarketProfile} from '../globalization/market-profile';
import {getFeatureProfile,featureDecision,featureProfileAllowsRuntime} from '../globalization/feature-profile';
import {configAssert,type ConfigTransaction} from './config-store';
/** Repeat market gating against the current fenced company, not the JWT's old company. */
export async function assertDomainMarketFeature(domain:NonNullable<ConfigTransaction['domain']>,feature:MarketFeatureKey){
 const r=await domain.query<{country_code:string;market_profile_code:string|null}>('SELECT country_code,market_profile_code FROM crm_company WITH(HOLDLOCK) WHERE company_id=@companyKey AND is_active=1',{companyKey:domain.companyKey});configAssert(r.recordset.length===1,404,'NOT_FOUND');
 const row=r.recordset[0],country=getCountryProfile(row.country_code);configAssert(country&&country.status!=='BASELINE_ONLY'&&country.marketProfileCode,403,'FEATURE_NOT_AVAILABLE_FOR_MARKET');
 configAssert(!row.market_profile_code?.trim()||row.market_profile_code.trim()===country.marketProfileCode,403,'FEATURE_NOT_AVAILABLE_FOR_MARKET');
 const market=getMarketProfile(country.marketProfileCode),profile=market?getFeatureProfile(market.featureProfileCode):undefined;configAssert(profile&&featureProfileAllowsRuntime(profile)&&featureDecision(profile,feature)===true,403,'FEATURE_NOT_AVAILABLE_FOR_MARKET');
}
