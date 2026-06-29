import { useState, useEffect, useRef } from 'react'
import { Search, Loader2 } from 'lucide-react'
import { servicem8Api, type SM8Company } from '@/api/servicem8'
import { useDebounce } from '@/hooks/useDebounce'

interface Props {
  onSelect: (company: SM8Company) => void
  placeholder?: string
}

export function ServiceM8CustomerSearch({ onSelect, placeholder = 'Search ServiceM8 customers…' }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SM8Company[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const debounced = useDebounce(query, 250)

  useEffect(() => {
    if (debounced.length < 2) { setResults([]); setOpen(false); return }
    setLoading(true)
    setError('')
    servicem8Api.searchCompanies(debounced)
      .then((r) => { setResults(r); setOpen(true) })
      .catch((e) => {
        const msg = e?.response?.data?.detail ?? 'ServiceM8 search failed'
        setError(msg)
        setOpen(false)
      })
      .finally(() => setLoading(false))
  }, [debounced])

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function handleSelect(company: SM8Company) {
    setQuery(company.name)
    setOpen(false)
    onSelect(company)
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        {loading
          ? <Loader2 className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400 animate-spin" />
          : <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
        }
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="block w-full rounded-md border border-gray-300 bg-white pl-8 pr-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {error && (
        <div className="mt-1 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error.includes('API key') || error.includes('not configured')
            ? <>ServiceM8 API key not configured. <a href="/settings" className="underline font-medium">Go to Settings</a> to add it.</>
            : error}
        </div>
      )}

      {open && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-lg max-h-56 overflow-y-auto">
          {results.map((c) => (
            <button
              key={c.uuid}
              onClick={() => handleSelect(c)}
              className="flex w-full flex-col items-start px-3 py-2 text-left hover:bg-blue-50 text-sm border-b border-gray-100 last:border-0"
            >
              <span className="font-medium text-gray-800">{c.name}</span>
              {(c.phone || c.email) && (
                <span className="text-xs text-gray-400">{[c.phone, c.email].filter(Boolean).join(' · ')}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {open && results.length === 0 && !loading && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-400 shadow-lg">
          No matching customers found in ServiceM8.
        </div>
      )}
    </div>
  )
}
