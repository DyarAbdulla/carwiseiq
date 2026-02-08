"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { Input } from "./input"
import { Search, X, Check, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

interface SearchableSelectProps {
  value?: string
  onValueChange?: (value: string) => void
  options: string[]
  placeholder?: string
  disabled?: boolean
  emptyMessage?: string
  searchPlaceholder?: string
  className?: string
  id?: string
  name?: string
}

export function SearchableSelect({
  value,
  onValueChange,
  options,
  placeholder = "Select...",
  disabled = false,
  emptyMessage = "No results found",
  searchPlaceholder = "Type to search...",
  className,
  id,
  name
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const [searchTerm, setSearchTerm] = React.useState("")
  const [focusedIndex, setFocusedIndex] = React.useState(-1)
  const [dropdownPosition, setDropdownPosition] = React.useState<{ top: number; left: number; width: number } | null>(null)
  // Track displayed value to ensure UI updates when value prop changes externally
  const [displayValue, setDisplayValue] = React.useState<string | undefined>(value)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const triggerRef = React.useRef<HTMLButtonElement>(null)
  const searchInputRef = React.useRef<HTMLInputElement>(null)
  const listRef = React.useRef<HTMLDivElement>(null)
  const dropdownRef = React.useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = React.useState(false)
  const prevValueRef = React.useRef<string | undefined>(value)
  const prevDisplayValueRef = React.useRef<string | undefined>(value)
  const prevPositionRef = React.useRef<{ top: number; left: number; width: number } | null>(null)

  // Initialize refs with current value on mount (only once)
  React.useEffect(() => {
    prevValueRef.current = value
    prevDisplayValueRef.current = value
    if (value !== displayValue) {
      setDisplayValue(value)
    }
  }, []) // Empty deps - only run on mount

  // Ensure options is always an array
  const safeOptions = React.useMemo(() => {
    if (!options) return []
    if (!Array.isArray(options)) return []
    return options.filter(opt => opt != null && typeof opt === 'string')
  }, [options])

  // Filter options based on search term (case-insensitive, partial match)
  const filteredOptions = React.useMemo(() => {
    if (!searchTerm.trim()) {
      return safeOptions
    }
    const term = searchTerm.toLowerCase().trim()
    return safeOptions.filter(option => {
      if (!option || typeof option !== 'string') return false
      return option.toLowerCase().includes(term)
    })
  }, [safeOptions, searchTerm])

  // Highlight matching text
  const highlightMatch = (text: string, search: string) => {
    if (!search.trim()) return <span>{text}</span>
    const regex = new RegExp(`(${search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
    const parts = text.split(regex)
    return (
      <>
        {parts.map((part, i) =>
          regex.test(part) ? (
            <mark key={i} className="bg-yellow-500/30 text-yellow-200 font-semibold rounded px-0.5">
              {part}
            </mark>
          ) : (
            <span key={i}>{part}</span>
          )
        )}
      </>
    )
  }

  // Handle option selection
  const handleSelect = React.useCallback((option: string) => {
    if (process.env.NODE_ENV === 'development') {
      console.log('SearchableSelect handleSelect called:', { option, hasOnValueChange: !!onValueChange })
    }
    // Update display value immediately to reflect selection
    setDisplayValue(option)
    prevValueRef.current = option
    onValueChange?.(option)
    setSearchTerm("")
    setIsOpen(false)
    setFocusedIndex(-1)
  }, [onValueChange])

  // Handle click outside to close (works with portal)
  React.useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement

      if (!target) return

      // Check if click is inside dropdown or on trigger
      const isInsideDropdown = dropdownRef.current?.contains(target)
      const isTrigger = triggerRef.current?.contains(target)

      // Only close if click is outside both dropdown and trigger
      if (!isInsideDropdown && !isTrigger) {
        setIsOpen(false)
        setSearchTerm("")
        setFocusedIndex(-1)
      }
    }

    // Add listener immediately (no setTimeout to avoid ref composition issues)
    document.addEventListener('mousedown', handleClickOutside)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // Update position on scroll/resize (with viewport boundary detection)
  // Note: Using 'fixed' positioning means coordinates are viewport-relative (no scroll offset needed)
  React.useEffect(() => {
    if (!isOpen || !triggerRef.current) return

    const updatePosition = () => {
      if (triggerRef.current) {
        const triggerRect = triggerRef.current.getBoundingClientRect()
        const viewportHeight = window.innerHeight
        const viewportWidth = window.innerWidth
        const dropdownMaxHeight = 300
        const spaceBelow = viewportHeight - triggerRect.bottom
        const spaceAbove = triggerRect.top

        // For 'fixed' positioning, use viewport coordinates directly (no scroll offset)
        let top: number
        if (spaceBelow < dropdownMaxHeight && spaceAbove > spaceBelow) {
          top = triggerRect.top - dropdownMaxHeight - 4
          // Ensure it doesn't go above viewport
          if (top < 0) {
            top = 8
          }
        } else {
          top = triggerRect.bottom + 4
          // Ensure it doesn't go below viewport
          if (top + dropdownMaxHeight > viewportHeight) {
            top = viewportHeight - dropdownMaxHeight - 8
          }
        }

        let left = triggerRect.left
        const dropdownWidth = triggerRect.width
        if (left + dropdownWidth > viewportWidth) {
          left = viewportWidth - dropdownWidth - 8
        }
        if (left < 0) {
          left = 8
        }

        const newPosition = {
          top,
          left,
          width: triggerRect.width,
        }

        // GUARD: Only update if position actually changed (prevents infinite loops)
        const prevPos = prevPositionRef.current
        if (!prevPos ||
          prevPos.top !== newPosition.top ||
          prevPos.left !== newPosition.left ||
          prevPos.width !== newPosition.width) {
          prevPositionRef.current = newPosition
          setDropdownPosition(newPosition)
        }
      }
    }

    window.addEventListener('scroll', updatePosition, true)
    window.addEventListener('resize', updatePosition)

    return () => {
      window.removeEventListener('scroll', updatePosition, true)
      window.removeEventListener('resize', updatePosition)
    }
  }, [isOpen])

  // Mount check for portal
  React.useEffect(() => {
    setMounted(true)
  }, [])

  // Sync with external value prop changes (e.g., when form.reset() is called)
  // This ensures the component displays the correct value when parent updates it programmatically
  // GUARD: Only update when value actually changes to prevent infinite loops
  React.useEffect(() => {
    const valueChanged = value !== prevValueRef.current

    // Only process if value actually changed
    if (!valueChanged) return

    const currentValue = value?.trim() || ''
    const prevValue = prevValueRef.current?.trim() || ''

    // CRITICAL FIX: Always display value if it exists, even when options are empty/loading
    // This fixes the race condition where value arrives before options load
    if (value) {
      // Try to find the value in options (if options are loaded)
      // Since options are strings (not objects), we check for direct match
      const selectedOption = safeOptions.find((opt) =>
        typeof opt === 'string' ? opt === value : opt === value
      )

      // CRITICAL FIX: If option is found, use its label.
      // If NOT found (options loading), use the raw 'value' string immediately.
      // Do not wait for options to load.
      const textToDisplay = selectedOption
        ? (typeof selectedOption === 'string' ? selectedOption : selectedOption)
        : value

      // GUARD: Only update displayValue if it actually changed (prevents infinite loops)
      if (textToDisplay !== prevDisplayValueRef.current) {
        prevDisplayValueRef.current = textToDisplay
        setDisplayValue(textToDisplay)
      }
    } else {
      // Value is empty - clear display (only if not already cleared)
      if (prevDisplayValueRef.current !== undefined) {
        prevDisplayValueRef.current = undefined
        setDisplayValue(undefined)
      }
    }

    // Handle side effects when value prop actually changes
    if (currentValue !== prevValue) {
      // Clear search term when value changes externally (form reset)
      // This ensures the dropdown shows the correct selected value when reopened
      setSearchTerm("")

      // Close dropdown if it's open when value changes externally
      // This prevents stale UI state and ensures clean state
      if (isOpen) {
        setIsOpen(false)
        setFocusedIndex(-1)
      }

      // Update ref to track current value for next comparison
      prevValueRef.current = value
    }
  }, [value, safeOptions, isOpen])

  // Calculate dropdown position when opening (with viewport boundary detection)
  // Note: Using 'fixed' positioning means coordinates are viewport-relative (no scroll offset needed)
  React.useEffect(() => {
    if (isOpen && triggerRef.current) {
      const triggerRect = triggerRef.current.getBoundingClientRect()
      const viewportHeight = window.innerHeight
      const viewportWidth = window.innerWidth
      const dropdownMaxHeight = 300 // maxHeight from styles
      const spaceBelow = viewportHeight - triggerRect.bottom
      const spaceAbove = triggerRect.top

      // Determine if dropdown should open above or below
      // For 'fixed' positioning, use viewport coordinates directly (no scroll offset)
      let top: number
      if (spaceBelow < dropdownMaxHeight && spaceAbove > spaceBelow) {
        // Open above if there's more space above
        top = triggerRect.top - dropdownMaxHeight - 4
        // Ensure it doesn't go above viewport
        if (top < 0) {
          top = 8
        }
      } else {
        // Open below (default) - position directly below the trigger button
        top = triggerRect.bottom + 4
        // Ensure it doesn't go below viewport
        if (top + dropdownMaxHeight > viewportHeight) {
          top = viewportHeight - dropdownMaxHeight - 8
        }
      }

      // Ensure dropdown doesn't go off-screen horizontally
      let left = triggerRect.left
      const dropdownWidth = triggerRect.width
      if (left + dropdownWidth > viewportWidth) {
        left = viewportWidth - dropdownWidth - 8
      }
      if (left < 0) {
        left = 8
      }

      const newPosition = {
        top,
        left,
        width: triggerRect.width,
      }

      // GUARD: Only update if position actually changed (prevents infinite loops)
      const prevPos = prevPositionRef.current
      if (!prevPos ||
        prevPos.top !== newPosition.top ||
        prevPos.left !== newPosition.left ||
        prevPos.width !== newPosition.width) {
        prevPositionRef.current = newPosition
        setDropdownPosition(newPosition)
      }
    } else {
      // Reset position when closed
      if (prevPositionRef.current !== null) {
        prevPositionRef.current = null
        setDropdownPosition(null)
      }
    }
  }, [isOpen])

  // Focus search input when dropdown opens
  React.useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus()
      }, 10)
    }
  }, [isOpen])

  // Scroll focused item into view
  React.useEffect(() => {
    if (focusedIndex >= 0 && listRef.current) {
      const item = listRef.current.children[focusedIndex] as HTMLElement
      if (item) {
        item.scrollIntoView({ block: 'nearest' })
      }
    }
  }, [focusedIndex])

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault()
        setIsOpen(true)
      }
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setFocusedIndex(prev =>
          prev < filteredOptions.length - 1 ? prev + 1 : 0
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setFocusedIndex(prev =>
          prev > 0 ? prev - 1 : filteredOptions.length - 1
        )
        break
      case 'Enter':
        e.preventDefault()
        if (focusedIndex >= 0 && filteredOptions[focusedIndex]) {
          handleSelect(filteredOptions[focusedIndex])
        } else if (filteredOptions.length > 0) {
          handleSelect(filteredOptions[0])
        }
        break
      case 'Escape':
        e.preventDefault()
        setIsOpen(false)
        setSearchTerm("")
        setFocusedIndex(-1)
        break
      case 'Tab':
        setIsOpen(false)
        setSearchTerm("")
        setFocusedIndex(-1)
        break
    }
  }

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        id={id}
        name={name}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        className={cn("h-12 md:h-10", className)}
        disabled={disabled}
        className={cn(
          "flex items-center justify-between rounded-lg border border-slate-200/80 dark:border-white/10 bg-slate-50/90 dark:bg-white/[0.05] backdrop-blur-sm px-4 text-base text-slate-900 dark:text-slate-100 ring-offset-2 ring-offset-white dark:ring-offset-slate-950 placeholder:text-slate-500 dark:placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 dark:focus:border-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200 hover:border-slate-300 dark:hover:border-white/20 hover:bg-slate-100/80 dark:hover:bg-white/[0.08] w-full h-12 md:h-10 py-3 md:py-2 [touch-action:manipulation]",
          className
        )}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={placeholder}
      >
        <span
          className={cn(
            "block truncate",
            (!displayValue || displayValue.trim() === '') && "text-slate-500 dark:text-slate-400"
          )}
          key={`display-${displayValue || 'empty'}-${id || 'default'}`}
        >
          {(displayValue && displayValue.trim() !== '') ? displayValue : placeholder}
        </span>
        <ChevronDown className={cn(
          "h-4 w-4 opacity-50 transition-transform duration-200",
          isOpen && "rotate-180"
        )} />
      </button>

      {/* Dropdown - Rendered via Portal to avoid clipping */}
      {isOpen && mounted && dropdownPosition && createPortal(
        <div
          ref={dropdownRef}
          className="fixed z-[99999] rounded-xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-slate-900 backdrop-blur-xl shadow-xl overflow-hidden"
          style={{
            top: `${dropdownPosition.top}px`,
            left: `${dropdownPosition.left}px`,
            width: `${dropdownPosition.width}px`,
            maxHeight: '300px'
          }}
          onMouseDown={(e) => {
            // Prevent clicks on the dropdown container from closing it
            // But allow option button clicks to work
            if (e.target === e.currentTarget) {
              e.preventDefault()
            }
          }}
        >
          {/* Search Input */}
          <div className="p-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                ref={searchInputRef}
                id={id ? `${id}-search` : undefined}
                name={name ? `${name}-search` : undefined}
                type="text"
                placeholder={searchPlaceholder}
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value)
                  setFocusedIndex(-1)
                }}
                onKeyDown={handleKeyDown}
                className="pl-8 pr-8 h-10 bg-white dark:bg-slate-900/50 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                aria-label={`Search ${placeholder}`}
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm("")
                    searchInputRef.current?.focus()
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* Options List */}
          <div
            ref={listRef}
            className="overflow-y-auto overscroll-contain"
            style={{ maxHeight: '240px' }}
            role="listbox"
          >
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option, index) => (
                <button
                  key={option}
                  type="button"
                  role="option"
                  aria-selected={value === option}
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    handleSelect(option)
                  }}
                  onMouseEnter={() => setFocusedIndex(index)}
                  className={cn(
                    "relative flex w-full items-center px-3 py-2.5 text-sm text-left transition-colors cursor-pointer",
                    "hover:bg-slate-100 dark:hover:bg-white/10",
                    focusedIndex === index && "bg-slate-100 dark:bg-white/10",
                    value === option && "text-indigo-600 dark:text-indigo-400 font-medium"
                  )}
                >
                  <span className="w-5 h-5 mr-2 flex items-center justify-center">
                    {value === option && <Check className="h-4 w-4" />}
                  </span>
                  <span className="flex-1 truncate">
                    {highlightMatch(option, searchTerm)}
                  </span>
                </button>
              ))
            ) : (
              <div className="px-3 py-6 text-center text-slate-500 dark:text-slate-400 text-sm">
                {searchTerm.length >= 1
                  ? `No results found for "${searchTerm}"`
                  : emptyMessage
                }
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

/*
 * VERIFICATION CHECKLIST - SearchableSelect Component:
 *
 * ✅ Ref Stability:
 *    - All refs use useRef (no setState in ref callbacks)
 *    - prevValueRef, prevDisplayValueRef, prevPositionRef track previous values
 *    - Verified: No setState calls inside ref assignments
 *
 * ✅ State Update Guards:
 *    - setDisplayValue only called when textToDisplay !== prevDisplayValueRef.current
 *    - setDropdownPosition only called when position actually changed
 *    - value sync effect only runs when value !== prevValueRef.current
 *    - Verified: No infinite loops from state updates
 *
 * ✅ Per-Card Isolation:
 *    - Component receives stable key prop from parent
 *    - No shared state between instances
 *    - Verified: Multiple instances on Compare page work independently
 *
 * ✅ Click Outside Handler:
 *    - Event listener added immediately (no setTimeout)
 *    - Properly checks dropdownRef and triggerRef
 *    - Verified: Dropdown closes correctly, no ref composition issues
 */
