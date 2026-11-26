import g01 from './g01-metadata-only-config.mjs';
import g02 from './g02-zone-boundaries.mjs';
import g03 from './g03-file-size.mjs';
import g04 from './g04-hardcoded-ui-text.mjs';
import g05 from './g05-raw-style.mjs';
import g06 from './g06-company-branching.mjs';
import g07 from './g07-direct-io.mjs';
import g08 from './g08-disabled-tests.mjs';
import g09 from './g09-change-id.mjs';
import g10 from './g10-legacy-freeze.mjs';
import g11 from './g11-no-test-imports.mjs';

export const RULES = [g01, g02, g03, g04, g05, g06, g07, g08, g09, g10, g11];
export const DEFAULT_RULES = RULES.filter(rule => rule.defaultRun !== false);
