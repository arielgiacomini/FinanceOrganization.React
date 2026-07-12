'use client'

import { useMemo } from 'react'
import { X } from 'lucide-react'

interface CategoryFilterProps {
  categories: string[]
  selectedPath: string[]
  onPathChange: (path: string[]) => void
}

/** Retorna os filhos diretos de `path` dentro de `categories`. */
function getChildrenAt(categories: string[], path: string[]): string[] {
  const seen: Record<string, boolean> = {}
  const result: string[] = []
  for (const cat of categories) {
    const segs = cat.split(':').map(s => s.trim()).filter(Boolean)
    if (segs.length <= path.length) continue
    if (path.length > 0 && !path.every((seg, i) => segs[i] === seg)) continue
    const next = segs[path.length]
    if (!seen[next]) { seen[next] = true; result.push(next) }
  }
  return result.sort()
}

/** Filtra um registro pela seleção de path (N níveis). */
export function matchesCategory(cat: string | undefined | null, path: string[]): boolean {
  if (!path.length) return true
  if (!cat) return false
  const segs = cat.split(':').map(s => s.trim())
  if (segs.length < path.length) return false
  return path.every((seg, i) => segs[i] === seg)
}

/** @deprecated Mantido para compatibilidade — preferir matchesCategory com path[]. */
export function parseCategory(cat?: string | null): { group: string; sub: string } {
  if (!cat) return { group: '', sub: '' }
  const idx = cat.indexOf(':')
  if (idx === -1) return { group: cat.trim(), sub: '' }
  return { group: cat.slice(0, idx).trim(), sub: cat.slice(idx + 1).trim() }
}

export function CategoryFilter({ categories, selectedPath, onPathChange }: CategoryFilterProps) {
  // Deriva os níveis a renderizar: nível 0 sempre; nível N+1 se houver filhos no nível N selecionado
  const levels = useMemo(() => {
    const result: string[][] = [getChildrenAt(categories, [])]
    for (let d = 0; d < selectedPath.length; d++) {
      const children = getChildrenAt(categories, selectedPath.slice(0, d + 1))
      if (children.length > 0) result.push(children)
    }
    return result
  }, [categories, selectedPath])

  if (levels[0].length === 0) return null

  return (
    <div className="space-y-2">
      {levels.map((options, depth) => (
        <div
          key={depth}
          className="flex flex-wrap items-center gap-1.5"
          style={depth > 0 ? { paddingLeft: depth * 10 } : {}}
        >
          <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-3)' }}>
            {depth === 0 ? 'Categoria:' : '↳'}
          </span>

          {options.map(opt => {
            const isActive = selectedPath[depth] === opt
            const isAncestor = !isActive && selectedPath.length > depth && selectedPath[depth] === opt

            return (
              <button
                key={opt}
                type="button"
                onClick={() => {
                  if (isActive) onPathChange(selectedPath.slice(0, depth))
                  else onPathChange([...selectedPath.slice(0, depth), opt])
                }}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all"
                style={{
                  background: isActive || isAncestor
                    ? depth === 0 ? 'var(--green-dim)' : 'rgba(96,165,250,0.12)'
                    : 'var(--bg-3)',
                  color: isActive || isAncestor
                    ? depth === 0 ? 'var(--green-400)' : 'var(--blue)'
                    : depth === 0 ? 'var(--text-2)' : 'var(--text-3)',
                  border: `1px solid ${isActive || isAncestor
                    ? depth === 0 ? 'var(--green-border)' : 'rgba(96,165,250,0.35)'
                    : 'var(--border-1)'}`,
                }}
              >
                {opt}
                {isActive && <X size={10} style={{ marginLeft: 2 }} />}
              </button>
            )
          })}

          {/* Botão Limpar apenas na linha do nível 0 */}
          {depth === 0 && selectedPath.length > 0 && (
            <button
              type="button"
              onClick={() => onPathChange([])}
              className="text-xs px-2 py-1 rounded-full"
              style={{ color: 'var(--text-3)', border: '1px solid var(--border-1)' }}
            >
              Limpar
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
