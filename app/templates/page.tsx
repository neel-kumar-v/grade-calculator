"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "next-view-transitions";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useGradingPeriodName } from "../../hooks/useGradingPeriodName";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Combobox } from "../../components/ui/combobox";
import { Button } from "../../components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";
import {
  Search,
  Download,
  GraduationCap,
  User,
  ChevronDown,
  X,
  BookOpen,
  Loader2,
  ExternalLink,
  PlusCircle,
} from "lucide-react";
import { toast } from "sonner";
import type { Doc, Id } from "../../convex/_generated/dataModel";

type Template = Doc<"templates">;

async function fetchColleges(
  query: string,
  page: number
): Promise<{ data: string[]; hasMore: boolean }> {
  const response = await fetch(
    `/api/college_search?query=${encodeURIComponent(query)}&page=${page}&limit=20`
  );
  if (!response.ok) {
    throw new Error("Failed to fetch colleges");
  }
  const result = await response.json();
  return {
    data: result.data || [],
    hasMore: result.pagination?.hasMore || false,
  };
}

async function fetchTemplates(
  query: string,
  university: string,
  page: number
): Promise<{ data: Template[]; hasMore: boolean; total?: number }> {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: "20",
  });
  if (query) {
    params.append("query", query);
  }
  if (university) {
    params.append("university", university);
  }

  const response = await fetch(`/api/template_search?${params.toString()}`);
  if (!response.ok) {
    throw new Error("Failed to fetch templates");
  }
  const result = await response.json();
  return {
    data: result.data || [],
    hasMore: result.pagination?.hasMore || false,
    total: result.pagination?.total,
  };
}

