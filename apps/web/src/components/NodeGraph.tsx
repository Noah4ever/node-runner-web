import { useMemo } from 'react'
import ReactFlow, { Background, Position, type Node, type Edge } from 'reactflow'
import 'reactflow/dist/style.css'
import type { NodeTree } from '@node-runner/shared'

const nodeTypes = {}
const edgeTypes = {}

// Blender-accurate node colors by category
// NOTE: All shader-tree nodes start with "ShaderNode", so never match on "Shader" broadly.
// Order matters — more specific checks must come before broader ones.
function getNodeColor(type: string): string {
    // Output nodes — wine red
    if (type.includes('Output')) return '#6e1818'
    // Shader/BSDF nodes — green (specific names only, NOT "Shader" which matches all ShaderNode*)
    if (type.includes('Bsdf') || type.includes('MixShader') || type.includes('AddShader') || type.includes('Emission') || type.includes('Absorption') || type.includes('Scatter')) return '#2d5a27'
    // Vector nodes — purple (before Tex/Math to avoid VectorMath→Math, Mapping→Map false matches)
    if (type.includes('Bump') || type.includes('Normal') || type.includes('Displacement') || type.includes('Mapping') || type.includes('VectorRotate') || type.includes('VectorMath') || type.includes('VectorCurve') || type.includes('Vector')) return '#573b7b'
    // Input: TexCoord — must check before Tex
    if (type.includes('TexCoord')) return '#994040'
    // Texture nodes — orange
    if (type.includes('Tex')) return '#b5631a'
    // Converter nodes — light blue
    if (type.includes('ValToRGB') || type.includes('ColorRamp') || type.includes('Math') || type.includes('MapRange') || type.includes('Clamp') || type.includes('Separate') || type.includes('Combine')) return '#3b6075'
    // Color nodes — yellow-olive
    if (type.includes('MixRGB') || type.includes('Hue') || type.includes('Bright') || type.includes('Gamma') || type.includes('Invert') || type.includes('RGBCurve') || type.includes('Mix')) return '#6e6e2d'
    // Input nodes — pink/salmon
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
}

export function NodeGraph({ tree, className = '' }: NodeGraphProps) {
    const { nodes, edges } = useMemo(() => {
        const entries = Object.entries(tree.nodes)
        if (entries.length === 0) return { nodes: [], edges: [] }

        const flowNodes: Node[] = entries.map(([name, data], i) => {
            // Handle both {x,y} objects and [x,y] arrays
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
                attributionPosition="bottom-left"
                proOptions={{ hideAttribution: true }}
                nodesDraggable={false}
                nodesConnectable={false}
                elementsSelectable={false}
                panOnDrag
                zoomOnScroll
            >
                <Background color="#222" gap={20} size={1} />
            </ReactFlow>
        </div>
    )
}
