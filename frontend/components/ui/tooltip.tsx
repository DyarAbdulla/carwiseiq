"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { cn } from "@/lib/utils"

type TooltipCtx = {
  open: boolean
  setOpen: (o: boolean) => void
  triggerRef: React.MutableRefObject<HTMLElement | null>
}

const TooltipContext = React.createContext<TooltipCtx | null>(null)

function useTooltipContext() {
  const c = React.useContext(TooltipContext)
  if (!c) throw new Error("Tooltip parts must be used within <Tooltip>")
  return c
}

type ProviderProps = { children: React.ReactNode; delayDuration?: number }

/** Pass-through for API compatibility; delayDuration is accepted but not used. */
function TooltipProvider({ children, delayDuration: _delay }: ProviderProps) {
  return <>{children}</>
}

type TooltipProps = { children: React.ReactNode; delayDuration?: number }

function Tooltip({ children, delayDuration: _d }: TooltipProps) {
  const [open, setOpen] = React.useState(false)
  const triggerRef = React.useRef<HTMLElement | null>(null)
  const store = React.useMemo(
    () => ({ open, setOpen, triggerRef }),
    [open]
  )

  return <TooltipContext.Provider value={store}>{children}</TooltipContext.Provider>
}

type TriggerProps = React.ComponentPropsWithoutRef<"button"> & { asChild?: boolean }

const TooltipTrigger = React.forwardRef<HTMLElement, TriggerProps>(
  ({ asChild, children, onMouseEnter, onMouseLeave, onFocus, onBlur, ...rest }, ref) => {
    const { setOpen, triggerRef } = useTooltipContext()

    const mergeRef = (el: HTMLElement | null) => {
      triggerRef.current = el
      if (typeof ref === "function") ref(el)
      else if (ref && "current" in ref) (ref as React.MutableRefObject<HTMLElement | null>).current = el
    }

    const show = () => setOpen(true)
    const hide = () => setOpen(false)

    if (asChild && React.isValidElement(children)) {
      const child = children as React.ReactElement
      return React.cloneElement(child, {
        ref: (node: HTMLElement | null) => {
          mergeRef(node)
          const r = (child as unknown as { ref?: React.Ref<HTMLElement> | undefined }).ref
          if (typeof r === "function") r(node)
          else if (r && "current" in r) (r as React.MutableRefObject<HTMLElement | null>).current = node
        },
        onMouseEnter: (e: React.MouseEvent) => {
          show()
          child.props.onMouseEnter?.(e)
        },
        onMouseLeave: (e: React.MouseEvent) => {
          hide()
          child.props.onMouseLeave?.(e)
        },
        onFocus: (e: React.FocusEvent) => {
          show()
          child.props.onFocus?.(e)
        },
        onBlur: (e: React.FocusEvent) => {
          hide()
          child.props.onBlur?.(e)
        },
      } as never)
    }

    return (
      <button
        ref={mergeRef as React.Ref<HTMLButtonElement>}
        type="button"
        onMouseEnter={(e) => {
          show()
          onMouseEnter?.(e)
        }}
        onMouseLeave={(e) => {
          hide()
          onMouseLeave?.(e)
        }}
        onFocus={(e) => {
          show()
          onFocus?.(e)
        }}
        onBlur={(e) => {
          hide()
          onBlur?.(e)
        }}
        {...rest}
      >
        {children}
      </button>
    )
  }
)
TooltipTrigger.displayName = "TooltipTrigger"

type TooltipSide = "top" | "right" | "bottom" | "left"

type ContentProps = Omit<React.ComponentPropsWithoutRef<"div">, "style"> & {
  sideOffset?: number
  side?: TooltipSide
}

const TooltipContent = React.forwardRef<HTMLDivElement, ContentProps>(
  ({ className, sideOffset = 4, side = "top", children, ...props }, ref) => {
    const { open, triggerRef } = useTooltipContext()
    const [style, setStyle] = React.useState<React.CSSProperties>({})
    const [mounted, setMounted] = React.useState(false)

    React.useEffect(() => {
      setMounted(true)
    }, [])

    React.useLayoutEffect(() => {
      if (!open || !triggerRef.current || typeof window === "undefined") return
      const el = triggerRef.current
      const rect = el.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      let next: React.CSSProperties = { position: "fixed", zIndex: 1000 }

      switch (side) {
        case "bottom":
          next = {
            ...next,
            left: cx,
            top: rect.bottom + sideOffset,
            transform: "translate(-50%, 0)",
          }
          break
        case "left":
          next = {
            ...next,
            left: rect.left - sideOffset,
            top: cy,
            transform: "translate(-100%, -50%)",
          }
          break
        case "right":
          next = {
            ...next,
            left: rect.right + sideOffset,
            top: cy,
            transform: "translate(0, -50%)",
          }
          break
        case "top":
        default:
          next = {
            ...next,
            left: cx,
            top: rect.top - sideOffset,
            transform: "translate(-50%, -100%)",
          }
      }
      setStyle(next)
    }, [open, sideOffset, side, triggerRef])

    if (!mounted || !open) return null

    const node = (
      <div
        ref={ref}
        role="tooltip"
        style={style}
        className={cn(
          "z-[1000] overflow-hidden rounded-md bg-[#1a1d29] px-3 py-1.5 text-sm text-white border border-[#2a2d3a] shadow-lg pointer-events-none",
          className
        )}
        {...props}
      >
        {children}
      </div>
    )

    return createPortal(node, document.body)
  }
)
TooltipContent.displayName = "TooltipContent"

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
