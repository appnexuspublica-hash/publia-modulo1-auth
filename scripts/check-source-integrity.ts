import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const ROOT_DIRECTORY = process.cwd();
const SOURCE_DIRECTORIES = ["src", "scripts", "supabase"];
const TEXT_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".json",
  ".sql",
  ".md",
  ".css",
]);

type IntegrityIssue = {
  file: string;
  line: number;
  column: number;
  codePoint: number;
};

async function collectFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await collectFiles(fullPath)));
      continue;
    }

    if (entry.isFile() && TEXT_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }

  return files;
}

function findInvalidControlCharacters(
  filePath: string,
  content: string,
): IntegrityIssue[] {
  const issues: IntegrityIssue[] = [];
  let line = 1;
  let column = 1;

  for (const character of content) {
    const codePoint = character.codePointAt(0);

    if (
      codePoint !== undefined &&
      codePoint < 32 &&
      character !== "\n" &&
      character !== "\r" &&
      character !== "\t"
    ) {
      issues.push({
        file: path.relative(ROOT_DIRECTORY, filePath),
        line,
        column,
        codePoint,
      });
    }

    if (character === "\n") {
      line += 1;
      column = 1;
    } else {
      column += 1;
    }
  }

  return issues;
}

async function main(): Promise<void> {
  const files: string[] = [];

  for (const sourceDirectory of SOURCE_DIRECTORIES) {
    const absoluteDirectory = path.join(ROOT_DIRECTORY, sourceDirectory);

    try {
      files.push(...(await collectFiles(absoluteDirectory)));
    } catch (error) {
      const code =
        error instanceof Error && "code" in error
          ? String((error as NodeJS.ErrnoException).code)
          : "";

      if (code !== "ENOENT") {
        throw error;
      }
    }
  }

  const issues: IntegrityIssue[] = [];

  for (const file of files) {
    const content = await readFile(file, "utf8");
    issues.push(...findInvalidControlCharacters(file, content));
  }

  if (issues.length > 0) {
    console.error("Falha na integridade dos arquivos-fonte.");
    console.error(
      "Foram encontrados caracteres de controle invisíveis não permitidos:",
    );

    for (const issue of issues) {
      console.error(
        `- ${issue.file}:${issue.line}:${issue.column} (U+${issue.codePoint
          .toString(16)
          .toUpperCase()
          .padStart(4, "0")})`,
      );
    }

    process.exitCode = 1;
    return;
  }

  console.log(
    `Integridade validada: ${files.length} arquivos verificados sem caracteres de controle inválidos.`,
  );
}

main().catch((error: unknown) => {
  console.error("Não foi possível verificar a integridade dos arquivos.");
  console.error(error);
  process.exitCode = 1;
});
