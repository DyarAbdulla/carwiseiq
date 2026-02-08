"use client"

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MoreVertical, CheckCircle, RotateCcw, Trash2 } from 'lucide-react'

interface AdminListingControlsProps {
  listingId: number
  locale: string
  status?: string
  onMarkSold: () => void
  onMarkAvailable: () => void
  onDelete: () => void
}

export function AdminListingControls({
  listingId: _listingId,
  locale: _locale,
  status,
  onMarkSold,
  onMarkAvailable,
  onDelete,
}: AdminListingControlsProps) {
  const isSold = status === 'sold' || status === 'Sold'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {!isSold && (
          <DropdownMenuItem onClick={onMarkSold}>
            <CheckCircle className="mr-2 h-4 w-4" />
            Mark Sold
          </DropdownMenuItem>
        )}
        {isSold && (
          <DropdownMenuItem onClick={onMarkAvailable}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Mark Available
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={onDelete} className="text-red-400">
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
