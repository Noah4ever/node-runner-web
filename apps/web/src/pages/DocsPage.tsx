import { useState } from 'react'

const AI_PROMPT = `You generate Blender shader node trees in "Node Runner AI JSON" format. Follow this spec exactly:

{
  "nodes": {
    "<Display Name>": {
      "type": "<bl_idname>",
      "location": [x, y],
      "settings": { "<prop>": "<value>" },
      "inputs": { "<Socket Name>": <value> },
      "outputs": { "<Socket Name>": <value> }
    }
  },
  "links": [
    ["<FromNode>.<OutputSocket>", "<ToNode>.<InputSocket>"]
  ],
  "tree_type": "ShaderNodeTree",
  "name": "<Descriptive Name>"
}

RULES:
- "type" is the Blender bl_idname (e.g. "ShaderNodeBsdfPrincipled", "ShaderNodeMath", "ShaderNodeTexNoise")
- "location" is [x, y] integers. Space nodes ~250px apart horizontally, flow left to right.
- "inputs" uses socket names as keys. Only include inputs you want to change from Blender's defaults. Omit default values.
  - Scalars: "Roughness": 0.3
  - Colors: "Base Color": [R, G, B, 1.0] (4-element RGBA, values 0-1)
  - Vectors: "Location": [x, y, z] (3-element)
- "settings" holds node properties that aren't sockets (e.g. "operation": "MULTIPLY", "blend_type": "MIX", "noise_dimensions": "3D"). Only include non-default settings.
- "outputs" is only needed for ShaderNodeRGB and ShaderNodeValue nodes:
  - RGB: "outputs": {"Color": [R, G, B, 1.0]}
  - Value: "outputs": {"Value": 0.75}
- Links reference node names and socket names with a dot: "Noise Texture.Fac" means the "Fac" output of the node named "Noise Texture".
- Node names in the "nodes" dict must match exactly what you use in links.
- For ShaderNodeMath with multiple "Value" inputs, disambiguate as "Value" (first), "Value 1" (second), "Value 2" (third).
- "tree_type" should be "ShaderNodeTree" for materials or "CompositorNodeTree" for compositing.
- Do not include "blender_version" or "export_name" — those are added automatically.
- color_ramp goes under "settings", not "inputs". Format:
  "settings": {"color_ramp": {"interpolation": "LINEAR", "elements": [{"position": 0.0, "color": [R,G,B,1]}, ...]}}

Common node types: ShaderNodeBsdfPrincipled, ShaderNodeBsdfGlass, ShaderNodeEmission, ShaderNodeMixShader, ShaderNodeOutputMaterial, ShaderNodeTexNoise, ShaderNodeTexVoronoi, ShaderNodeTexWave, ShaderNodeTexChecker, ShaderNodeTexImage, ShaderNodeTexGradient, ShaderNodeTexBrick, ShaderNodeMapping, ShaderNodeTexCoord, ShaderNodeMath, ShaderNodeVectorMath, ShaderNodeMix, ShaderNodeMixRGB, ShaderNodeMapRange, ShaderNodeValToRGB, ShaderNodeBump, ShaderNodeNormalMap, ShaderNodeDisplacement, ShaderNodeHueSaturation, ShaderNodeBrightContrast, ShaderNodeGamma, ShaderNodeInvert, ShaderNodeRGBCurve, ShaderNodeSeparateXYZ, ShaderNodeCombineXYZ, ShaderNodeSeparateColor, ShaderNodeCombineColor, ShaderNodeClamp, ShaderNodeFresnel, ShaderNodeLayerWeight, ShaderNodeValue, ShaderNodeRGB, ShaderNodeVectorRotate.

Output ONLY the JSON. No explanation, no code fences.`

const FAQ = [
    {
        q: 'What versions of Blender are supported?',
        a: 'Node Runner requires Blender 4.5 or newer.',
    },
    {
        q: 'Which node tree types are supported?',
        a: 'All Blender node tree types are supported.',
    },
    {
        q: 'What is the Hash format?',
        a: 'Hash is a compact encoding that compresses your node tree with zlib and encodes it in base64. It produces the smallest output, ideal for sharing in chat, comments, or URLs.',
    },
    {
        q: 'Can I import a node tree back into Blender?',
        a: 'Yes. Copy the exported data (any format), then right-click > Node Runner > Import in Blender. The addon will detect the format and recreate the nodes.',
    },
    {
        q: 'Is there a size limit?',
        a: 'The web platform accepts node tree data up to 100 KB. For very large trees, use the Hash format to reduce size.',
    },
    {
        q: 'How do share links work?',
        a: 'When you create a share link, your node tree is saved on the server with a unique URL. Anyone with the link can view the graph and copy the data. No account is required for anonymous sharing.',
    },
]

