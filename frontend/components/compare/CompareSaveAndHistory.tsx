"use client"

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Save, History } from 'lucide-react'
import { getCompareHistory, type CompareHistoryEntry } from '@/lib/compareHistory'

interface CompareSaveAndHistoryProps {
  canSave: boolean
  onSave: (name: string) => void
  onLoad: (entry: CompareHistoryEntry) => void
  variant?: 'outline' | 'default'
  className?: string
}

export function CompareSaveAndHistory({
  canSave,
  onSave,
  onLoad,
  variant = 'outline',
  className,
}: CompareSaveAndHistoryProps) {
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('')
  const history = typeof window !== 'undefined' ? getCompareHistory() : []

  const handleSave = () => {
    if (!name.trim()) return
    onSave(name.trim())
    setSaving(false)
    setName('')
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} className={className}>
          <Save className="mr-2 h-4 w-4" />
          Save / History
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {canSave && (
          <div className="px-2 py-2 border-b border-[#2a2d3a]">
            <input
              type="text"
              placeholder="Name this comparison"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded bg-[#1a1d29] border border-[#2a2d3a] px-2 py-1.5 text-sm text-white placeholder:text-[#64748b]"
            />
            <Button size="sm" className="mt-2 w-full" onClick={handleSave} disabled={!name.trim()}>
              Save
            </Button>
          </div>
        )}
        {history.length > 0 && (
          <>
            <div className="px-2 py-1 text-xs text-[#94a3b8]">History</div>
            {history.slice(0, 10).map((entry) => (
              <DropdownMenuItem
                key={entry.id ?? entry.name}
                onClick={() => onLoad(entry)}
                className="text-sm"
              >
                <History className="mr-2 h-4 w-4" />
                {entry.name}
              </DropdownMenuItem>
            ))}
          </>
        )}
        {history.length === 0 && !canSave && (
          <div className="px-2 py-4 text-sm text-[#94a3b8]">No saved comparisons</div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
