// Subprocess bridge to the upstream node_runner Python package (encoding.py).
// We use the real Python implementation as the canonical converter because
// the TS port in @node-runner/core is a placeholder for hash/xml.
//
// Resolution order for the Python source:
//   1. env NODE_RUNNER_PYTHON_PATH points to an existing directory containing
//      a node_runner package (i.e. encoding.py at <path>/encoding.py).
//   2. Local monorepo checkout - ../../node_runner relative to apps/api.
//   3. GitHub fallback - fetch encoding.py, node_data.py, constants.py from
//      raw.githubusercontent.com into a local cache (DATA_DIR/python/node_runner/).
//
// If python3 isn't installed we surface a clear error rather than silently
// returning placeholder text.

import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync, statSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { env } from './env.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// apps/api/src/lib → apps/api
const API_DIR = resolve(__dirname, '..', '..')
const WORKSPACE_ROOT = resolve(API_DIR, '..', '..', '..')
const LOCAL_NODE_RUNNER = join(WORKSPACE_ROOT, 'node_runner')
const BUNDLED_PYTHON_DIR = join(API_DIR, 'python')
const VENDOR_DIR = join(BUNDLED_PYTHON_DIR, 'vendor')
const CACHE_DIR = join(resolve(API_DIR, env.DATA_DIR), 'python', 'node_runner')

const GITHUB_RAW = 'https://raw.githubusercontent.com/Noah4ever/node_runner/main/node_runner'
const REQUIRED_FILES = ['encoding.py', 'node_data.py', 'constants.py']
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 // refresh from GitHub at most daily

export type NodeFormat = 'hash' | 'json' | 'xml' | 'ai_json'

let resolvedPath: string | null = null
let resolvedPathPromise: Promise<string> | null = null

function dirHasNodeRunner(dir: string): boolean {
  return REQUIRED_FILES.every((f) => existsSync(join(dir, f)))
}

async function fetchFromGitHub(targetDir: string): Promise<void> {
  mkdirSync(targetDir, { recursive: true })
  for (const file of REQUIRED_FILES) {
    const url = `${GITHUB_RAW}/${file}`
    const res = await fetch(url)
    if (!res.ok) {
      throw new Error(`Failed to fetch ${url}: HTTP ${res.status}`)
    }
    writeFileSync(join(targetDir, file), await res.text(), 'utf8')
  }
  // Empty __init__.py so the vendor dir works as a package without triggering
  // the upstream __init__'s lazy operators imports.
  writeFileSync(join(targetDir, '__init__.py'), '', 'utf8')
}

function cacheIsFresh(dir: string): boolean {
  try {
    const stat = statSync(join(dir, 'encoding.py'))
    return Date.now() - stat.mtimeMs < CACHE_TTL_MS
  } catch {
    return false
  }
}

async function resolvePythonPath(): Promise<string> {
  if (resolvedPath) return resolvedPath
  if (resolvedPathPromise) return resolvedPathPromise

  resolvedPathPromise = (async () => {
    // 1. env override
    const envPath = process.env.NODE_RUNNER_PYTHON_PATH
    if (envPath && dirHasNodeRunner(envPath)) {
      resolvedPath = envPath
      return envPath
    }

    // 2. local workspace checkout
    if (dirHasNodeRunner(LOCAL_NODE_RUNNER)) {
      // Make a vendor symlink-or-copy under apps/api/python/vendor/node_runner
      // so the CLI's sys.path can stay stable. Use copy (cheap, ~50 KB).
      const vendorTarget = join(VENDOR_DIR, 'node_runner')
      mkdirSync(vendorTarget, { recursive: true })
      for (const file of REQUIRED_FILES) {
        writeFileSync(join(vendorTarget, file), readFileSync(join(LOCAL_NODE_RUNNER, file), 'utf8'))
      }
      writeFileSync(join(vendorTarget, '__init__.py'), '', 'utf8')
      resolvedPath = vendorTarget
      return vendorTarget
    }

    // 3. GitHub fetch into cache
    if (!cacheIsFresh(CACHE_DIR) || !dirHasNodeRunner(CACHE_DIR)) {
      await fetchFromGitHub(CACHE_DIR)
    }
    if (dirHasNodeRunner(CACHE_DIR)) {
      resolvedPath = CACHE_DIR
      return CACHE_DIR
    }

    throw new Error(
      'Could not locate the node_runner Python package. Set NODE_RUNNER_PYTHON_PATH ' +
        'to a directory containing encoding.py, or ensure GitHub is reachable.',
    )
  })()

  try {
    return await resolvedPathPromise
  } finally {
    resolvedPathPromise = null
  }
}

export interface ConvertResult {
  output: string
  sourceFormat: NodeFormat
  targetFormat: NodeFormat
}

export class PythonConverterError extends Error {
  constructor(message: string, public readonly stderr?: string) {
    super(message)
    this.name = 'PythonConverterError'
  }
}

export async function pythonConvert(
  input: string,
  sourceFormat: NodeFormat,
  targetFormat: NodeFormat,
): Promise<ConvertResult> {
  const pythonRoot = await resolvePythonPath()
  const script = join(BUNDLED_PYTHON_DIR, 'convert_cli.py')

  return new Promise<ConvertResult>((resolve, reject) => {
    const proc = spawn('python3', [script], {
      env: {
        ...process.env,
        // Tell the CLI where the node_runner package lives so it can sys.path.insert
        NODE_RUNNER_PYTHON_PATH: pythonRoot,
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''
    proc.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString('utf8') })
    proc.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString('utf8') })

    proc.on('error', (err) => {
      const msg = (err as NodeJS.ErrnoException).code === 'ENOENT'
        ? 'python3 is not installed or not on PATH. Install Python 3 to enable Hash/XML conversion.'
        : `Failed to spawn python3: ${err.message}`
      reject(new PythonConverterError(msg))
    })

    proc.on('close', (code) => {
      if (!stdout) {
        return reject(new PythonConverterError(`Converter returned no output (exit ${code})`, stderr))
      }
      try {
        const parsed = JSON.parse(stdout) as
          | { ok: true; output: string }
          | { ok: false; error: string; trace?: string }
        if (!parsed.ok) {
          return reject(new PythonConverterError(parsed.error, stderr || (parsed as { trace?: string }).trace))
        }
        resolve({ output: parsed.output, sourceFormat, targetFormat })
      } catch (e) {
        reject(new PythonConverterError(`Failed to parse converter output: ${(e as Error).message}`, stderr))
      }
    })

    proc.stdin.write(JSON.stringify({ input, sourceFormat, targetFormat }))
    proc.stdin.end()
  })
}

// Returns metadata about which source the converter resolved to. Useful for
// the API to expose in /health or surface in convert responses.
export async function describeConverter(): Promise<{ source: 'env' | 'local' | 'cache'; path: string }> {
  const path = await resolvePythonPath()
  const source =
    process.env.NODE_RUNNER_PYTHON_PATH === path
      ? 'env'
      : path.startsWith(VENDOR_DIR)
        ? 'local'
        : 'cache'
  return { source, path }
}
