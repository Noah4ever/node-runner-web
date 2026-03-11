import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { env } from './env.js'

const DATA_DIR = env.DATA_DIR

// Ensure data directory exists
mkdirSync(DATA_DIR, { recursive: true })

type Serializable = string | number | boolean | null | Serializable[] | { [key: string]: Serializable }

interface StoreOptions {
    /** Save interval in ms (default: 30s) */
    saveInterval?: number
}

/**
 * A JSON-file-backed Map. Loads from disk on creation, saves periodically and on process exit.
 */
export class PersistedMap<V> {
    private map: Map<string, V>
    private filePath: string
    private dirty = false
    private timer: ReturnType<typeof setInterval>

    constructor(name: string, opts?: StoreOptions) {
        this.filePath = join(DATA_DIR, `${name}.json`)
        this.map = new Map()
        this.load()
        this.timer = setInterval(() => this.save(), opts?.saveInterval ?? 30_000)
        shutdownHooks.push(() => this.save())
    }

    get(key: string): V | undefined { return this.map.get(key) }
    set(key: string, value: V): this { this.map.set(key, value); this.dirty = true; return this }
    has(key: string): boolean { return this.map.has(key) }
    delete(key: string): boolean { const r = this.map.delete(key); if (r) this.dirty = true; return r }
    get size(): number { return this.map.size }
    values(): IterableIterator<V> { return this.map.values() }
    entries(): IterableIterator<[string, V]> { return this.map.entries() }
    keys(): IterableIterator<string> { return this.map.keys() }
    forEach(fn: (value: V, key: string) => void): void { this.map.forEach(fn) }
    clear(): void { this.map.clear(); this.dirty = true }

    save(): void {
        if (!this.dirty) return
        try {
            const entries = Array.from(this.map.entries())
            writeFileSync(this.filePath, JSON.stringify(entries), 'utf-8')
            this.dirty = false
        } catch (err) {
            console.error(`[persist] Failed to save ${this.filePath}:`, err)
        }
    }

    private load(): void {
        if (!existsSync(this.filePath)) return
        try {
            const raw = readFileSync(this.filePath, 'utf-8')
            const entries = JSON.parse(raw) as [string, V][]
            for (const [k, v] of entries) this.map.set(k, v)
        } catch (err) {
            console.error(`[persist] Failed to load ${this.filePath}:`, err)
        }
    }

    destroy(): void { clearInterval(this.timer); this.save() }
}

/**
 * A JSON-file-backed Set. Same persistence behavior as PersistedMap.
 */
export class PersistedSet {
    private set: Set<string>
    private filePath: string
    private dirty = false
    private timer: ReturnType<typeof setInterval>

    constructor(name: string, opts?: StoreOptions) {
        this.filePath = join(DATA_DIR, `${name}.json`)
        this.set = new Set()
        this.load()
        this.timer = setInterval(() => this.save(), opts?.saveInterval ?? 30_000)
        shutdownHooks.push(() => this.save())
    }

    has(value: string): boolean { return this.set.has(value) }
    add(value: string): this { this.set.add(value); this.dirty = true; return this }
    delete(value: string): boolean { const r = this.set.delete(value); if (r) this.dirty = true; return r }
    get size(): number { return this.set.size }
    values(): IterableIterator<string> { return this.set.values() }
    clear(): void { this.set.clear(); this.dirty = true }

    save(): void {
        if (!this.dirty) return
        try {
            writeFileSync(this.filePath, JSON.stringify(Array.from(this.set)), 'utf-8')
            this.dirty = false
        } catch (err) {
            console.error(`[persist] Failed to save ${this.filePath}:`, err)
        }
    }

    private load(): void {
        if (!existsSync(this.filePath)) return
        try {
            const raw = readFileSync(this.filePath, 'utf-8')
            const items = JSON.parse(raw) as string[]
            for (const v of items) this.set.add(v)
        } catch (err) {
            console.error(`[persist] Failed to load ${this.filePath}:`, err)
        }
    }

    destroy(): void { clearInterval(this.timer); this.save() }
}

/**
 * A JSON-file-backed Map where values are Sets (e.g., likesStore: slug -> Set<userId>).
 */
export class PersistedMapOfSets {
    private map: Map<string, Set<string>>
    private filePath: string
    private dirty = false
    private timer: ReturnType<typeof setInterval>

    constructor(name: string, opts?: StoreOptions) {
        this.filePath = join(DATA_DIR, `${name}.json`)
        this.map = new Map()
        this.load()
        this.timer = setInterval(() => this.save(), opts?.saveInterval ?? 30_000)
        shutdownHooks.push(() => this.save())
    }

    get(key: string): Set<string> | undefined { return this.map.get(key) }
    set(key: string, value: Set<string>): this { this.map.set(key, value); this.dirty = true; return this }
    has(key: string): boolean { return this.map.has(key) }
    delete(key: string): boolean { const r = this.map.delete(key); if (r) this.dirty = true; return r }
    get size(): number { return this.map.size }
    entries(): IterableIterator<[string, Set<string>]> { return this.map.entries() }

    /** Get or create a Set for the key */
    getOrCreate(key: string): Set<string> {
        let s = this.map.get(key)
        if (!s) { s = new Set(); this.map.set(key, s) }
        return s
    }

    markDirty(): void { this.dirty = true }

    save(): void {
        if (!this.dirty) return
        try {
            const obj: Record<string, string[]> = {}
            for (const [k, v] of this.map.entries()) obj[k] = Array.from(v)
            writeFileSync(this.filePath, JSON.stringify(obj), 'utf-8')
            this.dirty = false
        } catch (err) {
            console.error(`[persist] Failed to save ${this.filePath}:`, err)
        }
    }

    private load(): void {
        if (!existsSync(this.filePath)) return
        try {
            const raw = readFileSync(this.filePath, 'utf-8')
            const obj = JSON.parse(raw) as Record<string, string[]>
            for (const [k, v] of Object.entries(obj)) this.map.set(k, new Set(v))
        } catch (err) {
            console.error(`[persist] Failed to load ${this.filePath}:`, err)
        }
    }

    destroy(): void { clearInterval(this.timer); this.save() }
}

// ── Graceful shutdown ────────────────────────────────────────────────
const shutdownHooks: (() => void)[] = []
let shuttingDown = false

function runShutdownHooks() {
    if (shuttingDown) return
    shuttingDown = true
    console.log('[persist] Saving data before exit...')
    for (const hook of shutdownHooks) {
        try { hook() } catch { /* ignore */ }
    }
}

process.on('SIGINT', () => { runShutdownHooks(); process.exit(0) })
process.on('SIGTERM', () => { runShutdownHooks(); process.exit(0) })
process.on('exit', runShutdownHooks)
