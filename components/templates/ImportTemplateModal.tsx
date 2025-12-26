"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Combobox } from "../ui/combobox";
import { Card, CardHeader, CardTitle } from "../ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { Download } from "lucide-react";
import { toast } from "sonner";
import type { Doc } from "../../convex/_generated/dataModel";

type Template = Doc<"templates">;

interface TemplateListItemProps {
  template: Template;
  isSelected: boolean;
  onSelect: () => void;
}

function TemplateListItem({ template, isSelected, onSelect }: TemplateListItemProps) {
  const categoryWeights = template.categories.map((cat) => ({
    name: cat.name,
    weight: cat.weight,
  }));

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Card
          className={`cursor-pointer flex flex-row items-start justify-center px-4 py-3 border-y border-border first:border-t last:border-b rounded-none hover:shadow-none ${
            isSelected ? "bg-muted-foreground/25" : "bg-background"
          }`}
          onClick={onSelect}
        >
          <div className="p-0 flex-1">
            <div className="flex flex-col items-start">
              <CardTitle className="text-base font-semibold text-left w-full">
                {template.courseCode} - {template.instructor}
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1 text-left">
                {template.courseTitle}
              </p>
            </div>
          </div>
          <div className="flex self-center ml-4">
            <div className="flex items-center gap-1 text-muted-foreground">
              <Download className="size-4" />
              <span className="text-xs">{template.downloadCount}</span>
            </div>
          </div>
        </Card>
      </TooltipTrigger>
      <TooltipContent side="left" className="max-w-xs">
        <div className="space-y-1">
          <div className="font-semibold mb-2">Category Weights:</div>
          {categoryWeights.map((cat, idx) => (
            <div key={idx} className="flex justify-between gap-4">
              <span>{cat.name}</span>
              <span>{cat.weight}%</span>
            </div>
          ))}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

interface ImportTemplateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (template: Template) => void;
}

async function fetchColleges(query: string, page: number): Promise<{ data: string[]; hasMore: boolean }> {
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
): Promise<{ data: Template[]; hasMore: boolean }> {
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
  };
}

export function ImportTemplateModal({
  open,
  onOpenChange,
  onImport,
}: ImportTemplateModalProps) {
  const settings = useQuery(api.settings.get);
  const updateSettings = useMutation(api.settings.update);

  const [searchQuery, setSearchQuery] = useState("");
  const [university, setUniversity] = useState<string>("");
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Load user's university from settings
  useEffect(() => {
    if (settings?.university) {
      setUniversity(settings.university);
    }
  }, [settings]);

  // Load initial templates
  useEffect(() => {
    if (open) {
      loadTemplates("", university, 1, false);
    }
  }, [open, university]);

  const loadTemplates = useCallback(
    async (query: string, uni: string, pageNum: number, append: boolean) => {
      setLoading(true);
      setIsSearching(false);
      try {
        const result = await fetchTemplates(query, uni, pageNum);
        if (append) {
          setTemplates((prev) => [...prev, ...result.data]);
        } else {
          setTemplates(result.data);
        }
        setHasMore(result.hasMore);
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

  // Handle search with debounce
  useEffect(() => {
    if (!open) return;

    const timeoutId = setTimeout(() => {
      setIsSearching(true);
      loadTemplates(searchQuery, university, 1, false);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, university, open, loadTemplates]);

  // Infinite scroll setup
  useEffect(() => {
    if (!open || !hasMore || loading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          loadTemplates(searchQuery, university, page + 1, true);
        }
      },
      { threshold: 0.1 }
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
  }, [open, hasMore, loading, page, searchQuery, university, loadTemplates]);

  const handleUniversityChange = async (value: string) => {
    setUniversity(value);
    // Update user settings if changed
    if (value !== settings?.university) {
      await updateSettings({ university: value });
    }
  };

  const handleImport = () => {
    if (!selectedTemplate) return;
    onImport(selectedTemplate);
    handleClose();
  };

  const handleClose = () => {
    setSearchQuery("");
    setSelectedTemplate(null);
    setTemplates([]);
    setPage(1);
    setHasMore(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-[60vw] min-w-[700px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Import Template</DialogTitle>
          <DialogDescription>
            Search for course templates to import category structures.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 shrink-0">
          <div className="space-y-2">
            <Label htmlFor="search">Search</Label>
            <Input
              id="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by course code, title, or instructor..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="university-filter">University Filter</Label>
            <Combobox
              fetchOptions={fetchColleges}
              value={university}
              onValueChange={handleUniversityChange}
              placeholder="Select your university..."
              searchPlaceholder="Search universities..."
              emptyText="No universities found."
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 mt-4">
          {loading && templates.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-muted-foreground">Loading templates...</div>
            </div>
          ) : templates.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-muted-foreground">
                {isSearching ? "Searching..." : "No templates found"}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-0">
              {templates.map((template) => (
                <TemplateListItem
                  key={template._id}
                  template={template}
                  isSelected={selectedTemplate?._id === template._id}
                  onSelect={() => setSelectedTemplate(template)}
                />
              ))}
              {hasMore && (
                <div ref={sentinelRef} className="h-4" />
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleImport}
            disabled={!selectedTemplate}
          >
            Import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

