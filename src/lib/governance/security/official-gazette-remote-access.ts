import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { request as httpsRequest } from "node:https";
import { checkServerIdentity } from "node:tls";

const DEFAULT_HTML_MAX_BYTES = 2 * 1024 * 1024;
const DEFAULT_PDF_MAX_BYTES = 50 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_REDIRECTS = 3;
const USER_AGENT = "Publ.IA/12.1 (+sincronizacao-diario-oficial)";

const REDIRECT_STATUS_CODES = new Set([301, 302, 303, 307, 308]);
const BLOCKED_HOST_SUFFIXES = [
  ".internal",
  ".local",
  ".localhost",
  ".home.arpa",
  ".lan",
];

export type OfficialGazetteRemoteAccessErrorCode =
  | "invalid_url"
  | "https_required"
  | "credentials_not_allowed"
  | "port_not_allowed"
  | "host_not_allowed"
  | "blocked_host"
  | "blocked_address"
  | "dns_failure"
  | "timeout"
  | "redirect_limit"
  | "invalid_redirect"
  | "http_status"
  | "response_too_large"
  | "invalid_content_type"
  | "empty_response"
  | "network_failure";

export class OfficialGazetteRemoteAccessError extends Error {
  readonly code: OfficialGazetteRemoteAccessErrorCode;

  constructor(
    code: OfficialGazetteRemoteAccessErrorCode,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "OfficialGazetteRemoteAccessError";
    this.code = code;
  }
}

type SafeRemoteRequestOptions = {
  sourceUrl: string;
  accept: string;
  maxBytes: number;
  timeoutMs?: number;
  maxRedirects?: number;
};

type SafeRemoteResponse = {
  body: Buffer;
  contentType: string;
  finalUrl: string;
};

type ResolvedAddress = {
  address: string;
  family: 4 | 6;
};

function readBoundedIntegerEnvironmentVariable(
  name: string,
  fallback: number,
  minimum: number,
  maximum: number,
) {
  const rawValue = process.env[name];
  if (!rawValue) return fallback;

  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed)) return fallback;

  return Math.min(maximum, Math.max(minimum, parsed));
}

function getAllowedHttpsPorts() {
  const configured = (
    process.env.GOVERNANCE_OFFICIAL_GAZETTE_ALLOWED_HTTPS_PORTS ?? ""
  )
    .split(/[;,\s]+/)
    .map((value) => value.trim())
    .filter(Boolean);

  return new Set(["443", ...configured]);
}

function normalizeHostname(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, "")
    .replace(/\.$/, "");
}

function getConfiguredAllowedHostPatterns() {
  return (process.env.GOVERNANCE_OFFICIAL_GAZETTE_ALLOWED_HOSTS ?? "")
    .split(/[;,\s]+/)
    .map((value) => normalizeHostname(value.replace(/^\*\./, "")))
    .filter(Boolean);
}

function isHostnameBlocked(hostname: string) {
  const normalized = normalizeHostname(hostname);

  return (
    normalized === "localhost" ||
    normalized === "metadata.google.internal" ||
    BLOCKED_HOST_SUFFIXES.some((suffix) => normalized.endsWith(suffix))
  );
}

function parseIpv4Address(address: string) {
  const parts = address.split(".");
  if (parts.length !== 4) return null;

  const bytes = parts.map((part) => Number.parseInt(part, 10));
  if (
    bytes.some(
      (byte, index) =>
        !Number.isInteger(byte) ||
        byte < 0 ||
        byte > 255 ||
        String(byte) !== String(Number.parseInt(parts[index] ?? "", 10)),
    )
  ) {
    return null;
  }

  return bytes as [number, number, number, number];
}

function isBlockedIpv4Address(address: string) {
  const bytes = parseIpv4Address(address);
  if (!bytes) return true;

  const [a, b, c, d] = bytes;

  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && c === 0) ||
    (a === 192 && b === 0 && c === 2) ||
    (a === 192 && b === 88 && c === 99) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224 ||
    (a === 255 && b === 255 && c === 255 && d === 255)
  );
}

