// `crm new-object` and `crm add-field`: the commands exist and check their arguments, but do nothing yet.
// The real work (writing metadata files) comes in F1. Until then they exit with code 3 and create no file.

export const NOT_IMPLEMENTED_EXIT = 3;
/** Object and field names: lower_snake_case, starts with a letter, 2 to 40 characters. Example: `visit_plan`. */
export const NAME_PATTERN = /^[a-z][a-z0-9_]{1,39}$/;
/** The field types of the admin contract today (`extension.type` in packages/contracts/src/admin/schemas.ts). */
export const FIELD_TYPES = Object.freeze(['text', 'decimal', 'date', 'boolean', 'enum']);

const nameError = (label, value) => (NAME_PATTERN.test(value ?? '')
  ? null
  : `${label} "${value ?? ''}" 이 잘못되었습니다. 영어 소문자로 시작하고 소문자·숫자·밑줄(_)만 쓰며 2~40자입니다. 예: visit_plan`);

/** Returns { ok: false, error } for bad arguments, otherwise { ok: true, plan } describing what F1 will do. */
export function planNewObject(args) {
  if (args.length !== 1) return { ok: false, error: '사용법: crm new-object <이름>' };
  const error = nameError('개체 이름', args[0]);
  return error ? { ok: false, error } : { ok: true, plan: { command: 'new-object', object: args[0] } };
}

export function planAddField(args) {
  if (args.length !== 3) return { ok: false, error: `사용법: crm add-field <개체> <필드> <종류>  (종류: ${FIELD_TYPES.join(', ')})` };
  const [object, field, type] = args;
  const error = nameError('개체 이름', object) ?? nameError('필드 이름', field)
    ?? (FIELD_TYPES.includes(type) ? null : `필드 종류 "${type}" 를 모릅니다. 쓸 수 있는 종류: ${FIELD_TYPES.join(', ')}`);
  return error ? { ok: false, error } : { ok: true, plan: { command: 'add-field', object, field, type } };
}

export const notImplementedMessage = plan => `인자는 올바릅니다 (${Object.values(plan).join(' ')}). 이 명령은 F1에서 구현합니다. 지금은 아무 파일도 만들지 않습니다.`;
