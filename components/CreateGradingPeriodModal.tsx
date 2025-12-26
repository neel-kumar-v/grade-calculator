"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
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
import { HelpCircle } from "lucide-react";
import { useGradingPeriodName } from "../hooks/useGradingPeriodName";

interface CreateGradingPeriodModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (gradingPeriodId: Id<"gradingPeriods">) => void | Promise<void>;
}

export function CreateGradingPeriodModal({
  open,
  onOpenChange,
  onSuccess,
}: CreateGradingPeriodModalProps) {
  const router = useRouter();
  const createGradingPeriod = useMutation(api.gradingPeriods.create);
  const gradingPeriodName = useGradingPeriodName();
  const [name, setName] = useState("");
  const [isCompleted, setIsCompleted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      const gradingPeriodId = await createGradingPeriod({
        name: name.trim(),
        isCompleted,
        courses: [],
      });
      onOpenChange(false);
      setName("");
      setIsCompleted(false);
      
      if (onSuccess) {
        await onSuccess(gradingPeriodId);
      } else {
        router.push(`/${gradingPeriodId as string}`);
      }
    } catch (error) {
      console.error("Failed to create grading period:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
    setName("");
    setIsCompleted(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create {gradingPeriodName.slice(0, -1)}</DialogTitle>
          <DialogDescription>
            Create a new {gradingPeriodName.toLowerCase().slice(0, -1)} to track your courses and grades.
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
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !name.trim()}>
              {isSubmitting ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

