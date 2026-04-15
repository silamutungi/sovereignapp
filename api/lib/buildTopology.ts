// Static topology extractor for generated apps.
// Parses page files into nodes and navigation links into edges.
// Pure analysis — no AI, no API calls. Runs in <100ms on a typical scaffold.
//
// Called from api/generate.ts at generation time and from api/run-build.ts
// to persist app_topology to the builds table. Injected into the Haiku
// classifier prompt in api/edit.ts so file-identification is structurally
// informed instead of guessing.

export interface TopologyNode {
  id: string        // kebab-case page id
  name: string      // component name
  route: string     // URL path
  filePath: string  // src/pages/...
}

export interface TopologyEdge {
  from: string      // node id
  to: string        // node id
  type: 'click' | 'redirect' | 'programmatic'
  label?: string    // link text or description if extractable
}

export interface AppTopology {
  nodes: TopologyNode[]
  edges: TopologyEdge[]
  orphanPages: string[]
  warnings: string[]
}

// Map<route, componentName> — populated from <Route path="..." element={<X />} />
function extractRoutes(files: Record<string, string>): Map<string, string> {
  const routeMap = new Map<string, string>()

  for (const content of Object.values(files)) {
    const routeMatches = content.matchAll(
      /<Route\s+[^>]*path=["']([^"']+)["'][^>]*element=\{<([A-Z][A-Za-z0-9]+)/g,
    )
    for (const match of routeMatches) {
      routeMap.set(match[1], match[2])
    }
  }

  return routeMap
}

function fileNameToId(fileName: string): string {
  return fileName
    .replace(/([A-Z])/g, '-$1')
    .toLowerCase()
    .replace(/^-/, '')
}

function extractLinks(
  filePath: string,
  content: string,
  nodesByRoute: Map<string, TopologyNode>,
): TopologyEdge[] {
  const edges: TopologyEdge[] = []

  const fileName = filePath.split('/').pop()?.replace('.tsx', '') ?? ''
  const sourceId = fileNameToId(fileName)

  // <Link to="..."> and <NavLink to="...">
  const linkMatches = content.matchAll(
    /<(?:Link|NavLink)\s+[^>]*to=["']([^"']+)["']/g,
  )
  for (const match of linkMatches) {
    const targetRoute = match[1]
    const targetNode = nodesByRoute.get(targetRoute)
    if (targetNode && targetNode.id !== sourceId) {
      edges.push({ from: sourceId, to: targetNode.id, type: 'click' })
    }
  }

  // navigate('/...') — programmatic navigation via React Router
  const navMatches = content.matchAll(/navigate\(\s*['"]([^'"]+)['"]/g)
  for (const match of navMatches) {
    const targetRoute = match[1]
    const targetNode = nodesByRoute.get(targetRoute)
    if (targetNode && targetNode.id !== sourceId) {
      edges.push({ from: sourceId, to: targetNode.id, type: 'programmatic' })
    }
  }

  // <Navigate to="..." /> — declarative redirects
  const redirectMatches = content.matchAll(
    /<Navigate\s+[^>]*to=["']([^"']+)["']/g,
  )
  for (const match of redirectMatches) {
    const targetRoute = match[1]
    const targetNode = nodesByRoute.get(targetRoute)
    if (targetNode && targetNode.id !== sourceId) {
      edges.push({ from: sourceId, to: targetNode.id, type: 'redirect' })
    }
  }

  return edges
}

function detectOrphans(
  nodes: TopologyNode[],
  edges: TopologyEdge[],
): string[] {
  const rootRoutes = new Set(['/', '/home', '/index'])
  const reachable = new Set<string>()

  // Root pages are always reachable
  for (const node of nodes) {
    if (rootRoutes.has(node.route)) reachable.add(node.id)
  }

  // Pages reachable via any incoming edge
  for (const edge of edges) {
    reachable.add(edge.to)
  }

  return nodes.filter((n) => !reachable.has(n.id)).map((n) => n.id)
}

export function buildTopology(files: Record<string, string>): AppTopology {
  const warnings: string[] = []

  const nodes: TopologyNode[] = []
  const nodesByRoute = new Map<string, TopologyNode>()
  const routeMap = extractRoutes(files)

  // Build nodes from page files
  for (const filePath of Object.keys(files)) {
    if (!/^src\/pages\/[A-Z][^/]*\.tsx$/.test(filePath)) continue

    const fileName = filePath.split('/').pop()?.replace('.tsx', '') ?? ''
    const id = fileNameToId(fileName)

    // Find route for this component from the router file
    let route = `/${id}`
    for (const [r, component] of routeMap.entries()) {
      if (component === fileName) {
        route = r
        break
      }
    }

    const node: TopologyNode = { id, name: fileName, route, filePath }
    nodes.push(node)
    nodesByRoute.set(route, node)
  }

  // Extract edges from every .tsx file (pages, components, layouts can all link)
  const allEdges: TopologyEdge[] = []
  for (const [filePath, content] of Object.entries(files)) {
    if (!filePath.endsWith('.tsx')) continue
    const fileEdges = extractLinks(filePath, content, nodesByRoute)
    allEdges.push(...fileEdges)
  }

  // Deduplicate (same from→to→type)
  const seen = new Set<string>()
  const edges = allEdges.filter((e) => {
    const key = `${e.from}\u2192${e.to}\u2192${e.type}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  if (nodes.length === 0) {
    warnings.push('No page files found in src/pages/')
  }
  if (edges.length === 0 && nodes.length > 1) {
    warnings.push('No navigation links detected between pages')
  }

  const orphanPages = detectOrphans(nodes, edges)
  if (orphanPages.length > 0) {
    warnings.push(
      `Orphan pages detected (unreachable): ${orphanPages.join(', ')}`,
    )
  }

  return { nodes, edges, orphanPages, warnings }
}
