export type AccountFieldRule = {
  code: string;
  visible: boolean;
  required?: boolean;
  readonly?: boolean;
  labelKey?: string;
  validationRuleKey?: string;
};

export type AccountSectionProfile = {
  code: string;
  titleKey: string;
  order: number;
  visible: boolean;
  fields: AccountFieldRule[];
};

export type AccountFieldProfile = {
  code: string;
  entity: 'account';
  sections: AccountSectionProfile[];
};

export type EffectiveAccountField = {
  code: string;
  visible: boolean;
  required: boolean;
  readonly: boolean;
  labelKey?: string;
  validationRuleKey?: string;
};
