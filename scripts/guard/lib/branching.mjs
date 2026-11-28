// G06 shape detection on the TypeScript AST: which expressions branch on a company/country/market value.
import { excerpt } from './files.mjs';
import { K, constsOf, keyName, kindSet, lineOf, memberName, staticString, textOf, unwrap, walk } from './ts.mjs';

// ISO 3166-1 alpha-2 plus the group codes this project uses.
export const ISO = [
  'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ',
  'CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR',
  'GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT',
  'JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY',
  'MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM',
  'PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ',
  'TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW',
  'UK EU HQ GLOBAL APAC EMEA LATAM',
].join(' ').split(' ');
const codes = new Set(ISO);
export const LOCALE = /^[a-z]{2,3}[-_][A-Z]{2}$/;
const codeInRegex = new RegExp(`(?<![A-Za-z\\\\])(?:${ISO.join('|')})(?![A-Za-z])`);
export const isCode = text => codes.has(text) || LOCALE.test(text);

// A key word counts only at the start of a name part: `companyCode`, `actorCompany`, `MARKET_X`; not `accompany`, `marketing`.
export const KEY = new RegExp('(?:(?<![A-Za-z])(?:company|country|market|tenant|nation)'
  + '|Company|Country|Market|Tenant|Nation|COMPANY|COUNTRY|MARKET|TENANT|NATION)(?!ing)');
// Members and methods that still give "the same value": `country.code`, `market.trim().toUpperCase()`.
export const SAME_VALUE = new Set(['code', 'id', 'key', 'name', 'value', 'toUpperCase', 'toLowerCase', 'toLocaleUpperCase', 'toLocaleLowerCase',
  'trim', 'trimStart', 'trimEnd', 'toString', 'valueOf', 'normalize', 'slice', 'substring', 'substr', 'charAt', 'at', 'replace', 'replaceAll',
  'padStart', 'padEnd', 'concat', 'charCodeAt', 'codePointAt']);
export const EQUALITY = ['EqualsEqualsEqualsToken', 'ExclamationEqualsEqualsToken', 'EqualsEqualsToken', 'ExclamationEqualsToken'];
export const EITHER = ['QuestionQuestionToken', 'BarBarToken', 'AmpersandAmpersandToken', 'PlusToken'];
const equality = kindSet(EQUALITY);
const either = kindSet(EITHER);
// Calls that ask "is this value one of / like that": `list.includes(x)`, `set.has(x)`, `map.get(x)`, `re.test(x)`, `Object.is(a, b)`.
export const TESTS = new Set(['includes', 'indexOf', 'lastIndexOf', 'has', 'get', 'startsWith', 'endsWith', 'localeCompare', 'test', 'match', 'matchAll',
  'search', 'is']);
// Loops that are a membership test when the callback compares its item: `['KR', 'US'].some(code => code === x)`.
export const LOOPS = new Set(['some', 'every', 'find', 'findIndex', 'findLast', 'findLastIndex', 'filter']);
const LOOKUP = '회사/국가/시장 값으로 객체 조회';
const LIST = '회사/국가/시장 값을 리터럴 목록과 비교';
const isAccess = n => n.kind === K.PropertyAccessExpression || n.kind === K.ElementAccessExpression;
const isCall = n => n.kind === K.CallExpression || n.kind === K.NewExpression;

