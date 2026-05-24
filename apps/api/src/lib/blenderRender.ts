// Headless Blender render of a node-runner shader tree.
//
// Spawns `blender --background --factory-startup --python render_cli.py -- <input.json> <output.png>`
// and returns the PNG bytes. Renders are cached on disk under DATA_DIR/renders
// keyed by a hash of the JSON content, and a single-flight map prevents
// duplicate concurrent renders for the same content.

import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { env } from './env.js'

const API_DIR = process.cwd()
const BUNDLED_PYTHON_DIR = join(API_DIR, 'python')
const RENDER_SCRIPT = join(BUNDLED_PYTHON_DIR, 'render_cli.py')
const CACHE_DIR = join(resolve(API_DIR, env.DATA_DIR), 'renders')

const BLENDER_BIN = process.env.BLENDER_BIN ?? 'blender'
// On headless Linux Eevee needs a GL context; xvfb-run provides a virtual
// display. macOS/dev users have a real display so wrapping isn't needed.
const USE_XVFB = process.env.BLENDER_USE_XVFB !== '0' && process.platform === 'linux'
// Cap renders so a slow Cycles render or hung Blender process can't tie up
// the API thread forever. Blender 4.5 cold-start under xvfb is ~25-40s,
// then the render itself is sub-second for simple shaders.
const RENDER_TIMEOUT_MS = 110_000

mkdirSync(CACHE_DIR, { recursive: true })

export class RenderError extends Error {
    constructor(message: string, public readonly stderr?: string, public readonly exitCode?: number | null) {
        super(message)
        this.name = 'RenderError'
    }
}

export class NoShaderError extends RenderError {
    constructor() {
        super('This tree has nothing renderable - no material output, BSDF, or geometry-nodes group output found.')
        this.name = 'NoShaderError'
    }
}

function hashContent(jsonContent: string): string {
    return createHash('sha256').update(jsonContent).digest('hex').slice(0, 24)
}

// Single-flight: if two requests come in for the same content while one is
// already rendering, the second one waits on the first's promise.
const inFlight = new Map<string, Promise<Buffer>>()

export async function renderShader(jsonContent: string): Promise<{ png: Buffer; cached: boolean; hash: string }> {
    const hash = hashContent(jsonContent)
    const cachedPath = join(CACHE_DIR, `${hash}.png`)
    if (existsSync(cachedPath)) {
        return { png: readFileSync(cachedPath), cached: true, hash }
    }

    const existing = inFlight.get(hash)
    if (existing) {
        const png = await existing
        return { png, cached: false, hash }
    }

    const promise = (async () => {
        const inputPath = join(CACHE_DIR, `${hash}.in.json`)
        const outputPath = cachedPath
        writeFileSync(inputPath, jsonContent, 'utf8')
        try {
            await runBlender(inputPath, outputPath)
            if (!existsSync(outputPath)) {
                throw new RenderError('Blender exited without producing output PNG')
            }
            return readFileSync(outputPath)
        } finally {
            try { unlinkSync(inputPath) } catch { /* best effort */ }
        }
    })()
    inFlight.set(hash, promise)

    try {
        const png = await promise
        return { png, cached: false, hash }
    } finally {
        inFlight.delete(hash)
    }
}

function runBlender(inputPath: string, outputPath: string): Promise<void> {
    return new Promise((resolveOk, reject) => {
        const blenderArgs = [
            '--background',
            '--factory-startup',
            '--python', RENDER_SCRIPT,
            '--',
            inputPath,
            outputPath,
        ]
        // xvfb-run wraps the command in a virtual display server so Eevee has
        // a GL context. We use auto-servernum so concurrent renders don't
        // collide on the same display.
        const [bin, args] = USE_XVFB
            ? ['xvfb-run', ['-a', '--server-args=-screen 0 800x600x24', BLENDER_BIN, ...blenderArgs]]
            : [BLENDER_BIN, blenderArgs]
        const proc = spawn(bin, args, {
            stdio: ['ignore', 'pipe', 'pipe'],
            // Blender needs a writable HOME to read prefs / write config; the
            // systemd unit has ProtectHome=true so we route to /tmp.
            env: { ...process.env, HOME: process.env.HOME || '/tmp' },
        })

        let stderr = ''
        proc.stderr.on('data', (c: Buffer) => { stderr += c.toString('utf8') })
        // Blender chatters a lot on stdout - we mostly ignore it.

        const timeout = setTimeout(() => {
            proc.kill('SIGKILL')
            reject(new RenderError(`Blender render timed out after ${RENDER_TIMEOUT_MS}ms`, stderr))
        }, RENDER_TIMEOUT_MS)

        proc.on('error', (err) => {
            clearTimeout(timeout)
            const msg = (err as NodeJS.ErrnoException).code === 'ENOENT'
                ? 'blender is not installed or not on PATH. Set BLENDER_BIN to the blender executable.'
                : `Failed to spawn blender: ${err.message}`
            reject(new RenderError(msg))
        })

        proc.on('close', (code) => {
            clearTimeout(timeout)
            if (code === 0) return resolveOk()
            // The render script exits 6 specifically when the input has no
            // shader nodes (geometry / compositor trees).
            if (code === 6) return reject(new NoShaderError())
            reject(new RenderError(`Blender exited ${code}`, stderr, code))
        })
    })
}