function TemplateCard({
  template,
  gradingPeriods,
  isAuthenticated,
}: {
  template: Template;
  gradingPeriods: Doc<"gradingPeriods">[] | undefined;
  isAuthenticated: boolean;
}) {
  const router = useRouter();
  const gradingPeriodName = useGradingPeriodName();
  const periodSingular = gradingPeriodName.slice(0, -1);
  const addCourse = useMutation(api.gradingPeriods.addCourse);
  const incrementDownload = useMutation(api.templates.incrementDownload);
  const [addingToPeriod, setAddingToPeriod] = useState(false);

  const categoryWeights = template.categories.map((cat) => ({
    name: cat.name,
    weight: cat.weight,
  }));

  const handleAddToPeriod = async (periodId: Id<"gradingPeriods">, periodName: string) => {
    setAddingToPeriod(true);
    try {
      const importedCategories = template.categories.map((cat) => {
        if (cat.manual) {
          return {
            ...cat,
            grade: 100,
            assignments: undefined,
          };
        } else {
          return {
            ...cat,
            grade: 0,
            assignments: [{ score: 100, max_score: 100 }],
          };
        }
      });

      const result = await addCourse({
        id: periodId,
        course: {
          name: `${template.courseCode} - ${template.courseTitle}`,
          credits: 3,
          manual: false,
          grade: 100,
          from_extra_credit: 0,
          part_of_degree: false,
          categories: importedCategories,
          importedTemplateId: template._id,
        },
      });

      try {
        await incrementDownload({ id: template._id });
      } catch {
        // Non-fatal
      }

      toast.success(`Added ${template.courseCode} to ${periodName}`);
      if (result && typeof result.courseIndex === "number") {
        router.push(`/${periodId}/${result.courseIndex}`);
      } else {
        router.push(`/${periodId}`);
      }
    } catch (error) {
      console.error("Failed to add course to period:", error);
      toast.error(`Failed to add course to ${periodName}. Please try again.`);
    } finally {
      setAddingToPeriod(false);
    }
  };

  return (
    <div className="p-4 border border-border rounded-lg bg-card flex flex-col justify-between gap-4 transition-colors hover:border-primary/50">
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-muted text-foreground">
                {template.courseCode}
              </span>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <User className="size-3 shrink-0" />
                <span className="truncate">{template.instructor}</span>
              </span>
            </div>
            <Link
              href={`/template/${template._id}`}
              className="text-base font-semibold mt-1.5 hover:underline block truncate"
            >
              {template.courseTitle}
            </Link>
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded shrink-0">
            <Download className="size-3" />
            <span className="font-medium">{template.downloadCount}</span>
          </div>
        </div>

        {template.university && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <GraduationCap className="size-3.5 shrink-0" />
            <span className="truncate">{template.university}</span>
          </div>
        )}

        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {categoryWeights.slice(0, 4).map((cat, idx) => (
            <span
              key={idx}
              className="text-xs px-2 py-0.5 rounded bg-secondary text-secondary-foreground font-medium"
            >
              {cat.name}: {cat.weight}%
            </span>
          ))}
          {categoryWeights.length > 4 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground cursor-default">
                  +{categoryWeights.length - 4} more
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs p-2">
                <div className="space-y-1 text-xs">
                  <div className="font-semibold mb-1">All Categories:</div>
                  {categoryWeights.map((cat, idx) => (
                    <div key={idx} className="flex justify-between gap-3">
                      <span>{cat.name}</span>
                      <span>{cat.weight}%</span>
                    </div>
                  ))}
                </div>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      <div className="pt-3 border-t border-border flex items-center justify-between gap-2">
        <Link
          href={`/template/${template._id}`}
          className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
        >
          <ExternalLink className="size-3" />
          <span>Sandbox</span>
        </Link>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="sm"
              variant="outline"
              disabled={addingToPeriod}
              className="text-xs h-8 gap-1.5 font-medium ml-auto"
            >
              {addingToPeriod ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Adding...</span>
                </>
              ) : (
                <>
                  <span>Open in {periodSingular}</span>
                  <ChevronDown className="size-3.5 opacity-60" />
                </>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {!isAuthenticated ? (
              <>
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                  Sign in required
                </DropdownMenuLabel>
                <DropdownMenuItem asChild>
                  <Link href="/" className="cursor-pointer">
                    Sign in to add to {periodSingular.toLowerCase()}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href={`/template/${template._id}`} className="cursor-pointer">
                    Calculate online (sandbox)
                  </Link>
                </DropdownMenuItem>
              </>
            ) : gradingPeriods && gradingPeriods.length > 0 ? (
              <>
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                  Add to {periodSingular}:
                </DropdownMenuLabel>
                {gradingPeriods.map((period) => (
                  <DropdownMenuItem
                    key={period._id}
                    onClick={() => handleAddToPeriod(period._id, period.name)}
                    className="cursor-pointer flex items-center justify-between"
                  >
                    <span className="truncate">{period.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {period.courses?.length ?? 0} courses
                    </span>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href={`/template/${template._id}`} className="cursor-pointer">
                    Calculate online (sandbox)
                  </Link>
                </DropdownMenuItem>
              </>
            ) : (
              <>
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                  No {gradingPeriodName.toLowerCase()} found
                </DropdownMenuLabel>
                <DropdownMenuItem asChild>
                  <Link href="/" className="cursor-pointer flex items-center gap-1.5">
                    <PlusCircle className="size-3.5" />
                    <span>Create a {periodSingular.toLowerCase()} first</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href={`/template/${template._id}`} className="cursor-pointer">
                    Calculate online (sandbox)
                  </Link>
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

export default function TemplatesPage() {
  const { isAuthenticated } = useConvexAuth();
  const settings = useQuery(api.settings.get);
  const updateSettings = useMutation(api.settings.update);
  const gradingPeriods = useQuery(
    api.gradingPeriods.get,
    isAuthenticated ? {} : "skip"
  );

  const [searchQuery, setSearchQuery] = useState("");
  const [university, setUniversity] = useState<string>("");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState<number | undefined>(undefined);
  const [isSearching, setIsSearching] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Set page title
  useEffect(() => {
    document.title = "Course Templates - Heavyweight";
  }, []);

  // Preload user's university from settings once loaded
  useEffect(() => {
    if (settings !== undefined && !settingsLoaded) {
      if (settings?.university) {
        setUniversity(settings.university);
      }
      setSettingsLoaded(true);
    }
  }, [settings, settingsLoaded]);

  const loadTemplates = useCallback(
    async (query: string, uni: string, pageNum: number, append: boolean) => {
      if (pageNum === 1) {
        setLoading(true);
      }
      setIsSearching(false);
      try {
        const result = await fetchTemplates(query, uni, pageNum);
        if (append) {
          setTemplates((prev) => [...prev, ...result.data]);
        } else {
          setTemplates(result.data);
        }
        setHasMore(result.hasMore);
        setTotalCount(result.total);
        setPage(pageNum);
      } catch (error) {
        console.error("Failed to load templates:", error);
        toast.error("Failed to load templates");
      } finally {
        setLoading(false);
        setIsSearching(false);
      }
    },
    []
  );

  // Initial load once settings check is done
  useEffect(() => {
    if (settingsLoaded) {
      loadTemplates(searchQuery, university, 1, false);
    }
  }, [settingsLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // Search with debounce
  useEffect(() => {
    if (!settingsLoaded) return;

    const timeoutId = setTimeout(() => {
      setIsSearching(true);
      loadTemplates(searchQuery, university, 1, false);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, university, settingsLoaded, loadTemplates]);

  // Infinite scroll
  useEffect(() => {
    if (!hasMore || loading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading && !isSearching) {
          loadTemplates(searchQuery, university, page + 1, true);
        }
      },
      { threshold: 0.1, rootMargin: "100px" }
    );

    if (sentinelRef.current) {
      observer.observe(sentinelRef.current);
    }

    observerRef.current = observer;

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [hasMore, loading, isSearching, page, searchQuery, university, loadTemplates]);

  const handleUniversityChange = async (value: string) => {
    setUniversity(value);
    if (settings && value !== settings?.university) {
      try {
        await updateSettings({ university: value });
      } catch {
        // Ignore if user isn't authenticated
      }
    }
  };

  const handleClearFilters = () => {
    setSearchQuery("");
    setUniversity("");
  };

  const hasActiveFilters = Boolean(searchQuery.trim() || university);

  return (
    <div className="flex flex-col gap-4 w-full container max-w-4xl px-6 mx-auto py-12 pb-24">
      {/* Search & Filters Panel */}
      <div className="p-4 border border-border rounded-lg bg-card flex flex-col gap-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="template-search" className="text-xs font-semibold uppercase text-muted-foreground">
              Search Courses
            </Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
              <Input
                id="template-search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by course code, title, or instructor..."
                className="pl-9 pr-8"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Clear search"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="university-filter" className="text-xs font-semibold uppercase text-muted-foreground">
                University Filter
              </Label>
              {university && (
                <button
                  type="button"
                  onClick={() => handleUniversityChange("")}
                  className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
                >
                  All Universities
                </button>
              )}
            </div>
            <Combobox
              fetchOptions={fetchColleges}
              value={university}
              onValueChange={handleUniversityChange}
              placeholder="All Universities"
              searchPlaceholder="Search universities..."
              emptyText="No universities found."
            />
          </div>
        </div>

        {/* Active Filters */}
        {hasActiveFilters && (
          <div className="flex items-center justify-between pt-2 border-t border-border text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-muted-foreground">Filters:</span>
              {searchQuery.trim() && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-secondary text-secondary-foreground">
                  Query: &quot;{searchQuery}&quot;
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    aria-label="Remove search filter"
                    className="hover:text-destructive"
                  >
                    <X className="size-3" />
                  </button>
                </span>
              )}
              {university && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-secondary text-secondary-foreground">
                  {university}
                  <button
                    type="button"
                    onClick={() => handleUniversityChange("")}
                    aria-label="Remove university filter"
                    className="hover:text-destructive"
                  >
                    <X className="size-3" />
                  </button>
                </span>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearFilters}
              className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
            >
              Clear all
            </Button>
          </div>
        )}
      </div>

      {/* Results Count Header */}
      <div className="flex items-center justify-between px-0.5">
        <div className="text-sm text-muted-foreground">
          {loading && templates.length === 0 ? (
            "Loading templates..."
          ) : isSearching ? (
            "Searching templates..."
          ) : totalCount !== undefined ? (
            `${totalCount} ${totalCount === 1 ? "template" : "templates"} found`
          ) : (
            `${templates.length} ${templates.length === 1 ? "template" : "templates"} loaded`
          )}
        </div>
      </div>

      {/* Template Grid - 2 Columns */}
      {loading && templates.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="p-4 border border-border rounded-lg bg-card animate-pulse space-y-3">
              <div className="h-4 w-1/3 bg-muted rounded" />
              <div className="h-5 w-3/4 bg-muted rounded" />
              <div className="h-3 w-1/2 bg-muted rounded" />
              <div className="flex gap-2 pt-2">
                <div className="h-5 w-16 bg-muted rounded" />
                <div className="h-5 w-16 bg-muted rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-4 border border-border rounded-lg bg-card text-center p-6">
          <BookOpen className="size-12 text-muted-foreground" />
          <h2 className="text-xl font-semibold">No templates found</h2>
          <p className="text-muted-foreground text-sm max-w-sm">
            {hasActiveFilters
              ? "No course templates match your current filters. Try adjusting your search or university filter."
              : "No course templates are available at this moment."}
          </p>
          {hasActiveFilters && (
            <Button variant="outline" size="sm" onClick={handleClearFilters}>
              Clear Filters
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {templates.map((template) => (
              <TemplateCard
                key={template._id}
                template={template}
                gradingPeriods={gradingPeriods ?? undefined}
                isAuthenticated={isAuthenticated}
              />
            ))}
          </div>

          {/* Infinite Scroll Sentinel / Loading Indicator */}
          {hasMore && (
            <div ref={sentinelRef} className="flex justify-center py-6">
              {loading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Loading more templates...
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
