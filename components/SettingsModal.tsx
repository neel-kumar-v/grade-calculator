"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { Check, Plus, Trash, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Combobox } from "./ui/combobox";
import { SCALE_NAMES, getScaleDisplayName, getScaleByName, type GradeStep } from "../lib/gpa";

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsModal({ open, onOpenChange }: SettingsModalProps) {
  const settings = useQuery(api.settings.get);
  const updateSettings = useMutation(api.settings.update);
  const recalculateGPAs = useMutation(api.settings.recalculateAllGPAs);

  const [gradingPeriodName, setGradingPeriodName] = useState<"Semesters" | "Trimesters" | "Quarters">("Semesters");
  const [gpaScale, setGpaScale] = useState<string>("STANDARD_4_0");
  const [customScale, setCustomScale] = useState<GradeStep[]>([]);
  const [university, setUniversity] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const previousGpaScaleRef = useRef<string>("STANDARD_4_0");
  const [isInitialized, setIsInitialized] = useState(false);

  // Load settings when they're available, or initialize defaults
  useEffect(() => {
    if (settings === undefined) return; // Still loading
    
    if (settings !== null) {
      // Settings exist, load them
      const settingsDoc = settings as any;
      if (!isInitialized) {
        setGradingPeriodName(settingsDoc.gradingPeriodName || "Semesters");
        setGpaScale(settingsDoc.gpaScale || "STANDARD_4_0");
        setCustomScale(settingsDoc.customScale || []);
        setUniversity(settingsDoc.university || "");
        previousGpaScaleRef.current = settingsDoc.gpaScale || "STANDARD_4_0";
        setIsInitialized(true);
      }
    } else if (settings === null && !isInitialized && open) {
      // Settings don't exist yet, initialize with defaults and create them immediately
      setGradingPeriodName("Semesters");
      setGpaScale("STANDARD_4_0");
      setCustomScale([]);
      setUniversity("");
      previousGpaScaleRef.current = "STANDARD_4_0";
      setIsInitialized(true);
      // Create settings immediately
      updateSettings({
        gradingPeriodName: "Semesters",
        gpaScale: "STANDARD_4_0",
        customScale: undefined,
        university: undefined,
      }).catch(console.error);
    }
  }, [settings, isInitialized, open, updateSettings]);

  // Get the current scale for display
  const currentScale = useMemo(() => {
    return getScaleByName(gpaScale, gpaScale === SCALE_NAMES.CUSTOM ? customScale : undefined);
  }, [gpaScale, customScale]);

  // Debounced save function
  useEffect(() => {
    if (!open || !isInitialized) return; // Don't save until initialized

    const timeoutId = setTimeout(async () => {
      setSaving(true);
      setSaved(false);
      
      try {
        const scaleChanged = previousGpaScaleRef.current !== gpaScale;
        
        await updateSettings({
          gradingPeriodName,
          gpaScale,
          customScale: gpaScale === SCALE_NAMES.CUSTOM ? customScale : undefined,
          university: university || undefined,
        });

        // If scale changed, recalculate all GPAs
        if (scaleChanged) {
          await recalculateGPAs({});
          previousGpaScaleRef.current = gpaScale;
        }

        setSaving(false);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } catch (error) {
        console.error("Failed to save settings:", error);
        setSaving(false);
      }
    }, 2000);

    return () => clearTimeout(timeoutId);
  }, [open, isInitialized, gradingPeriodName, gpaScale, customScale, university, updateSettings, recalculateGPAs]);

  const handleCustomScaleChange = (index: number, field: "minPercentage" | "gpa", value: number) => {
    const updated = [...customScale];
    updated[index] = { ...updated[index], [field]: value };
    setCustomScale(updated);
  };

  const addCustomScaleRow = () => {
    const lastStep = customScale[customScale.length - 1];
    const newMinPercentage = lastStep ? Math.max(0, lastStep.minPercentage - 5) : 0;
    setCustomScale([...customScale, { minPercentage: newMinPercentage, gpa: 0.0 }]);
  };

  const removeCustomScaleRow = (index: number) => {
    setCustomScale(customScale.filter((_, i) => i !== index));
  };

  const validateCustomScale = (): boolean => {
    if (gpaScale !== SCALE_NAMES.CUSTOM) return true;
    if (customScale.length === 0) return false;
    
    // Check descending order
    for (let i = 0; i < customScale.length - 1; i++) {
      if (customScale[i].minPercentage < customScale[i + 1].minPercentage) {
        return false;
      }
    }
    return true;
  };

  const fetchColleges = async (query: string, page: number) => {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: "20",
    });
    if (query) {
      params.append("query", query);
    }

    const res = await fetch(`/api/college_search?${params}`);
    if (!res.ok) {
      throw new Error("Failed to fetch colleges");
    }
    const json = await res.json();
    return {
      data: json.data,
      hasMore: json.pagination.hasMore,
    };
  };

  const isCustom = gpaScale === SCALE_NAMES.CUSTOM;
  const isWAM = gpaScale === SCALE_NAMES.WAM;
  const isValidCustom = validateCustomScale();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Choose how you want to calculate your grades.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Grading Period Naming */}
          <div className="space-y-2 flex flex-row gap-2 items-center">
            <Label htmlFor="grading-period-name">Grading Period Name</Label>
            <Select value={gradingPeriodName} onValueChange={(value) => setGradingPeriodName(value as typeof gradingPeriodName)}>
              <SelectTrigger id="grading-period-name">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Semesters">Semesters</SelectItem>
                <SelectItem value="Trimesters">Trimesters</SelectItem>
                <SelectItem value="Quarters">Quarters</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* University Selection */}
          <div className="space-y-2 flex flex-col">
            <Label htmlFor="university">University</Label>
            <Combobox
              fetchOptions={fetchColleges}
              value={university}
              onValueChange={setUniversity}
              placeholder="Select your university..."
              searchPlaceholder="Search universities..."
              emptyText="No universities found."
            />
          </div>

          {/* GPA Scale Selection */}
          <div className="space-y-2">
            <div className="flex flex-row gap-2 items-center">
              <Label htmlFor="gpa-scale">GPA Scale</Label>
              <Select value={gpaScale} onValueChange={(value) => {
                setGpaScale(value);
                // Initialize custom scale if switching to custom and it's empty
                if (value === SCALE_NAMES.CUSTOM && customScale.length === 0) {
                  setCustomScale([
                    { minPercentage: 93, gpa: 4.0 },
                    { minPercentage: 90, gpa: 3.7 },
                    { minPercentage: 87, gpa: 3.3 },
                    { minPercentage: 83, gpa: 3.0 },
                    { minPercentage: 80, gpa: 2.7 },
                    { minPercentage: 77, gpa: 2.3 },
                    { minPercentage: 73, gpa: 2.0 },
                    { minPercentage: 70, gpa: 1.7 },
                    { minPercentage: 67, gpa: 1.3 },
                    { minPercentage: 65, gpa: 1.0 },
                    { minPercentage: 0, gpa: 0.0 },
                  ]);
                }
              }}>
                <SelectTrigger id="gpa-scale">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SCALE_NAMES.STANDARD_4_0}>
                    {getScaleDisplayName(SCALE_NAMES.STANDARD_4_0)}
                  </SelectItem>
                  <SelectItem value={SCALE_NAMES.STRICT_4_0}>
                    {getScaleDisplayName(SCALE_NAMES.STRICT_4_0)}
                  </SelectItem>
                  <SelectItem value={SCALE_NAMES.SCALE_4_3}>
                    {getScaleDisplayName(SCALE_NAMES.SCALE_4_3)}
                  </SelectItem>
                  <SelectItem value={SCALE_NAMES.WEIGHTED_5_0}>
                    {getScaleDisplayName(SCALE_NAMES.WEIGHTED_5_0)}
                  </SelectItem>
                  <SelectItem value={SCALE_NAMES.AUS_7_0}>
                    {getScaleDisplayName(SCALE_NAMES.AUS_7_0)}
                  </SelectItem>
                  <SelectItem value={SCALE_NAMES.WAM}>
                    {getScaleDisplayName(SCALE_NAMES.WAM)}
                  </SelectItem>
                  <SelectItem value={SCALE_NAMES.CUSTOM}>
                    {getScaleDisplayName(SCALE_NAMES.CUSTOM)}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            {/* Scale Details */}
            {isWAM ? (
              <div className="p-4 border border-border rounded-lg bg-muted/50">
                <p className="text-sm text-muted-foreground">
                  WAM (Weighted Average Marks) uses your raw percentage grades without GPA conversion. 
                  All GPA labels will be replaced with "WAM" throughout the application.
                </p>
              </div>
            ) : currentScale !== "WAM" && Array.isArray(currentScale) ? (
              <div className="space-y-2">
                {/* <Label>Scale Details</Label>   */}
                <div className="border border-border rounded-lg overflow-y-auto max-h-[30vh] p-2">
                  {isCustom ? (
                    <>
                      {customScale.map((step, index) => (
                        <div
                          key={index}
                          className="flex flex-row gap-2 items-center p-2 "
                        >
                          <Input
                            type="number"
                            variant="small"
                            value={step.minPercentage}
                            onChange={(e) =>
                              handleCustomScaleChange(index, "minPercentage", parseFloat(e.target.value) || 0)
                            }
                            placeholder="Min %"
                          />
                          <Input
                            type="number"
                            variant="small"
                            step="0.1"
                            value={step.gpa}
                            onChange={(e) =>
                              handleCustomScaleChange(index, "gpa", parseFloat(e.target.value) || 0)
                            }
                            placeholder="GPA"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeCustomScaleRow(index)}
                          >
                            <Trash className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      <div className="p-2 border-t border-border">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={addCustomScaleRow}
                          className="w-full"
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Add Row
                        </Button>
                      </div>
                      {!isValidCustom && customScale.length > 0 && (
                        <div className="p-2 border-t border-border">
                          <p className="text-sm text-destructive">
                            Min percentage values must be in descending order.
                          </p>
                        </div>
                      )}
                    </>
                  ) : (
                    currentScale.map((step, index) => (
                      <div
                        key={index}
                        className="flex flex-row gap-2 items-center p-2"
                      >
                        <Input
                          type="number"
                          variant="small"
                          value={step.minPercentage}
                          readOnly
                          className="bg-muted"
                        />
                        <Input
                          type="number"
                          variant="small"
                          step="0.1"
                          value={step.gpa}
                          readOnly
                          className="bg-muted"
                        />
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : null}
          </div>

          {/* Saving Indicator */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {saving && (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Saving...</span>
              </>
            )}
            {saved && !saving && (
              <>
                <Check className="h-4 w-4 text-green-600" />
                <span className="text-green-600">Saved</span>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