function expandIpv6Address(address: string) {
  const withoutZone = address.toLowerCase().split("%")[0] ?? "";
  let normalized = withoutZone;

  const ipv4Match = normalized.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (ipv4Match) {
    const ipv4 = parseIpv4Address(ipv4Match[1]);
    if (!ipv4) return null;

    const [a, b, c, d] = ipv4;
    const high = ((a << 8) | b).toString(16);
    const low = ((c << 8) | d).toString(16);
    normalized = normalized.replace(ipv4Match[1], `${high}:${low}`);
  }

  const halves = normalized.split("::");
  if (halves.length > 2) return null;

  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves[1] ? halves[1].split(":") : [];
  const missing = 8 - left.length - right.length;

  if ((halves.length === 1 && missing !== 0) || missing < 0) {
    return null;
  }

  const groups = [
    ...left,
    ...Array.from({ length: missing }, () => "0"),
    ...right,
  ].map((group) => Number.parseInt(group || "0", 16));

  if (
    groups.length !== 8 ||
    groups.some(
      (group) => !Number.isInteger(group) || group < 0 || group > 0xffff,
    )
  ) {
    return null;
  }

  return groups;
}

function isBlockedIpv6Address(address: string) {
  const groups = expandIpv6Address(address);
  if (!groups) return true;

  const [g0, g1, g2, g3, g4, g5, g6, g7] = groups;
  const allZero = groups.every((group) => group === 0);
  const loopback = groups.slice(0, 7).every((group) => group === 0) && g7 === 1;

  if (allZero || loopback) return true;

  const isIpv4Compatible =
    g0 === 0 &&
    g1 === 0 &&
    g2 === 0 &&
    g3 === 0 &&
    g4 === 0 &&
    (g5 === 0 || g5 === 0xffff);

  if (isIpv4Compatible) {
    const mappedIpv4 = `${g6 >> 8}.${g6 & 0xff}.${g7 >> 8}.${g7 & 0xff}`;
    return isBlockedIpv4Address(mappedIpv4);
  }

  return (
    (g0 & 0xfe00) === 0xfc00 ||
    (g0 & 0xffc0) === 0xfe80 ||
    (g0 & 0xff00) === 0xff00 ||
    (g0 === 0x0064 &&
      g1 === 0xff9b &&
      g2 === 0 &&
      g3 === 0 &&
      g4 === 0 &&
      g5 === 0) ||
    (g0 === 0x2001 && g1 === 0x0000) ||
    (g0 === 0x2001 && g1 === 0x0db8) ||
    (g0 === 0x2001 && (g1 & 0xfff0) === 0x0010) ||
    (g0 === 0x2001 && (g1 & 0xfff0) === 0x0020) ||
    g0 === 0x2002
  );
}

export function isBlockedOfficialGazetteIpAddress(address: string) {
  const version = isIP(address);

  if (version === 4) return isBlockedIpv4Address(address);
  if (version === 6) return isBlockedIpv6Address(address);

  return true;
}

function hostMatchesPattern(hostname: string, pattern: string) {
  return hostname === pattern || hostname.endsWith(`.${pattern}`);
}

function isHostAllowedForSource(hostname: string, sourceHostname: string) {
  const normalizedHost = normalizeHostname(hostname);
  const normalizedSource = normalizeHostname(sourceHostname);

  if (
    normalizedHost === normalizedSource ||
    normalizedHost.endsWith(`.${normalizedSource}`)
  ) {
    return true;
  }

  if (
    normalizedSource.startsWith("www.") &&
    normalizedHost === normalizedSource.slice(4)
  ) {
    return true;
  }

  if (
    normalizedHost.startsWith("www.") &&
    normalizedHost.slice(4) === normalizedSource
  ) {
    return true;
  }

  return getConfiguredAllowedHostPatterns().some((pattern) =>
    hostMatchesPattern(normalizedHost, pattern),
  );
}

