import {
  ACCOUNT_INTERFACE_FIELDS,
  type AccountInterfaceField,
  type GlobalizationContext
} from '@dio-crm/contracts';
import { GLOBAL_ACCOUNT_FIELD_PROFILE } from './GLOBAL_ACCOUNT';
import { HQ_ACCOUNT_FIELD_PROFILE } from './HQ_ACCOUNT';
import type { AccountFieldProfile, AccountSectionProfile, EffectiveAccountField } from './types';

const registry = new Map<string, AccountFieldProfile>([
  [HQ_ACCOUNT_FIELD_PROFILE.code, HQ_ACCOUNT_FIELD_PROFILE],
  [GLOBAL_ACCOUNT_FIELD_PROFILE.code, GLOBAL_ACCOUNT_FIELD_PROFILE]
]);

export class FieldProfileResolutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FieldProfileResolutionError';
  }
}

export function getAccountFieldProfile(code: string): AccountFieldProfile | undefined {
  return registry.get(code);
}

export function resolveAccountFieldProfileCode(context: GlobalizationContext): string {
  const configured = context.fieldProfileCode;
  if (configured) {
    if (!registry.has(configured)) {
      throw new FieldProfileResolutionError(`FIELD_PROFILE_NOT_REGISTERED:${configured}`);
    }
    return configured;
  }

  if (context.countryCode === 'KR' && context.marketProfileCode === 'KR_SALES') {
    return HQ_ACCOUNT_FIELD_PROFILE.code;
  }

  throw new FieldProfileResolutionError('FIELD_PROFILE_NOT_RESOLVED');
}

export function resolveAccountFieldProfile(context: GlobalizationContext): AccountFieldProfile {
  const code = resolveAccountFieldProfileCode(context);
  const profile = registry.get(code);
  if (!profile) throw new FieldProfileResolutionError(`FIELD_PROFILE_NOT_REGISTERED:${code}`);
  return profile;
}

export function visibleAccountSections(profile: AccountFieldProfile): AccountSectionProfile[] {
  return [...profile.sections]
    .filter(section => section.visible)
    .sort((a, b) => a.order - b.order);
}

export function effectiveAccountFields(section: AccountSectionProfile): Array<{
  field: AccountInterfaceField;
  rule: EffectiveAccountField;
}> {
  return section.fields
    .filter(rule => rule.visible)
    .map(rule => {
      const field = ACCOUNT_INTERFACE_FIELDS.find(candidate => candidate.code === rule.code);
      if (!field) throw new FieldProfileResolutionError(`ACCOUNT_FIELD_NOT_REGISTERED:${rule.code}`);
      return {
        field,
        rule: {
          code: rule.code,
          visible: true,
          required: rule.required ?? field.requiredOut,
          readonly: rule.readonly ?? false,
          labelKey: rule.labelKey,
          validationRuleKey: rule.validationRuleKey
        }
      };
    });
}

export function toLegacyAccountFormSections(profile: AccountFieldProfile) {
  return visibleAccountSections(profile).map(section => ({
    id: section.code,
    titleKey: section.titleKey,
    codes: effectiveAccountFields(section).map(({ field }) => field.code)
  }));
}
