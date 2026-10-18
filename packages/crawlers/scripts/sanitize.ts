/**
 * Pure transformation of a raw `playwright codegen` recording (JavaScript
 * library target) into the page steps of a crawler, with all manual sections
 * and likely credential entries replaced by `await page.pause();`.
 */

export const PAUSE_STATEMENT = "await page.pause();";
export const DEFAULT_MARKER_KEY = "Escape";

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
  markerKey?: string;
  passwordPatterns?: RegExp[];
}

export interface SanitizeResult {
  /** Page steps, one statement per entry (may span lines), unindented. */
  steps: string[];
  warnings: string[];
  /** Number of recorded steps, not counting the initial navigation. */
  recordedStepCount: number;
}

const BODY_START = /^\s*const page = await context\.newPage\(\);\s*$/;
const BODY_END = /^\s*\/\/ -{5,}\s*$/;

/** Extracts the lines between the page creation and the closing boilerplate. */
function extractBody(recording: string): string[] {
  const lines = recording.split(/\r?\n/);
  const start = lines.findIndex((line) => BODY_START.test(line));
  if (start === -1) {
    return [];
  }
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => BODY_END.test(line));
  return end === -1 ? rest : rest.slice(0, end);
}

/** Groups body lines into statements using indentation of the first line. */
function groupStatements(body: string[]): string[] {
  const nonEmpty = body.filter((line) => line.trim() !== "");
  const first = nonEmpty[0];
  if (first === undefined) {
    return [];
  }
  const baseIndent = first.length - first.trimStart().length;
  const statements: string[][] = [];
  for (const line of nonEmpty) {
    const indent = line.length - line.trimStart().length;
    const trimmed = line.trimStart();
    const isContinuation =
      indent > baseIndent || (indent === baseIndent && /^[})\]]/.test(trimmed));
    const current = statements[statements.length - 1];
    if (isContinuation && current) {
      current.push(line.slice(baseIndent));
    } else {
      statements.push([line.slice(baseIndent)]);
    }
  }
  return statements.map((lines) => lines.join("\n"));
}

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function isMarkerPress(statement: string, markerKey: string): boolean {
  const match = statement.match(/\.press\(\s*(['"`])(.*?)\1/);
  return match?.[2] === markerKey;
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
  recording: string,
  options: SanitizeOptions = {},
): SanitizeResult {
  const markerKey = options.markerKey ?? DEFAULT_MARKER_KEY;
  const patterns = options.passwordPatterns ?? DEFAULT_PASSWORD_PATTERNS;
  const statements = groupStatements(extractBody(recording));
  const steps: string[] = [];
  const warnings: string[] = [];
  let inManualSection = false;
  let markerCount = 0;

  const pushPause = () => {
    if (steps[steps.length - 1] !== PAUSE_STATEMENT) {
      steps.push(PAUSE_STATEMENT);
    }
  };

  for (const statement of statements) {
    if (isMarkerPress(statement, markerKey)) {
      markerCount++;
      if (inManualSection) {
        inManualSection = false;
      } else {
        inManualSection = true;
        steps.push(PAUSE_STATEMENT);
      }
      continue;
    }
    if (inManualSection) {
      continue;
    }
    if (isPasswordFill(statement, patterns)) {
      warnings.push(
        `A password-like field was filled outside a manual section; its value was removed and replaced with a pause: ${fillTarget(statement)?.trim()}`,
      );
      pushPause();
      continue;
    }
    steps.push(statement);
  }

  if (markerCount % 2 === 1) {
    warnings.push(
      `Recorded an odd number of ${markerKey} presses (${markerCount}), so a manual section is unbalanced and everything after the last marker was treated as manual. A press was probably not recorded: codegen drops key presses when no element has focus, so click a field or button before pressing the marker key. Check the generated crawler.`,
    );
  }

  const recordedStepCount = steps.filter(
    (step) => !/^await page\.goto\(/.test(step),
  ).length;

  return { steps, warnings, recordedStepCount };
}
