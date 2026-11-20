import {createHash} from 'node:crypto';
import {canonicalConfigJson} from '@dio-crm/contracts/crm-customization';
import type {ConfigRelease} from './config-store.js';
/** Legacy releases keep their exact old digest; extension deployments bind their immutable
 * HQ source and field versions into the company release digest. */
export function configReleaseHash(release:Pick<ConfigRelease,'config'|'effective'|'hqExtension'>){
 const value={config:release.config,effective:release.effective,...(release.hqExtension?{hqExtension:release.hqExtension}:{})};
 return createHash('sha256').update(canonicalConfigJson(value)).digest('hex');
}
