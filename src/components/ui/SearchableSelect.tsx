'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Search, X, Plus } from 'lucide-react'

interface SearchableSelectProps {
  value: string
  options: string[]
  onChange: (value: string) => void
  placeholder?: string
}

export function SearchableSelect({ value, options, onChange, placeholder = 'Selecione ou digite...' }: SearchableSelectProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const filtered = options.filter(o =>
    o.toLowerCase().includes(search.toLowerCase())
  )

  const exactMatch = options.some(o => o.toLowerCase() === search.toLowerCase())
  const canCreate = search.trim().length > 0 && !exactMatch

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 50)
  }, [open])

  function select(opt: string) {
    onChange(opt)
    setOpen(false)
    setSearch('')
  }

  function createNew() {
    const v = search.trim()
    if (!v) return
    onChange(v)
    setOpen(false)
    setSearch('')
  }

  function clear(e: React.MouseEvent) {
    e.stopPropagation()
    onChange('')
    setSearch('')
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="input w-full flex items-center justify-between gap-2 text-left"
        style={{ cursor: 'pointer' }}
      >
        <span className="flex-1 truncate text-sm" style={{
          color: value ? 'var(--text-1)' : 'var(--text-3)',
        }}>
          {value || placeholder}
        </span>
        <div className="flex items-center gap-1 flex-shrink-0">
          {value && (
            <span onClick={clear}
              className="p-0.5 rounded hover:bg-[var(--bg-4)] transition-colors"
              style={{ color: 'var(--text-3)' }}>
              <X size={13} />
            </span>
          )}
          <ChevronDown size={14} style={{
            color: 'var(--text-3)',
            transform: open ? 'rotate(180deg)' : 'rotate(0)',
            transition: 'transform 0.15s',
          }} />
        </div>
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="absolute z-50 w-full mt-1 rounded-xl overflow-hidden"
          style={{
            background: 'var(--bg-2)',
            border: '1px solid var(--border-2)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          }}
        >
          {/* Search input */}
          <div className="p-2 border-b" style={{ borderColor: 'var(--border-1)' }}>
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2"
                style={{ color: 'var(--text-3)' }} />
              <input
                ref={searchRef}
                className="input pl-7 py-1.5 text-sm"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar ou criar categoria..."
                onKeyDown={e => {
                  if (e.key === 'Escape') { setOpen(false); setSearch('') }
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    if (filtered.length === 1) select(filtered[0])
                    else if (canCreate) createNew()
                  }
                }}
              />
            </div>
          </div>

          {/* Criar nova — aparece quando não há match exato */}
          {canCreate && (
            <button
              type="button"
              onClick={createNew}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors hover:bg-[var(--bg-3)] border-b"
              style={{ borderColor: 'var(--border-1)', color: 'var(--green-400)' }}
            >
              <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: 'var(--green-dim)' }}>
                <Plus size={12} />
              </div>
              <span>
                Criar <strong>"{search.trim()}"</strong>
              </span>
            </button>
          )}

          {/* Options list */}
          <div className="overflow-y-auto" style={{ maxHeight: 200 }}>
            {filtered.length === 0 && !canCreate ? (
              <div className="px-4 py-3 text-sm text-center" style={{ color: 'var(--text-3)' }}>
                Nenhuma categoria encontrada
              </div>
            ) : (
              <>
                {!search && (
                  <button type="button" onClick={() => select('')}
                    className="w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-[var(--bg-3)]"
                    style={{ color: 'var(--text-3)' }}>
                    — Sem categoria —
                  </button>
                )}
                {filtered.map(opt => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => select(opt)}
                    className="w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-[var(--bg-3)]"
                    style={{
                      color: 'var(--text-1)',
                      background: opt === value ? 'var(--green-dim)' : undefined,
                      fontWeight: opt === value ? 500 : undefined,
                    }}
                  >
                    {search ? <HighlightMatch text={opt} search={search} /> : opt}
                  </button>
                ))}
              </>
            )}
          </div>

          {/* Hint */}
          <div className="px-4 py-2 border-t" style={{ borderColor: 'var(--border-1)' }}>
            <p className="text-xs" style={{ color: 'var(--text-3)' }}>
              {canCreate
                ? 'Pressione Enter para criar a nova categoria'
                : 'Digite para filtrar ou criar uma nova categoria'}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

function HighlightMatch({ text, search }: { text: string; search: string }) {
  const idx = text.toLowerCase().indexOf(search.toLowerCase())
  if (idx === -1) return <>{text}</>
  return (
    <>
      {text.slice(0, idx)}
      <mark style={{ background: 'var(--green-dim)', color: 'var(--green-400)', borderRadius: 2, padding: '0 1px' }}>
        {text.slice(idx, idx + search.length)}
      </mark>
      {text.slice(idx + search.length)}
    </>
  )
}