export function normalizeOfficialGazetteUrlInput(value: unknown) {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized) return "";

  const withProtocol = /^[a-z][a-z\d+.-]*:\/\//i.test(normalized)
    ? normalized
    : `https://${normalized}`;

  try {
    return new URL(withProtocol).toString();
  } catch {
    throw new OfficialGazetteRemoteAccessError(
      "invalid_url",
      "Informe uma URL válida para o Diário Oficial.",
    );
  }
}

function assertUrlShape(url: URL) {
  if (url.protocol !== "https:") {
    throw new OfficialGazetteRemoteAccessError(
      "https_required",
      "A fonte do Diário Oficial deve usar HTTPS.",
    );
  }

  if (url.username || url.password) {
    throw new OfficialGazetteRemoteAccessError(
      "credentials_not_allowed",
      "A URL do Diário Oficial não pode conter credenciais.",
    );
  }

  const effectivePort = url.port || "443";
  if (!getAllowedHttpsPorts().has(effectivePort)) {
    throw new OfficialGazetteRemoteAccessError(
      "port_not_allowed",
      "A porta informada não é permitida para a fonte do Diário Oficial.",
    );
  }

  if (isHostnameBlocked(url.hostname)) {
    throw new OfficialGazetteRemoteAccessError(
      "blocked_host",
      "O endereço informado não pode apontar para uma rede interna ou local.",
    );
  }
}