export function DocsPage() {
    const [copied, setCopied] = useState(false)
    const [openFaq, setOpenFaq] = useState<number | null>(null)

    function copyPrompt() {
        navigator.clipboard.writeText(AI_PROMPT)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    return (
        <div className="mx-auto max-w-3xl px-6 py-16">
            <h1 className="text-3xl font-bold tracking-tight">Documentation</h1>
            <p className="mt-2 text-[var(--color-text-muted)] leading-relaxed">
                Learn how to use the Node Runner Blender addon to export, share, and manage node trees.
            </p>

            <div className="mt-12 space-y-14">
                {/* Getting Started */}
                <section>
                    <h2 className="text-lg font-semibold mb-4">Getting Started</h2>
                    <div className="space-y-4">
                        {[
                            {
                                step: '1',
                                title: 'Install the addon',
                                desc: <>Get the latest release from <a href="https://extensions.blender.org/add-ons/node-runner/" target="_blank" rel="noopener noreferrer" className="text-[var(--color-accent)] hover:underline">Blender Extensions</a>. Works with Blender 4.5+.</>,
                            },
                            {
                                step: '2',
                                title: 'Export your nodes',
                                desc: 'Select nodes in Blender, right-click > Node Runner > Export. Pick a name and format — the data is copied to your clipboard.',
                            },
                            {
                                step: '3',
                                title: 'Use the data',
                                desc: 'Paste it here to inspect, convert between formats, share with others, or feed it to an AI for explanations and remixing.',
                            },
                            {
                                step: '4',
                                title: 'Import back',
                                desc: 'Copy any exported data, then right-click > Node Runner > Import inside Blender. The addon auto-detects the format and rebuilds the node tree.',
                            },
                        ].map((item) => (
                            <div key={item.step} className="flex gap-4">
                                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent)] text-xs font-bold text-black">
                                    {item.step}
                                </div>
                                <div>
                                    <h3 className="text-sm font-medium">{item.title}</h3>
                                    <p className="mt-0.5 text-sm text-[var(--color-text-muted)]">{item.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>


                {/* AI Prompt */}
                <section>
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <h2 className="text-lg font-semibold">AI Prompt</h2>
                            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                                Paste this system prompt into ChatGPT, Claude, or any LLM to generate node trees you can import directly.
                            </p>
                        </div>
                        <button
                            onClick={copyPrompt}
                            className="inline-flex items-center gap-1.5 shrink-0 rounded-md bg-[var(--color-surface)] px-3.5 py-2 text-xs font-medium text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)] cursor-pointer"
                        >
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                            {copied ? 'Copied!' : 'Copy'}
                        </button>
                    </div>
                    <pre className="mt-3 rounded-lg bg-[var(--color-surface)] p-4 font-mono text-xs text-[var(--color-text-muted)] overflow-x-auto max-h-80 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                        {AI_PROMPT}
                    </pre>
                </section>


                {/* Export Formats */}
                <section>
                    <h2 className="text-lg font-semibold mb-4">Export Formats</h2>
                    <div className="grid gap-3 sm:grid-cols-2">
                        {([
                            ['Hash', 'Compressed with zlib, encoded as base64. Smallest output. Great for chat, comments, and URLs.'],
                            ['JSON', 'Full JSON with all node data, positions, and settings. Ideal for programmatic use and tooling.'],
                            ['XML', 'Typed XML with round-trip fidelity. Useful for XML-based workflows and integrations.'],
                            ['AI JSON', 'Compact, human-readable format designed for LLMs. Perfect for generating or explaining node trees with ChatGPT, Claude, etc.'],
                        ] as const).map(([name, desc]) => (
                            <div key={name} className="rounded-lg bg-[var(--color-surface)] p-4">
                                <h3 className="text-sm font-semibold">{name}</h3>
                                <p className="mt-1 text-xs text-[var(--color-text-muted)] leading-relaxed">{desc}</p>
                            </div>
                        ))}
                    </div>
                </section>

                {/* FAQ */}
                <section>
                    <h2 className="text-lg font-semibold mb-4">FAQ</h2>
                    <div className="divide-y divide-[var(--color-border)]">
                        {FAQ.map(({ q, a }, i) => (
                            <button
                                key={q}
                                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                                className="w-full text-left py-4 cursor-pointer"
                            >
                                <div className="flex items-center justify-between gap-4">
                                    <h3 className="text-sm font-medium">{q}</h3>
                                    <svg className={`h-4 w-4 shrink-0 text-[var(--color-text-faint)] transition-transform ${openFaq === i ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                                </div>
                                {openFaq === i && (
                                    <p className="mt-2 text-sm text-[var(--color-text-muted)] leading-relaxed">{a}</p>
                                )}
                            </button>
                        ))}
                    </div>
                </section>
            </div>
        </div>
    )
}
