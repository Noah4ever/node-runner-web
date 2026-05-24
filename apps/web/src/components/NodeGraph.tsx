import { useMemo, useState } from 'react'
import ReactFlow, { Background, Controls, MiniMap, Panel, Position, type Node, type Edge } from 'reactflow'
import 'reactflow/dist/style.css'
import type { NodeTree } from '@node-runner/shared'

const nodeTypes = {}
const edgeTypes = {}

// Blender-accurate node colors by category. Order matters - more specific
// checks must come first. The Blender prefix (ShaderNode / GeometryNode /
// CompositorNode / FunctionNode / TextureNode) is stripped before matching
// so the same rules cover all tree types.
function getNodeColor(type: string): string {
    // Strip tree-type prefix so rules apply to shader/geometry/compositor alike
    const t = type
        .replace(/^ShaderNode/, '')
        .replace(/^GeometryNode/, '')
        .replace(/^CompositorNode/, '')
        .replace(/^FunctionNode/, '')
        .replace(/^TextureNode/, '')

    // Group / I/O
    if (t.includes('GroupInput') || t.includes('GroupOutput') || t === 'Group') return '#5a5a5a'
    if (t.includes('Output')) return '#6e1818'

    // Geometry-nodes-specific categories
    if (t.includes('SetPosition') || t.includes('SetMaterial') || t.includes('SetShade') || t.includes('SetID') || t.includes('SetCurve') || t.includes('SetPoint') || t.includes('SetCorner') || t.includes('SetEdge') || t.includes('SetFace') || t.includes('SetSpline')) return '#3a5a7a'
    if (t.includes('MeshPrimitive') || t.includes('CurvePrimitive') || t.includes('PointsToVertices') || t.includes('MeshToPoints') || t.includes('MeshToCurve') || t.includes('CurveToMesh') || t.includes('CurveToPoints') || t.includes('Instance') || t.includes('Realize')) return '#446677'
    if (t.includes('Distribute') || t.includes('Scatter') || t.includes('Subdivide') || t.includes('Triangulate') || t.includes('Extrude') || t.includes('Bevel') || t.includes('Boolean') || t.includes('Delete') || t.includes('Duplicate') || t.includes('Merge') || t.includes('Flip') || t.includes('Fillet') || t.includes('Resample') || t.includes('Trim') || t.includes('Reverse') || t.includes('Smooth')) return '#3d6b3d'
    if (t.includes('CaptureAttribute') || t.includes('StoreAttribute') || t.includes('RemoveAttribute') || t.includes('NamedAttribute') || t.includes('Attribute')) return '#7b5a3b'
    if (t.includes('FieldAtIndex') || t.includes('FieldOnDomain') || t.includes('Index') || t.includes('Position') || t.includes('Normal') || t.includes('Radius') || t.includes('Random') || t.includes('Domain')) return '#5d5d7b'
    if (t.includes('Repeat') || t.includes('Simulation') || t.includes('ForEach') || t.includes('Switch') || t.includes('Compare') || t.includes('Menu')) return '#7b4a6b'

    // Shader-tree groupings
    if (t.includes('Bsdf') || t.includes('MixShader') || t.includes('AddShader') || t.includes('Emission') || t.includes('Absorption') || t.includes('Volume') || t.includes('Holdout') || t.includes('Background')) return '#2d5a27'
    if (t.includes('Bump') || t.includes('Displacement') || t.includes('Mapping') || t.includes('VectorRotate') || t.includes('VectorMath') || t.includes('VectorCurve') || t.includes('VectorTransform') || t.includes('Vector')) return '#573b7b'
    if (t.includes('TexCoord')) return '#994040'
    if (t.includes('Tex') && !t.includes('Coordinate')) return '#b5631a'
    if (t.includes('ValToRGB') || t.includes('ColorRamp') || t.includes('Math') || t.includes('MapRange') || t.includes('Clamp') || t.includes('Separate') || t.includes('Combine')) return '#3b6075'
    if (t.includes('MixRGB') || t.includes('Hue') || t.includes('Bright') || t.includes('Gamma') || t.includes('Invert') || t.includes('RGBCurve') || t.includes('Mix')) return '#6e6e2d'
    if (t.includes('Layer') || t.includes('Fresnel') || t.includes('RGB') || t.includes('Value') || t.includes('Wireframe') || t.includes('ObjectInfo') || t.includes('CameraData') || t.includes('LightPath') || t.includes('AmbientOcclusion') || t.includes('Tangent')) return '#994040'

    // Compositor-specific
    if (t.includes('Filter') || t.includes('Blur') || t.includes('Glare') || t.includes('SunBeams') || t.includes('LensDistortion')) return '#5a4e7a'
    if (t.includes('Mask') || t.includes('Alpha') || t.includes('Keying') || t.includes('ColorSpill') || t.includes('Despeckle')) return '#7b6f3b'

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
    // Fires when the user clicks a node. Receives the node name (which equals the
    // key in tree.nodes). Pass undefined to disable click handling.
    onNodeClick?: (name: string | null) => void
    selectedNode?: string | null
}

export function NodeGraph({ tree, className = '', compact = false, onNodeClick, selectedNode }: NodeGraphProps) {
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
                    border: selectedNode === name ? '2px solid #fff' : '1px solid #555',
                    boxShadow: selectedNode === name ? '0 0 0 3px rgba(255,180,0,0.35)' : undefined,
                    borderRadius: '4px',
                    padding: '6px 10px',
                    minWidth: '120px',
                    fontSize: '10px',
                    cursor: onNodeClick ? 'pointer' : 'default',
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
    }, [tree, selectedNode, onNodeClick])

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
                onNodeClick={onNodeClick ? (_e, node) => onNodeClick(node.id) : undefined}
                onPaneClick={onNodeClick ? () => onNodeClick(null) : undefined}
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