async function runWithDeadline<T>(
  operation: Promise<T>,
  deadline: number,
  timeoutMessage: string,
) {
  const remainingMs = deadline - Date.now();
  if (remainingMs <= 0) {
    throw new OfficialGazetteRemoteAccessError("timeout", timeoutMessage);
  }

  let timeout: ReturnType<typeof setTimeout> | null = null;

  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => {
          reject(
            new OfficialGazetteRemoteAccessError("timeout", timeoutMessage),
          );
        }, remainingMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function resolvePublicAddress(hostname: string, deadline: number) {
  const normalizedHostname = normalizeHostname(hostname);
  const literalIpVersion = isIP(normalizedHostname);

  if (literalIpVersion) {
    if (isBlockedOfficialGazetteIpAddress(normalizedHostname)) {
      throw new OfficialGazetteRemoteAccessError(
        "blocked_address",
        "O endereço informado não pode apontar para uma rede interna ou reservada.",
      );
    }

    return {
      address: normalizedHostname,
      family: literalIpVersion as 4 | 6,
    } satisfies ResolvedAddress;
  }

  let records: Array<{ address: string; family: number }>;

  try {
    records = await runWithDeadline(
      lookup(normalizedHostname, { all: true, verbatim: true }),
      deadline,
      "O portal demorou além do limite para resolver o endereço.",
    );
  } catch (error) {
    if (error instanceof OfficialGazetteRemoteAccessError) throw error;

    throw new OfficialGazetteRemoteAccessError(
      "dns_failure",
      "Não foi possível resolver o endereço do portal oficial.",
      { cause: error },
    );
  }

  if (records.length === 0) {
    throw new OfficialGazetteRemoteAccessError(
      "dns_failure",
      "Não foi possível resolver o endereço do portal oficial.",
    );
  }

  for (const record of records) {
    if (isBlockedOfficialGazetteIpAddress(record.address)) {
      throw new OfficialGazetteRemoteAccessError(
        "blocked_address",
        "O endereço informado não pode apontar para uma rede interna ou reservada.",
      );
    }
  }

  const selected = records.find((record) => record.family === 4) ?? records[0];

  return {
    address: selected.address,
    family: selected.family as 4 | 6,
  } satisfies ResolvedAddress;
}

export async function assertSafeOfficialGazetteUrl(
  input: string,
  options?: { sourceHostname?: string; deadline?: number },
) {
  let url: URL;

  try {
    url = new URL(input);
  } catch {
    throw new OfficialGazetteRemoteAccessError(
      "invalid_url",
      "Informe uma URL válida para o Diário Oficial.",
    );
  }

  assertUrlShape(url);

  if (
    options?.sourceHostname &&
    !isHostAllowedForSource(url.hostname, options.sourceHostname)
  ) {
    throw new OfficialGazetteRemoteAccessError(
      "host_not_allowed",
      "O portal direcionou a sincronização para um domínio externo não autorizado.",
    );
  }

  const deadline = options?.deadline ?? Date.now() + DEFAULT_TIMEOUT_MS;
  const resolvedAddress = await resolvePublicAddress(url.hostname, deadline);

  return { url, resolvedAddress };
}

export function isOfficialGazetteUrlAllowedForSource(
  candidateUrl: string,
  sourceUrl: string,
) {
  try {
    const candidate = new URL(candidateUrl);
    const source = new URL(sourceUrl);

    assertUrlShape(candidate);
    assertUrlShape(source);

    return isHostAllowedForSource(candidate.hostname, source.hostname);
  } catch {
    return false;
  }
}

function readResponseBody(
  response: import("node:http").IncomingMessage,
  maximumBytes: number,
) {
  return new Promise<Buffer>((resolve, reject) => {
    const contentLengthHeader = response.headers["content-length"];
    const contentLength = Array.isArray(contentLengthHeader)
      ? Number.parseInt(contentLengthHeader[0] ?? "", 10)
      : Number.parseInt(contentLengthHeader ?? "", 10);

    if (Number.isFinite(contentLength) && contentLength > maximumBytes) {
      response.destroy();
      reject(
        new OfficialGazetteRemoteAccessError(
          "response_too_large",
          "O arquivo remoto excede o limite permitido para sincronização.",
        ),
      );
      return;
    }

    const contentEncoding = String(response.headers["content-encoding"] ?? "")
      .trim()
      .toLowerCase();

    if (contentEncoding && contentEncoding !== "identity") {
      response.destroy();
      reject(
        new OfficialGazetteRemoteAccessError(
          "invalid_content_type",
          "O portal retornou uma codificação de conteúdo não permitida.",
        ),
      );
      return;
    }

    const chunks: Buffer[] = [];
    let totalBytes = 0;

    response.on("data", (chunk: Buffer | Uint8Array | string) => {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      totalBytes += buffer.length;

      if (totalBytes > maximumBytes) {
        response.destroy(
          new OfficialGazetteRemoteAccessError(
            "response_too_large",
            "O arquivo remoto excede o limite permitido para sincronização.",
          ),
        );
        return;
      }

      chunks.push(buffer);
    });

    response.on("end", () => {
      const body = Buffer.allocUnsafe(totalBytes);
      let offset = 0;

      for (const chunk of chunks) {
        body.set(chunk, offset);
        offset += chunk.length;
      }

      resolve(body);
    });
    response.on("aborted", () =>
      reject(
        new OfficialGazetteRemoteAccessError(
          "network_failure",
          "A conexão com o portal foi encerrada antes do término do download.",
        ),
      ),
    );
    response.on("error", (error) => reject(error));
  });
}

async function requestPinnedHttps(
  targetUrl: URL,
  resolvedAddress: ResolvedAddress,
  options: { accept: string; maximumBytes: number; deadline: number },
) {
  const remainingMs = options.deadline - Date.now();
  if (remainingMs <= 0) {
    throw new OfficialGazetteRemoteAccessError(
      "timeout",
      "O portal demorou além do limite permitido.",
    );
  }

  return new Promise<{
    statusCode: number;
    location: string | null;
    contentType: string;
    body: Buffer;
  }>((resolve, reject) => {
    let settled = false;
    let absoluteTimeout: ReturnType<typeof setTimeout> | null = null;

    const clearAbsoluteTimeout = () => {
      if (absoluteTimeout) {
        clearTimeout(absoluteTimeout);
        absoluteTimeout = null;
      }
    };

    const settleWithError = (error: unknown) => {
      if (settled) return;
      settled = true;
      clearAbsoluteTimeout();

      if (error instanceof OfficialGazetteRemoteAccessError) {
        reject(error);
        return;
      }

      reject(
        new OfficialGazetteRemoteAccessError(
          "network_failure",
          "Não foi possível acessar o portal oficial com segurança.",
          { cause: error },
        ),
      );
    };

    const tlsHostname = normalizeHostname(targetUrl.hostname);

    const request = httpsRequest(
      {
        protocol: "https:",
        hostname: resolvedAddress.address,
        family: resolvedAddress.family,
        port: Number.parseInt(targetUrl.port || "443", 10),
        method: "GET",
        path: `${targetUrl.pathname}${targetUrl.search}`,
        servername: isIP(tlsHostname) ? undefined : tlsHostname,
        rejectUnauthorized: true,
        checkServerIdentity: (_hostname, certificate) =>
          checkServerIdentity(tlsHostname, certificate),
        agent: false,
        headers: {
          Host: targetUrl.host,
          "User-Agent": USER_AGENT,
          Accept: options.accept,
          "Accept-Encoding": "identity",
          Connection: "close",
        },
      },
      async (response) => {
        try {
          const statusCode = response.statusCode ?? 0;
          const locationHeader = response.headers.location;
          const location = Array.isArray(locationHeader)
            ? (locationHeader[0] ?? null)
            : (locationHeader ?? null);

          if (REDIRECT_STATUS_CODES.has(statusCode)) {
            response.resume();

            if (settled) return;
            settled = true;
            clearAbsoluteTimeout();
            resolve({
              statusCode,
              location,
              contentType: "",
              body: Buffer.alloc(0),
            });
            return;
          }

          const body = await readResponseBody(response, options.maximumBytes);

          if (settled) return;
          settled = true;
          clearAbsoluteTimeout();
          resolve({
            statusCode,
            location: null,
            contentType: String(response.headers["content-type"] ?? ""),
            body,
          });
        } catch (error) {
          settleWithError(error);
        }
      },
    );

    absoluteTimeout = setTimeout(() => {
      request.destroy(
        new OfficialGazetteRemoteAccessError(
          "timeout",
          "O portal demorou além do limite permitido.",
        ),
      );
    }, remainingMs);

    request.on("error", settleWithError);
    request.end();
  });
}

async function requestSafeRemoteResource(
  inputUrl: string,
  options: SafeRemoteRequestOptions,
): Promise<SafeRemoteResponse> {
  const timeoutMs =
    options.timeoutMs ??
    readBoundedIntegerEnvironmentVariable(
      "GOVERNANCE_OFFICIAL_GAZETTE_TIMEOUT_MS",
      DEFAULT_TIMEOUT_MS,
      5_000,
      120_000,
    );
  const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  const deadline = Date.now() + timeoutMs;
  const source = new URL(options.sourceUrl);
  let currentUrl = inputUrl;

  for (
    let redirectCount = 0;
    redirectCount <= maxRedirects;
    redirectCount += 1
  ) {
    const { url, resolvedAddress } = await assertSafeOfficialGazetteUrl(
      currentUrl,
      {
        sourceHostname: source.hostname,
        deadline,
      },
    );

    const response = await requestPinnedHttps(url, resolvedAddress, {
      accept: options.accept,
      maximumBytes: options.maxBytes,
      deadline,
    });

    if (REDIRECT_STATUS_CODES.has(response.statusCode)) {
      if (redirectCount >= maxRedirects) {
        throw new OfficialGazetteRemoteAccessError(
          "redirect_limit",
          "O portal excedeu o limite seguro de redirecionamentos.",
        );
      }

      if (!response.location) {
        throw new OfficialGazetteRemoteAccessError(
          "invalid_redirect",
          "O portal retornou um redirecionamento inválido.",
        );
      }

      try {
        currentUrl = new URL(response.location, url).toString();
      } catch {
        throw new OfficialGazetteRemoteAccessError(
          "invalid_redirect",
          "O portal retornou um redirecionamento inválido.",
        );
      }

      continue;
    }

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw new OfficialGazetteRemoteAccessError(
        "http_status",
        `O portal oficial respondeu com status ${response.statusCode}.`,
      );
    }

    if (response.body.length === 0) {
      throw new OfficialGazetteRemoteAccessError(
        "empty_response",
        "O portal retornou uma resposta vazia.",
      );
    }

    return {
      body: response.body,
      contentType: response.contentType,
      finalUrl: url.toString(),
    };
  }

  throw new OfficialGazetteRemoteAccessError(
    "redirect_limit",
    "O portal excedeu o limite seguro de redirecionamentos.",
  );
}

