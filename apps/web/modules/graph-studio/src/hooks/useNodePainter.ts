import { useCallback } from 'react'
import { CATEGORY_COLORS, PROJECT_NODE_COLOR, BRIDGE_COLORS, THEME } from '../constants/colors'
import { LOD_THRESHOLDS } from '../constants/config'
import type { GraphNode } from '../types/graph'

const TWO_PI = 2 * Math.PI

interface PainterOptions {
  selectedNodeId: string | null
  hoveredNodeId: string | null
  searchHighlights: Set<string>
  pathSet: Set<string>
  chainSet: Set<string>
  highlightSet: Set<string> | null
  explorationStackIds: Set<string>
}

export function useNodePainter(options: PainterOptions) {
  const {
    selectedNodeId,
    hoveredNodeId,
    searchHighlights,
    pathSet,
    chainSet,
    highlightSet,
    explorationStackIds,
  } = options

  return useCallback((node: GraphNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const x = node.x ?? 0
    const y = node.y ?? 0
    const radius = node.__radius || 8
    const color = node.__type === 'project'
      ? PROJECT_NODE_COLOR
      : (CATEGORY_COLORS[node.category] || '#6B7280')

    const hasActiveHighlight = highlightSet !== null && highlightSet.size > 0
    const pathActive = pathSet.size > 0
    const chainActive = chainSet.size > 0
    const isInHighlight = highlightSet?.has(node.id) ?? false
    const isInPath = pathSet.has(node.name)
    const isInChain = chainSet.has(node.name)
    const isDimmed = (hasActiveHighlight || pathActive || chainActive) && !isInHighlight && !isInPath && !isInChain

    if (isDimmed) ctx.globalAlpha = 0.16

    if (globalScale < LOD_THRESHOLDS.dot) {
      ctx.fillStyle = color
      ctx.fillRect(x - 1, y - 1, 2, 2)
      ctx.globalAlpha = 1
      return
    }

    if (node.__bridgeTier !== 'none') {
      const glowColor = BRIDGE_COLORS[node.__bridgeTier]
      if (glowColor && glowColor !== 'transparent') {
        const glowRadius = node.__bridgeTier === 'gold' ? radius + 8 : node.__bridgeTier === 'silver' ? radius + 6 : radius + 4
        const gradient = ctx.createRadialGradient(x, y, radius, x, y, glowRadius)
        gradient.addColorStop(0, `${glowColor}33`)
        gradient.addColorStop(1, `${glowColor}00`)
        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.arc(x, y, glowRadius, 0, TWO_PI)
        ctx.fill()
      }
    }

    if (node.__bridgeTier !== 'none') {
      const ringColor = BRIDGE_COLORS[node.__bridgeTier]
      if (ringColor && ringColor !== 'transparent') {
        const lineWidth = node.__bridgeTier === 'gold' ? 2.2 : node.__bridgeTier === 'silver' ? 1.8 : 1.3
        ctx.strokeStyle = ringColor
        ctx.lineWidth = lineWidth / globalScale
        ctx.beginPath()
        ctx.arc(x, y, radius + 2, 0, TWO_PI)
        ctx.stroke()
      }
    }

    if (node.__type === 'project') {
      const side = radius * 2
      ctx.beginPath()
      ctx.roundRect(x - radius, y - radius, side, side, 4)
      ctx.fillStyle = color
      ctx.fill()
    } else {
      ctx.beginPath()
      ctx.arc(x, y, radius, 0, TWO_PI)
      ctx.fillStyle = color
      ctx.fill()
    }

    const isSelected = node.id === selectedNodeId
    const isInStack = explorationStackIds.has(node.id)

    if (isSelected || isInStack) {
      ctx.strokeStyle = isSelected ? '#38bdf8' : 'rgba(255, 255, 255, 0.25)'
      ctx.lineWidth = (isSelected ? 2 : 1.2) / globalScale
      ctx.beginPath()
      if (node.__type === 'project') {
        const side = (radius + 1) * 2
        ctx.roundRect(x - radius - 1, y - radius - 1, side, side, 5)
      } else {
        ctx.arc(x, y, radius + 1, 0, TWO_PI)
      }
      ctx.stroke()
    }

    if (searchHighlights.has(node.name)) {
      ctx.strokeStyle = THEME.warning
      ctx.lineWidth = 1.5 / globalScale
      ctx.beginPath()
      ctx.arc(x, y, radius + 3, 0, TWO_PI)
      ctx.stroke()
    }

    if (isInPath) {
      ctx.strokeStyle = '#38bdf8'
      ctx.lineWidth = 2 / globalScale
      ctx.beginPath()
      ctx.arc(x, y, radius + 3, 0, TWO_PI)
      ctx.stroke()
    }

    if (isInChain) {
      const chainGlowRadius = radius + 6
      const gradient = ctx.createRadialGradient(x, y, radius, x, y, chainGlowRadius)
      gradient.addColorStop(0, 'rgba(56, 189, 248, 0.12)')
      gradient.addColorStop(1, 'rgba(56, 189, 248, 0)')
      ctx.fillStyle = gradient
      ctx.beginPath()
      ctx.arc(x, y, chainGlowRadius, 0, TWO_PI)
      ctx.fill()

      ctx.strokeStyle = '#a78bfa'
      ctx.lineWidth = 2 / globalScale
      ctx.beginPath()
      ctx.arc(x, y, radius + 3, 0, TWO_PI)
      ctx.stroke()
    }

    const isHovered = node.id === hoveredNodeId
    const showLabel = (
      globalScale > LOD_THRESHOLDS.label ||
      node.__type === 'project' ||
      node.__bridgeTier === 'gold' ||
      node.__bridgeTier === 'silver' ||
      isSelected ||
      isHovered
    )

    if (showLabel && globalScale >= LOD_THRESHOLDS.dot) {
      const fontSize = Math.max(3.2, Math.min(11.5, 10.5 / globalScale + 1.25))
      ctx.font = `500 ${fontSize}px Inter, ui-sans-serif, system-ui, sans-serif`
      ctx.fillStyle = 'rgba(248, 250, 252, 0.85)'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.shadowColor = 'rgba(0, 0, 0, 0.95)'
      ctx.shadowBlur = 6 / globalScale
      ctx.fillText(node.name, x, y + radius + 2 / globalScale)
      ctx.shadowBlur = 0
    }

    if (isDimmed) ctx.globalAlpha = 1
  }, [
    selectedNodeId, hoveredNodeId, searchHighlights,
    pathSet, chainSet, highlightSet, explorationStackIds,
  ])
}
