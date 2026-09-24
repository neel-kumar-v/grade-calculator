"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { Unauthenticated } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { SignIn } from "../auth/SignIn";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "../ui/dialog";
import { toast } from "sonner";
import { loadTemplateDraft, migrateLegacyTemplateSessionDraft } from "../../lib/templateDraft";

interface TemplateSignupCTAProps {
  templateId: string;
}

function getDefaultPeriodName(settingsName?: "Semesters" | "Trimesters" | "Quarters") {
  const plural = settingsName ?? "Semesters";
  const singular = plural.endsWith("s") ? plural.slice(0, -1) : plural;
  return `${singular} 1`;
}

export function TemplateSignupCTA({ templateId }: TemplateSignupCTAProps) {
  const router = useRouter();
  const updateSettings = useMutation(api.settings.update);
  const createGradingPeriod = useMutation(api.gradingPeriods.create);
  const addCourse = useMutation(api.gradingPeriods.addCourse);
  const settings = useQuery(api.settings.get);

  const [showSignIn, setShowSignIn] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const handleSaveGrades = () => {
    setShowSignIn(true);
  };

  const handleSignInClose = () => {
    setShowSignIn(false);
  };

  const handleAuthSuccess = async () => {
    const draft =
      loadTemplateDraft(templateId) ??
      migrateLegacyTemplateSessionDraft(templateId, {
        university: "",
        courseCode: "",
        courseTitle: "",
        instructor: "",
      });

    if (!draft) {
      toast.error("Could not find your template progress to import.");
      return;
    }

    setIsImporting(true);
    try {
      if (
        draft.university &&
        (!settings?.university || settings.university !== draft.university)
      ) {
        await updateSettings({ university: draft.university });
      }

      const gradingPeriodId = await createGradingPeriod({
        name: getDefaultPeriodName(settings?.gradingPeriodName),
        isCompleted: false,
        courses: [],
      });

      const courseResult = await addCourse({
        id: gradingPeriodId,
        course: draft.course,
      });

      setShowSignIn(false);
      router.push(`/${gradingPeriodId}/${courseResult.courseIndex}`);
    } catch (error) {
      console.error("Failed to import template draft:", error);
      toast.error("Could not import your template yet. Please try again.");
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <>
      <Unauthenticated>
        {!dismissed && (
          <div className="fixed animate-in fade-in-0 duration-300 bottom-4 right-4 z-50 pointer-events-none">
            <Card className="w-[340px] pointer-events-auto shadow-lg">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Save your progress</CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Sign up to save these grades and keep editing later.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => setDismissed(true)}>
                    Maybe later
                  </Button>
                  <Button onClick={handleSaveGrades} size="sm">
                    Save grades
                  </Button>
                </div>
                <Link
                  href="/template"
                  className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
                >
                  Find more templates
                </Link>
              </CardContent>
            </Card>
          </div>
        )}
      </Unauthenticated>

      <Dialog open={showSignIn} onOpenChange={handleSignInClose}>
        <DialogContent className="max-w-sm bg-card">
          <DialogTitle className="sr-only">Sign Up</DialogTitle>
          <div className="space-y-2">
            <SignIn
              initialStep="signUp"
              disableDefaultPostSignupRedirect
              onAuthSuccess={handleAuthSuccess}
            />
            <div className="flex items-center justify-between px-1">
              <Link
                href="/template"
                className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
              >
                Find more templates
              </Link>
              {isImporting && (
                <span className="text-xs text-muted-foreground">Importing...</span>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </>
  );
}
