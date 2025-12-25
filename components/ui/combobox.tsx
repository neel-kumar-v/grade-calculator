"use client"

import * as React from "react"
import { Check, ChevronDown, Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface ComboboxProps {
  options?: string[] // Optional for backward compatibility
  value?: string
  onValueChange?: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  fetchOptions?: (query: string, page: number) => Promise<{ data: string[]; hasMore: boolean }>
  initialPageSize?: number
}

export function Combobox({
  options,
  value,
  onValueChange,
  placeholder = "Select option...",
  searchPlaceholder = "Search...",
  emptyText = "No results found.",
  fetchOptions,
  initialPageSize = 20,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [loadedOptions, setLoadedOptions] = React.useState<string[]>(options || [])
  const [loading, setLoading] = React.useState(false)
  const [isSearching, setIsSearching] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [page, setPage] = React.useState(1)
  const [hasMore, setHasMore] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  
  const abortControllerRef = React.useRef<AbortController | null>(null)
  const sentinelRef = React.useRef<HTMLDivElement | null>(null)
  const isMountedRef = React.useRef(true)
  const searchTimeoutRef = React.useRef<NodeJS.Timeout | null>(null)

  // Track if component is mounted
  React.useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  // Load a page of data
  const loadPage = React.useCallback(async (query: string, pageNum: number, append = false) => {
    if (!fetchOptions) return

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    // Create new abort controller
    const abortController = new AbortController()
    abortControllerRef.current = abortController

    setLoading(true)
    setIsSearching(false) // Clear searching state when we start loading
    setError(null)

    try {
      const result = await fetchOptions(query, pageNum)
      
      // Check if request was aborted
      if (abortController.signal.aborted || !isMountedRef.current) {
        return
      }

      if (append) {
        setLoadedOptions((prev) => [...prev, ...result.data])
      } else {
        setLoadedOptions(result.data)
      }
      setHasMore(result.hasMore)
      setPage(pageNum)
    } catch (err) {
      if (abortController.signal.aborted || !isMountedRef.current) {
        return
      }
      console.error("Error loading options:", err)
      setError("Failed to load options. Please try again.")
    } finally {
      if (!abortController.signal.aborted && isMountedRef.current) {
        setLoading(false)
      }
      if (abortControllerRef.current === abortController) {
        abortControllerRef.current = null
      }
    }
  }, [fetchOptions])

  // Load initial data when dropdown opens
  React.useEffect(() => {
    if (open && fetchOptions && !options && loadedOptions.length === 0 && !loading) {
      loadPage("", 1)
    }
  }, [open, fetchOptions, options, loadedOptions.length, loading, loadPage])

  // Reset when dropdown closes
  React.useEffect(() => {
    if (!open) {
      setSearchQuery("")
      setPage(1)
      setError(null)
      setIsSearching(false)
      // Reset loaded options if using fetchOptions (but keep if using static options)
      if (fetchOptions && !options) {
        setLoadedOptions([])
      }
      // Cancel any in-flight requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
        abortControllerRef.current = null
      }
    }
  }, [open, fetchOptions, options])

  // Debounced search
  React.useEffect(() => {
    if (!fetchOptions) return

    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    // Reset pagination when search changes
    setPage(1)
    // Don't clear loadedOptions immediately - keep previous results visible
    // They will be replaced when new results arrive
    setIsSearching(true)

    // Debounce the search
    searchTimeoutRef.current = setTimeout(() => {
      loadPage(searchQuery, 1, false)
    }, 300)

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [searchQuery, fetchOptions, loadPage])

  // Infinite scroll with Intersection Observer
  React.useEffect(() => {
    if (!fetchOptions || !hasMore || loading || isSearching) return

    const sentinel = sentinelRef.current
    if (!sentinel) return

    let isPending = false

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !loading && !isSearching && !isPending) {
          isPending = true
          loadPage(searchQuery, page + 1, true).finally(() => {
            isPending = false
          })
        }
      },
      { 
        threshold: 0.1,
        rootMargin: "100px" // Start loading earlier for smoother experience
      }
    )

    observer.observe(sentinel)

    return () => {
      observer.disconnect()
    }
  }, [hasMore, loading, isSearching, page, searchQuery, fetchOptions, loadPage])

  // Handle search input change
  const handleSearchChange = React.useCallback((value: string) => {
    setSearchQuery(value)
  }, [])

  // Use static options if provided, otherwise use loaded options
  const displayOptions = options || loadedOptions

  // Ensure selected value is in the list
  const optionsToDisplay = React.useMemo(() => {
    if (!value) return displayOptions
    if (displayOptions.includes(value)) return displayOptions
    return [value, ...displayOptions]
  }, [displayOptions, value])

  // Memoize the onSelect handler to prevent re-renders
  const handleItemSelect = React.useCallback((currentValue: string) => {
    onValueChange?.(currentValue === value ? "" : currentValue)
    setOpen(false)
  }, [value, onValueChange])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {value || placeholder}
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false} loop={false}>
          <CommandInput 
            placeholder={searchPlaceholder}
            value={searchQuery}
            onValueChange={handleSearchChange}
          />
          <CommandList
            onWheel={(e) => {
              // Ensure wheel events don't get blocked
              e.stopPropagation()
            }}
          >
            {error ? (
              <div className="py-6 text-center text-sm text-destructive">
                {error}
              </div>
            ) : (
              <>
                {optionsToDisplay.length === 0 && !loading && !isSearching && (
                  <CommandEmpty>{emptyText}</CommandEmpty>
                )}
                {(loading || isSearching) && optionsToDisplay.length === 0 && (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    <span className="text-sm text-muted-foreground">Searching...</span>
                  </div>
                )}
                {optionsToDisplay.length > 0 && (
                  <CommandGroup>
                    {optionsToDisplay.map((option) => {
                      const isSelected = value === option
                      return (
                        <CommandItem
                          key={option}
                          value={option}
                          onSelect={handleItemSelect}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              isSelected ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {option}
                        </CommandItem>
                      )
                    })}
                  </CommandGroup>
                )}
                {/* Loading indicator while searching (but keep previous results visible) */}
                {isSearching && optionsToDisplay.length > 0 && (
                  <div className="flex items-center justify-center py-2 border-t">
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    <span className="text-sm text-muted-foreground">Searching...</span>
                  </div>
                )}
                {/* Sentinel for infinite scroll */}
                {fetchOptions && hasMore && !loading && !isSearching && (
                  <div ref={sentinelRef} className="h-1 w-full" />
                )}
                {loading && optionsToDisplay.length > 0 && !isSearching && (
                  <div className="flex items-center justify-center py-2">
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    <span className="text-sm text-muted-foreground">Loading more...</span>
                  </div>
                )}
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
