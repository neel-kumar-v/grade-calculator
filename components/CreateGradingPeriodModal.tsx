"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { Id, Doc } from "../convex/_generated/dataModel";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Checkbox } from "./ui/checkbox";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { HelpCircle, Trash } from "lucide-react";
import { useGradingPeriodName } from "../hooks/useGradingPeriodName";

interface CreateGradingPeriodModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (gradingPeriodId: Id<"gradingPeriods">) => void | Promise<void>;
  editingGradingPeriod?: Doc<"gradingPeriods">;
}

export function CreateGradingPeriodModal({
  open,
  onOpenChange,
  onSuccess,
  editingGradingPeriod,
}: CreateGradingPeriodModalProps) {
  const router = useRouter();
  const createGradingPeriod = useMutation(api.gradingPeriods.create);
  const updateGradingPeriod = useMutation(api.gradingPeriods.update);
  const removeGradingPeriod = useMutation(api.gradingPeriods.remove);
  const gradingPeriodName = useGradingPeriodName();
  const isEditMode = editingGradingPeriod !== undefined;
  const [name, setName] = useState("");
  const [isCompleted, setIsCompleted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Pre-fill form when editing
  useEffect(() => {
    if (isEditMode && editingGradingPeriod) {
      setName(editingGradingPeriod.name);
      setIsCompleted(editingGradingPeriod.isCompleted ?? false);
    } else {
      resetForm();
    }
  }, [isEditMode, editingGradingPeriod, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      if (isEditMode && editingGradingPeriod) {
        // Update existing grading period
        await updateGradingPeriod({
          id: editingGradingPeriod._id,
          name: name.trim(),
          isCompleted,
        });
        toast.success("Grading period updated successfully");
      } else {
        // Create new grading period
        const gradingPeriodId = await createGradingPeriod({
          name: name.trim(),
          isCompleted,
          courses: [],
        });
        
        if (onSuccess) {
          await onSuccess(gradingPeriodId);
        } else {
          router.push(`/${gradingPeriodId as string}`);
        }
      }
      onOpenChange(false);
      resetForm();
    } catch (error) {
      console.error(`Failed to ${isEditMode ? "update" : "create"} grading period:`, error);
      toast.error(`Failed to ${isEditMode ? "update" : "create"} grading period. Please try again.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setName("");
    setIsCompleted(false);
  };

  const handleCancel = () => {
    onOpenChange(false);
    resetForm();
  };

  const handleDelete = async () => {
    if (!isEditMode || !editingGradingPeriod) return;

    setIsSubmitting(true);
    try {
      await removeGradingPeriod({
        id: editingGradingPeriod._id,
      });
      toast.success("Grading period deleted successfully");
      onOpenChange(false);
      resetForm();
      // Navigate back to home page after deletion
      router.push("/");
    } catch (error) {
      console.error("Failed to delete grading period:", error);
      toast.error("Failed to delete grading period. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditMode ? "Edit Grading Period" : `Create ${gradingPeriodName.slice(0, -1)}`}</DialogTitle>
          <DialogDescription>
            {isEditMode 
              ? "Edit the grading period details." 
              : `Create a new ${gradingPeriodName.toLowerCase().slice(0, -1)} to track your courses and grades.`}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Fall 2024"
                required
                autoFocus
              />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="isCompleted"
                checked={isCompleted}
                onCheckedChange={(checked) => setIsCompleted(checked === true)}
              />
              <div className="flex items-center gap-2">
                <Label
                  htmlFor="isCompleted"
                  className="font-normal cursor-pointer"
                >
                  Is completed / Past grading period
                </Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="size-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      Check this if this {gradingPeriodName.toLowerCase().slice(0, -1)} has already ended and
                      you're entering historical grades.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          </div>
          <DialogFooter className="flex items-center justify-between">
            {isEditMode && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={isSubmitting}
                className="mr-auto"
              >
                <Trash className="size-4" />
                Delete Grading Period
              </Button>
            )}
            <div className="flex gap-2 ml-auto">
              <Button type="button" variant="outline" onClick={handleCancel} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting || !name.trim()}>
                {isSubmitting 
                  ? (isEditMode ? "Saving..." : "Creating...") 
                  : (isEditMode ? "Save Edits" : "Create")}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

