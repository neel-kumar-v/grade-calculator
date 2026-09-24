"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Download } from "lucide-react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Card, CardTitle } from "../../components/ui/card";
import { Combobox } from "../../components/ui/combobox";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Button } from "../../components/ui/button";
import { toast } from "sonner";
import type { Doc } from "../../convex/_generated/dataModel";

type Template = Doc<"templates">;

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
    limit: "30",
  });
  if (query) params.append("query", query);
  if (university) params.append("university", university);

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

export default function TemplateIndexPage() {
  const settings = useQuery(api.settings.get);
  const updateSettings = useMutation(api.settings.update);

  const [searchQuery, setSearchQuery] = useState("");
  const [university, setUniversity] = useState("");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  const loadTemplates = useCallback(
    async (query: string, uni: string, pageNum: number, append: boolean) => {
      setLoading(true);
      try {
        const result = await fetchTemplates(query, uni, pageNum);
        setTemplates((prev) => (append ? [...prev, ...result.data] : result.data));
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

  useEffect(() => {
    if (settings?.university) {
      setUniversity(settings.university);
    }
  }, [settings]);

  useEffect(() => {
    loadTemplates("", university, 1, false);
  }, [university, loadTemplates]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setIsSearching(true);
      loadTemplates(searchQuery, university, 1, false);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, university, loadTemplates]);

  const handleUniversityChange = async (value: string) => {
    setUniversity(value);
    if (settings !== null && value !== settings?.university) {
      await updateSettings({ university: value });
    }
  };

  return (
    <main className="container max-w-5xl mx-auto py-12 px-6 flex flex-col gap-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold">Course templates</h1>
        <p className="text-sm text-muted-foreground">
          Browse public templates and open one to start calculating.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="template-search">Search</Label>
          <Input
            id="template-search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by course code, title, or instructor..."
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="template-university-filter">University filter</Label>
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

      {loading && templates.length === 0 ? (
        <div className="text-sm text-muted-foreground py-8 text-center">Loading templates...</div>
      ) : templates.length === 0 ? (
        <div className="text-sm text-muted-foreground py-8 text-center">
          {isSearching ? "Searching..." : "No templates found"}
        </div>
      ) : (
        <div className="flex flex-col gap-0 border-border rounded-lg">
          {templates.map((template) => (
            <Link key={template._id} href={`/template/${template._id}`} className="block">
              <Card className="cursor-pointer flex flex-row items-start justify-between px-4 py-3 border-y border-border first:border-t-0 last:border-b-0 rounded-none hover:bg-accent/40 hover:shadow-none">
                <div className="p-0 flex-1 min-w-0">
                  <CardTitle className="text-base font-semibold text-left">
                    {template.courseCode} - {template.instructor}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1 text-left">
                    {template.courseTitle}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">{template.university}</p>
                </div>
                <div className="flex items-center gap-1 text-muted-foreground ml-4">
                  <Download className="size-4" />
                  <span className="text-xs">{template.downloadCount}</span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {hasMore && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={() => loadTemplates(searchQuery, university, page + 1, true)}
            disabled={loading}
          >
            {loading ? "Loading..." : "Load more"}
          </Button>
        </div>
      )}
    </main>
  );
}

