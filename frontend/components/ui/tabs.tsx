"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

type TabsContextValue = {
  value: string
  setValue: (v: string) => void
}

const TabsContext = React.createContext<TabsContextValue | null>(null)

function useTabsContext() {
  const ctx = React.useContext(TabsContext)
  if (!ctx) throw new Error("Tabs components must be used within <Tabs>")
  return ctx
}

type TabsProps = React.ComponentPropsWithoutRef<"div"> & {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
}

const Tabs = React.forwardRef<HTMLDivElement, TabsProps>(
  ({ className, value: valueProp, defaultValue = "", onValueChange, children, ...props }, ref) => {
    const [uncontrolled, setUncontrolled] = React.useState(defaultValue)
    const isControlled = valueProp !== undefined
    const value = isControlled ? valueProp! : uncontrolled

    const setValue = React.useCallback(
      (next: string) => {
        if (!isControlled) setUncontrolled(next)
        onValueChange?.(next)
      },
      [isControlled, onValueChange]
    )

    const store = React.useMemo(() => ({ value, setValue }), [value, setValue])

    return (
      <TabsContext.Provider value={store}>
        <div ref={ref} className={className} {...props}>
          {children}
        </div>
      </TabsContext.Provider>
    )
  }
)
Tabs.displayName = "Tabs"

const TabsList = React.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<"div">>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      role="tablist"
      className={cn(
        "inline-flex h-10 items-center justify-center rounded-md bg-[#1a1d29] p-1 text-[#94a3b8] border border-[#2a2d3a]",
        className
      )}
      {...props}
    />
  )
)
TabsList.displayName = "TabsList"

type TriggerProps = React.ComponentPropsWithoutRef<"button"> & { value: string }

const TabsTrigger = React.forwardRef<HTMLButtonElement, TriggerProps>(
  ({ className, value: tabValue, ...props }, ref) => {
    const { value, setValue } = useTabsContext()
    const active = value === tabValue
    return (
      <button
        ref={ref}
        type="button"
        role="tab"
        aria-selected={active}
        data-state={active ? "active" : "inactive"}
        onClick={() => setValue(tabValue)}
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-[#2a2d3a] data-[state=active]:text-white data-[state=active]:shadow-sm",
          className
        )}
        {...props}
      />
    )
  }
)
TabsTrigger.displayName = "TabsTrigger"

type ContentProps = React.ComponentPropsWithoutRef<"div"> & { value: string }

const TabsContent = React.forwardRef<HTMLDivElement, ContentProps>(
  ({ className, value: tabValue, children, ...props }, ref) => {
    const { value } = useTabsContext()
    const active = value === tabValue
    if (!active) return null
    return (
      <div
        ref={ref}
        role="tabpanel"
        data-state={active ? "active" : "inactive"}
        className={className}
        {...props}
      >
        {children}
      </div>
    )
  }
)
TabsContent.displayName = "TabsContent"

export { Tabs, TabsList, TabsTrigger, TabsContent }