/** Builds the classifiers for one file. `aliases` are local names that hold a key value (`const c = row.countryCode`). */
function shapes(sf) {
  const consts = constsOf(sf);
  const aliases = new Set();
  const text = node => staticString(node, consts);

  /** True when the expression is (derived from) a company/country/market value. `loose` also looks through call arguments. */
  function isKey(node, loose = true) {
    const n = unwrap(node);
    if (n.kind === K.Identifier) return KEY.test(n.text) || aliases.has(n.text);
    if (isAccess(n)) {
      const name = memberName(n, consts);
      if (name === null) return isKey(n.argumentExpression, loose) || isKey(n.expression, loose);
      return KEY.test(name) || (SAME_VALUE.has(name) && isKey(n.expression, loose));
    }
    if (n.kind === K.CallExpression) {
      const callee = unwrap(n.expression);
      const name = callee.kind === K.Identifier ? callee.text : memberName(callee, consts);
      if (isAccess(callee) && name !== null && SAME_VALUE.has(name)) return isKey(callee.expression, loose);
      // `getCountry()`, `String(country)`, `normalize(row.market)`, `Reflect.get(row, 'countryCode')`.
      return (name !== null && KEY.test(name)) || (loose && n.arguments.some(arg => isKey(arg, loose) || KEY.test(text(arg) ?? '')));
    }
    if (n.kind === K.ConditionalExpression) return isKey(n.whenTrue, loose) || isKey(n.whenFalse, loose);
    if (n.kind === K.BinaryExpression && either.has(n.operatorToken.kind)) return isKey(n.left, loose) || isKey(n.right, loose);
    return n.kind === K.TemplateExpression && n.templateSpans.some(span => isKey(span.expression, loose));
  }

  const isCodeLiteral = node => { const value = text(node); return value !== null && isCode(value); };
  /** A constant that stands for a code by its name: `KR`, `Market.KR`, `Market['KR']`. */
  const isCodeConst = node => {
    const n = unwrap(node);
    return n.kind === K.Identifier ? codes.has(n.text) : isAccess(n) && codes.has(memberName(n, consts) ?? '');
  };
  const isNumber = node => {
    const n = unwrap(node);
    if (n.kind === K.PrefixUnaryExpression) return isNumber(n.operand) || text(n.operand) !== null;
    return n.kind === K.NumericLiteral || n.kind === K.BigIntLiteral;
  };
  const isLiteral = node => text(node) !== null || isNumber(node);
  const isRegex = n => n.kind === K.RegularExpressionLiteral;
  /** True when `test` holds for the node, or for an item of a list, or for an argument (`new Set([...])`, `Object.freeze([...])`). */
  const holds = (node, test) => {
    const n = unwrap(node);
    if (n.kind === K.SpreadElement) return holds(n.expression, test);
    if (test(n)) return true;
    if (n.kind === K.ArrayLiteralExpression) return n.elements.some(item => holds(item, test));
    return isCall(n) && (n.arguments ?? []).some(arg => holds(arg, test));
  };
  const hasCode = node => holds(node, n => isCodeLiteral(n) || (isRegex(n) && codeInRegex.test(n.text)));
  const hasLiteral = node => holds(node, n => isLiteral(n) || isRegex(n));

  walk(sf, node => {
    if (node.kind === K.VariableDeclaration && node.name.kind === K.Identifier && node.initializer && isKey(node.initializer, false)) {
      aliases.add(node.name.text);
    } else if (node.kind === K.BindingElement && node.name.kind === K.Identifier && KEY.test(keyName(node.propertyName, consts) ?? '')) {
      aliases.add(node.name.text);
    }
  });
  return { isKey, isCodeLiteral, isCodeConst, isLiteral, hasCode, hasLiteral, consts };
}

/** True when a callback compares its own first parameter with something: `item => item === x`. */
function comparesItem(callback) {
  const fn = callback ? unwrap(callback) : null;
  const item = fn && (fn.kind === K.ArrowFunction || fn.kind === K.FunctionExpression) ? fn.parameters[0]?.name : null;
  if (!item || item.kind !== K.Identifier) return false;
  const isItem = node => { const n = unwrap(node); return n.kind === K.Identifier && n.text === item.text; };
  let found = false;
  walk(fn.body, node => {
    if (node.kind === K.BinaryExpression && equality.has(node.operatorToken.kind) && (isItem(node.left) || isItem(node.right))) found = true;
  });
  return found;
}

/** Returns [{ line, message }] in source order, at most one per node. */
export function branchingOf(sf) {
  const s = shapes(sf);
  const found = [];
  const add = (node, label) => found.push({ line: lineOf(sf, node), message: `${label}: ${excerpt(textOf(sf, node), 50)}` });
  const pair = (a, b) => (s.isCodeLiteral(a) || s.isCodeLiteral(b) ? '코드 리터럴 비교'
    : s.isCodeConst(a) || s.isCodeConst(b) ? '코드 상수 비교'
      : (s.isKey(a) && s.isLiteral(b)) || (s.isKey(b) && s.isLiteral(a)) ? '회사/국가/시장 값을 리터럴과 비교' : null);

  walk(sf, node => {
    if (node.kind === K.BinaryExpression) {
      const op = node.operatorToken.kind;
      const label = equality.has(op) ? pair(node.left, node.right) : null;
      if (label) add(node, label);
      else if (op === K.InKeyword && s.isKey(node.left) && unwrap(node.right).kind === K.ObjectLiteralExpression) add(node, LOOKUP);
    } else if (node.kind === K.SwitchStatement) {
      if (s.isKey(node.expression) || s.isCodeLiteral(node.expression)) add(node.expression, '회사/국가/시장 값으로 switch');
    } else if (node.kind === K.CaseClause) {
      if (s.isCodeLiteral(node.expression) || s.isCodeConst(node.expression)) add(node.expression, '코드 리터럴 case');
    } else if (node.kind === K.ElementAccessExpression) {
      // `{ KR: a, US: b }[country]`: a branch written as an inline lookup table.
      if (unwrap(node.expression).kind === K.ObjectLiteralExpression && s.isKey(node.argumentExpression)) add(node, LOOKUP);
    } else if (node.kind === K.CallExpression) {
      const callee = unwrap(node.expression);
      const name = isAccess(callee) ? memberName(callee, s.consts) : null;
      if (name !== null && LOOPS.has(name) && s.hasCode(callee.expression) && comparesItem(node.arguments[0])) add(node, LIST);
      if (name === null || !TESTS.has(name)) return;
      const operands = [callee.expression, ...node.arguments];
      if (operands.some(s.hasCode)) add(node, '코드 리터럴 포함 검사');
      else if (operands.some((a, i) => s.isKey(a) && operands.some((b, j) => i !== j && s.hasLiteral(b)))) add(node, LIST);
    }
  });
  return found;
}
