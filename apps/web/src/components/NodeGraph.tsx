import { useMemo, useState } from 'react'
import ReactFlow, { Background, Controls, MiniMap, Panel, Position, type Node, type Edge } from 'reactflow'
import 'reactflow/dist/style.css'
import type { NodeTree } from '@node-runner/shared'

const nodeTypes = {}
const edgeTypes = {}

// Blender-accurate node colors by category
// NOTE: All shader-tree nodes start with "ShaderNode", so never match on "Shader" broadly.
// Order matters - more specific checks must come before broader ones.
function getNodeColor(type: string): string {
    if (type.includes('Output')) return '#6e1818'
    if (type.includes('Bsdf') || type.includes('MixShader') || type.includes('AddShader') || type.includes('Emission') || type.includes('Absorption') || type.includes('Scatter')) return '#2d5a27'
    if (type.includes('Bump') || type.includes('Normal') || type.includes('Displacement') || type.includes('Mapping') || type.includes('VectorRotate') || type.includes('VectorMath') || type.includes('VectorCurve') || type.includes('Vector')) return '#573b7b'
    if (type.includes('TexCoord')) return '#994040'
    if (type.includes('Tex')) return '#b5631a'
    if (type.includes('ValToRGB') || type.includes('ColorRamp') || type.includes('Math') || type.includes('MapRange') || type.includes('Clamp') || type.includes('Separate') || type.includes('Combine')) return '#3b6075'
    if (type.includes('MixRGB') || type.includes('Hue') || type.includes('Bright') || type.includes('Gamma') || type.includes('Invert') || type.includes('RGBCurve') || type.includes('Mix')) return '#6e6e2d'
    if (type.includes('Layer') || type.includes('Fresnel') || type.includes('RGB') || type.includes('Value') || type.includes('Wireframe') || type.includes('ObjectInfo') || type.includes('CameraData') || type.includes('LightPath') || type.includes('AmbientOcclusion')) return '#994040'
    return '#4a4a4a'
}

function getShortType(type: string): string {
    return type
        .replace('ShaderNode', '')
        .replace('CompositorNode', '')
        .replace('GeometryNode', '')
        .replace(/([A-Z])/g, ' $1')
        .trim()
}

interface NodeGraphProps {
    tree: NodeTree
    className?: string
    // Compact = no controls/minimap (used for thumbnail previews in cards)
    compact?: boolean
}

export function NodeGraph({ tree, className = '', compact = false }: NodeGraphProps) {
    const [miniMapOpen, setMiniMapOpen] = useState(true)
    const { nodes, edges } = useMemo(() => {
        const entries = Object.entries(tree.nodes)
        if (entries.length === 0) return { nodes: [], edges: [] }

        const flowNodes: Node[] = entries.map(([name, data], i) => {
            const loc = data.location as unknown
            let x: number, y: number
            if (Array.isArray(loc)) {
                x = (loc[0] as number) ?? i * 250
                y = (loc[1] as number) ?? 0
            } else if (loc && typeof loc === 'object' && 'x' in loc) {
                x = (loc as { x: number; y: number }).x ?? i * 250
                y = (loc as { x: number; y: number }).y ?? 0
            } else {
                x = i * 250
                y = 0
            }
            return {
                id: name,
                position: { x, y: -y }, // Blender Y is inverted
                sourcePosition: Position.Right,
                targetPosition: Position.Left,
                data: {
                    label: (
                        <div className="text-left">
                            <div className="text-[10px] font-semibold text-white truncate max-w-[160px]">{data.label || name}</div>
                            <div className="text-[9px] text-gray-400">{getShortType(data.type)}</div>
                        </div>
                    ),
                },
                style: {
                    background: getNodeColor(data.type),
                    border: '1px solid #555',
                    borderRadius: '4px',
                    padding: '6px 10px',
                    minWidth: '120px',
                    fontSize: '10px',
                },
            }
        })

        const flowEdges: Edge[] = tree.links.map((link, i) => ({
            id: `e${i}`,
            source: link.fromNode,
            target: link.toNode,
            sourceHandle: link.fromSocket,
            targetHandle: link.toSocket,
            style: { stroke: '#777', strokeWidth: 1.5 },
            animated: false,
        }))

        return { nodes: flowNodes, edges: flowEdges }
    }, [tree])

    if (nodes.length === 0) {
        return (
            <div className={`flex items-center justify-center text-sm text-[var(--color-text-faint)] ${className}`}>
                No nodes to display
            </div>
        )
    }

    return (
        <div className={className} style={{ minHeight: '300px' }}>
            <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                fitView
                fitViewOptions={{ padding: 0.2, minZoom: 0.05, maxZoom: 1.5 }}
                minZoom={0.05}
                maxZoom={4}
                attributionPosition="bottom-left"
                proOptions={{ hideAttribution: true }}
                nodesDraggable={false}
                nodesConnectable={false}
                elementsSelectable={!compact}
                panOnDrag
                panOnScroll={!compact}
                zoomOnScroll
                zoomOnPinch
                zoomOnDoubleClick={!compact}
            >
                <Background color="#222" gap={20} size={1} />
                {!compact && (
                    <>
                        <Controls showInteractive={false} position="bottom-right" />
                        <Panel position="bottom-left" style={{ margin: '8px' }}>
                            {miniMapOpen ? (
                                <div className="flex flex-col items-start gap-1">
                                    <button
                                        type="button"
                                        onClick={() => setMiniMapOpen(false)}
                                        aria-label="Hide minimap"
                                        title="Hide minimap"
                                        className="inline-flex items-center gap-1 rounded-md border border-[#333] bg-[#0a0a0a]/90 px-1.5 py-0.5 text-[10px] text-white/70 hover:text-white cursor-pointer"
                                    >
                                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                                        Hide
                                    </button>
                                    <MiniMap
                                        pannable
                                        zoomable
                                        nodeColor={(n) => (n.style as { background?: string } | undefined)?.background ?? '#4a4a4a'}
                                        maskColor="rgba(0,0,0,0.6)"
                                        style={{ position: 'relative', background: '#0a0a0a', border: '1px solid #333', margin: 0 }}
                                    />
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => setMiniMapOpen(true)}
                                    aria-label="Show minimap"
                                    title="Show minimap"
                                    className="inline-flex items-center gap-1 rounded-md border border-[#333] bg-[#0a0a0a]/90 px-2 py-1 text-[10px] text-white/70 hover:text-white cursor-pointer"
                                >
                                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 7a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7zm5 4h8m-8 4h5" /></svg>
                                    Minimap
                                </button>
                            )}
                        </Panel>
                    </>
                )}
            </ReactFlow>
        </div>
    )
}