function looksLikeHtml(body: Buffer) {
  const sample = body
    .subarray(0, 1024)
    .toString("utf8")
    .trimStart()
    .toLowerCase();
  return sample.startsWith("<!doctype html") || sample.startsWith("<html");
}

function looksLikePdf(body: Buffer) {
  return body.subarray(0, 1024).includes(Buffer.from("%PDF-"));
}

export async function fetchOfficialGazetteHtml(sourceUrl: string) {
  const normalizedSourceUrl = normalizeOfficialGazetteUrlInput(sourceUrl);
  const maximumBytes = readBoundedIntegerEnvironmentVariable(
    "GOVERNANCE_OFFICIAL_GAZETTE_MAX_HTML_BYTES",
    DEFAULT_HTML_MAX_BYTES,
    64 * 1024,
    10 * 1024 * 1024,
  );
  const response = await requestSafeRemoteResource(normalizedSourceUrl, {
    sourceUrl: normalizedSourceUrl,
    accept: "text/html,application/xhtml+xml",
    maxBytes: maximumBytes,
  });
  const contentType = response.contentType.toLowerCase();

  if (
    !contentType.includes("text/html") &&
    !contentType.includes("application/xhtml+xml") &&
    !looksLikeHtml(response.body)
  ) {
    throw new OfficialGazetteRemoteAccessError(
      "invalid_content_type",
      "A fonte cadastrada não retornou uma página HTML válida.",
    );
  }

  return {
    html: response.body.toString("utf8"),
    finalUrl: response.finalUrl,
  };
}

