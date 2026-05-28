'use client'

import { useMemo } from 'react'
import { X } from 'lucide-react'

interface CategoryFilterProps {
  categories: string[]          // lista de categorias dos registros do mês
  selectedGroup: string         // '' = nenhum
  selectedSub: string           // '' = nenhum
  onGroupChange: (g: string) => void
  onSubChange: (s: string) => void
}

export function parseCategory(cat?: string | null): { group: string; sub: string } {
  if (!cat) return { group: '', sub: '' }
  const idx = cat.indexOf(':')
  if (idx === -1) return { group: cat.trim(), sub: '' }
  return { group: cat.slice(0, idx).trim(), sub: cat.slice(idx + 1).trim() }
}

export function matchesCategory(cat: string | undefined | null, group: string, sub: string): boolean {
  if (!group) return true
  const parsed = parseCategory(cat)
  if (parsed.group !== group) return false
  if (sub && parsed.sub !== sub) return false
  return true
}

export function CategoryFilter({ categories, selectedGroup, selectedSub, onGroupChange, onSubChange }: CategoryFilterProps) {
  // Deriva grupos e subcategorias únicos das categorias dos registros
  const { groups, subsByGroup } = useMemo(() => {
    const groupSet = new Set<string>()
    const subs: Record<string, Set<string>> = {}
    for (const cat of categories) {
      const { group, sub } = parseCategory(cat)
      if (!group) continue
      groupSet.add(group)
      if (sub) {
        if (!subs[group]) subs[group] = new Set()
        subs[group].add(sub)
      }
    }
    return {
      groups: Array.from(groupSet).sort(),
      subsByGroup: Object.fromEntries(
        Object.entries(subs).map(([g, s]) => [g, Array.from(s).sort()])
      ),
    }
  }, [categories])

  if (groups.length === 0) return null

  const subs = selectedGroup ? (subsByGroup[selectedGroup] ?? []) : []
  const hasFilter = !!selectedGroup

  function handleGroupClick(g: string) {
    if (selectedGroup === g) {
      // Toggle off
      onGroupChange('')
      onSubChange('')
    } else {
      onGroupChange(g)
      onSubChange('')
    }
  }

  function handleSubClick(s: string) {
    onSubChange(selectedSub === s ? '' : s)
  }

  return (
    <div className="space-y-2">
      {/* Grupos */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-3)' }}>Categoria:</span>
        {groups.map(g => {
          const active = selectedGroup === g
          return (
            <button key={g} type="button" onClick={() => handleGroupClick(g)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all"
              style={{
                background: active ? 'var(--green-dim)' : 'var(--bg-3)',
                color: active ? 'var(--green-400)' : 'var(--text-2)',
                border: `1px solid ${active ? 'var(--green-border)' : 'var(--border-1)'}`,
              }}>
              {g}
              {active && <X size={10} style={{ marginLeft: 2 }} />}
            </button>
          )
        })}
        {hasFilter && (
          <button type="button" onClick={() => { onGroupChange(''); onSubChange('') }}
            className="text-xs px-2 py-1 rounded-full"
            style={{ color: 'var(--text-3)', border: '1px solid var(--border-1)' }}>
            Limpar
          </button>
        )}
      </div>

      {/* Subcategorias — só aparece se grupo selecionado tiver subs */}
      {selectedGroup && subs.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pl-1">
          <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-3)' }}>↳</span>
          {subs.map(s => {
            const active = selectedSub === s
            return (
              <button key={s} type="button" onClick={() => handleSubClick(s)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs transition-all"
                style={{
                  background: active ? 'rgba(96,165,250,0.12)' : 'var(--bg-3)',
                  color: active ? 'var(--blue)' : 'var(--text-3)',
                  border: `1px solid ${active ? 'rgba(96,165,250,0.35)' : 'var(--border-1)'}`,
                }}>
                {s}
                {active && <X size={10} style={{ marginLeft: 2 }} />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
