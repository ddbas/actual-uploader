/**
 * Pure post-processing of recorded statements: defense-in-depth redaction of
 * likely credential entries (replaced by `await page.pause();`) as a safety
 * net on top of the recorder's own handling of manual mode and password
 * inputs.
 */

export const PAUSE_STATEMENT = "await page.pause();";
/** Terms (English and French) that indicate a password-like field. */
export const DEFAULT_PASSWORD_PATTERNS: RegExp[] = [
  /pass(?:word|code|wd|phrase)/,
  /\bpwd\b/,
  /mot de passe/,
  /mots de passe/,
  /\bmdp\b/,
  /\bpin\b/,
  /\bnip\b/,
  /code secret/,
  /secret/,
];

export interface SanitizeOptions {
  passwordPatterns?: RegExp[];
}

export interface SanitizeResult {
  /** Page steps, one statement per entry. */
  steps: string[];
  warnings: string[];
  /** Number of recorded steps, not counting the initial navigation. */
  recordedStepCount: number;
}

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

/** The locator portion of a `.fill(...)`, i.e. everything before the call. */
function fillTarget(statement: string): string | undefined {
  const index = statement.search(/\.fill\(/);
  return index === -1 ? undefined : statement.slice(0, index);
}

function isPasswordFill(statement: string, patterns: RegExp[]): boolean {
  const target = fillTarget(statement);
  if (target === undefined) {
    return false;
  }
  const haystack = normalize(target);
  return patterns.some((pattern) => pattern.test(haystack));
}

export function sanitize(
  statements: string[],
  options: SanitizeOptions = {},
): SanitizeResult {
  const patterns = options.passwordPatterns ?? DEFAULT_PASSWORD_PATTERNS;
  const steps: string[] = [];
  const warnings: string[] = [];

  for (const statement of statements) {
    if (isPasswordFill(statement, patterns)) {
      warnings.push(
        `A password-like field was filled outside a manual section; its value was removed and replaced with a pause: ${fillTarget(statement)?.trim()}`,
      );
      if (steps[steps.length - 1] !== PAUSE_STATEMENT) {
        steps.push(PAUSE_STATEMENT);
      }
      continue;
    }
    steps.push(statement);
  }

  const recordedStepCount = steps.filter(
    (step) => !/^await page\.goto\(/.test(step),
  ).length;

  return { steps, warnings, recordedStepCount };
}
