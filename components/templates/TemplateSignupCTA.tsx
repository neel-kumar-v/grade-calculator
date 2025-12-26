"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { Authenticated, Unauthenticated } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { SignIn } from "../auth/SignIn";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "../ui/dialog";

export function TemplateSignupCTA() {
  const router = useRouter();
  const updateSettings = useMutation(api.settings.update);
  const settings = useQuery(api.settings.get);

  const [showSignIn, setShowSignIn] = useState(false);
  const [wasUnauthenticated, setWasUnauthenticated] = useState(true);

  // Check authentication state and handle post-signup flow
  useEffect(() => {
    const checkAuthAndProcess = async () => {
      // If we were unauthenticated and now we're authenticated, save template data and redirect
      if (!wasUnauthenticated) return;

      const stored = sessionStorage.getItem("templateCourseData");
      const templateData = sessionStorage.getItem("templateTemplateData");
      if (stored && templateData && settings !== undefined) {
        // User is now authenticated (settings loaded)
        try {
          const courseData = JSON.parse(stored);
          const templateInfo = JSON.parse(templateData);
          
          // Update user's university setting with retry logic
          // Wait a bit for user record to be fully created after signup
          if (templateInfo.university && (!settings?.university || settings.university !== templateInfo.university)) {
            let retries = 3;
            let success = false;
            while (retries > 0 && !success) {
              try {
                await updateSettings({ university: templateInfo.university });
                success = true;
              } catch (error: any) {
                // If it's a null _id error, wait and retry
                if (error?.message?.includes("_id") || error?.message?.includes("null")) {
                  retries--;
                  if (retries > 0) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                  }
                } else {
                  // Other errors, don't retry
                  throw error;
                }
              }
            }
          }
          
          // Save template data for tour
          sessionStorage.setItem("templateTourData", JSON.stringify({
            courseName: courseData.name,
            university: templateInfo.university,
          }));
          
          // Set flag to start tour
          sessionStorage.setItem("startTemplateTour", "true");
          sessionStorage.setItem("isNewUser", "true");
          
          // Clear template course data (we'll import it during tour)
          sessionStorage.removeItem("templateCourseData");
          sessionStorage.removeItem("templateTemplateData");
          
          // Close sign in modal
          setShowSignIn(false);
          
          // Redirect to root to start tour after a delay to ensure auth state is updated
          setTimeout(() => {
            router.push("/");
          }, 300);
        } catch (e) {
          console.error("Failed to parse stored data:", e);
        }
      }
    };

    if (settings !== null) {
      // User is authenticated
      if (wasUnauthenticated) {
        // Add a small delay to ensure user record is fully created
        setTimeout(() => {
          checkAuthAndProcess();
        }, 100);
      }
      setWasUnauthenticated(false);
    } else if (settings === null) {
      // User is not authenticated
      setWasUnauthenticated(true);
    }
  }, [settings, wasUnauthenticated, updateSettings, router]);

  const handleSaveGrades = () => {
    setShowSignIn(true);
  };

  const handleSignInClose = () => {
    setShowSignIn(false);
  };


  return (
    <>
      <Unauthenticated>
        <div className="fixed animate-in fade-in-0 duration-300 fade-out-0 bottom-0 left-0 right-0 z-50 p-4 bg-transparent flex justify-end items-center shadow-lg">
          <Card className="max-w-2xl min-w-[25vw]">
            <CardHeader className="pb-3">
              <CardTitle className="text-xl">Save Your Grade</CardTitle>
              <CardDescription className="text-sm text-muted-foreground">Sign up to save your grades and unlock What-if mode!</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-end gap-2">
                {/* <p className="text-sm text-muted-foreground">
                  Sign up to save your grades
                </p> */}
                <Button variant="outline">I'd rather forget 😭</Button>
                <Button onClick={handleSaveGrades}>Save Grades</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </Unauthenticated>

      <Dialog open={showSignIn} onOpenChange={handleSignInClose}>
        <DialogContent className="max-w-md bg-card">
          <DialogTitle className="sr-only">Sign Up</DialogTitle>
          <SignIn initialStep="signUp" />
        </DialogContent>
      </Dialog>

    </>
  );
}