export async function fetchOfficialGazettePdf(
  pdfUrl: string,
  sourceUrl: string,
) {
  const normalizedSourceUrl = normalizeOfficialGazetteUrlInput(sourceUrl);
  const normalizedPdfUrl = normalizeOfficialGazetteUrlInput(pdfUrl);
  const maximumBytes = readBoundedIntegerEnvironmentVariable(
    "GOVERNANCE_OFFICIAL_GAZETTE_MAX_PDF_BYTES",
    DEFAULT_PDF_MAX_BYTES,
    1024 * 1024,
    150 * 1024 * 1024,
  );
  const response = await requestSafeRemoteResource(normalizedPdfUrl, {
    sourceUrl: normalizedSourceUrl,
    accept: "application/pdf,application/octet-stream",
    maxBytes: maximumBytes,
  });
  const contentType = response.contentType.toLowerCase();

  if (contentType.includes("text/html") || !looksLikePdf(response.body)) {
    throw new OfficialGazetteRemoteAccessError(
      "invalid_content_type",
      "O endereço informado não retornou um PDF válido.",
    );
  }

  return {
    fileBuffer: response.body,
    contentType: contentType.includes("application/pdf")
      ? response.contentType
      : "application/pdf",
    finalUrl: response.finalUrl,
  };
}
