"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Authenticated, Unauthenticated, useQuery } from "convex/react";
import { Scale, Weight } from "lucide-react";
import { api } from "../convex/_generated/api";
import { useGradingPeriodName } from "../hooks/useGradingPeriodName";
import type { Id } from "../convex/_generated/dataModel";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "./ui/navigation-menu";
import { ThemeToggle } from "./ThemeToggle";
import { SignOut } from "./auth/SignOut";
import { Button } from "./ui/button";
import { Settings } from "lucide-react";
import { SettingsModal } from "./SettingsModal";
import { useState } from "react";

interface NavContext {
  depth: number;
  gradingPeriodId: string | null;
  courseIndex: number | null;
  gradingPeriods:
    | ReturnType<typeof useQuery<typeof api.gradingPeriods.get>>
    | undefined;
  // When there is a gradingPeriodId this is the result of getById,
  // otherwise it may be the result of get (but is never used in that case).
  currentGradingPeriod: any;
}

function useNavContext(): NavContext {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  const depth = segments.length;
  const gradingPeriodId = depth >= 1 ? segments[0] : null;
  const courseIndexRaw = depth >= 2 ? Number(segments[1]) : NaN;
  const courseIndex =
    Number.isFinite(courseIndexRaw) && courseIndexRaw >= 0
      ? courseIndexRaw
      : null;

  const gradingPeriods = useQuery(api.gradingPeriods.get, {});

  // Always call hooks in the same order on every render.
  // Switch query + args based on whether we have a gradingPeriodId,
  // but still invoke a single useQuery call.
  const currentGradingPeriod = useQuery(
    gradingPeriodId ? api.gradingPeriods.getById : api.gradingPeriods.get,
    gradingPeriodId
      ? { id: gradingPeriodId as Id<"gradingPeriods"> }
      : {}
  );

  return {
    depth,
    gradingPeriodId,
    courseIndex,
    gradingPeriods,
    currentGradingPeriod,
  };
}

function GradingPeriodNavItem({
  depth,
  gradingPeriodId,
  gradingPeriods,
  currentGradingPeriod,
}: {
  depth: number;
  gradingPeriodId: string | null;
  gradingPeriods:
    | ReturnType<typeof useQuery<typeof api.gradingPeriods.get>>
    | undefined;
  currentGradingPeriod:
    | ReturnType<typeof useQuery<typeof api.gradingPeriods.getById>>
    | undefined;
}) {
  const gradingPeriodName = useGradingPeriodName();
  const hasList = Array.isArray(gradingPeriods) && gradingPeriods.length > 0;
  const isRootPage = depth === 0;
  
  // On root page, show grading period name without a link
  if (isRootPage) {
    return (
      <NavigationMenuItem>
        <NavigationMenuTrigger className="font-medium">
          <span className="flex items-center gap-1">{gradingPeriodName}</span>
        </NavigationMenuTrigger>
        {hasList && (
          <NavigationMenuContent>
            <ul className="flex flex-col w-full gap-1">
              {gradingPeriods!.map((period) => (
                <li key={period._id}>
                  <NavigationMenuLink asChild>
                    <Link
                      href={`/${period._id}`}
                      className="flex items-center justify-between"
                    >
                      <span>{period.name}</span>
                    </Link>
                  </NavigationMenuLink>
                </li>
              ))}
            </ul>
          </NavigationMenuContent>
        )}
      </NavigationMenuItem>
    );
  }

  // On grading period page, show grading period name with link
  if (!gradingPeriodId || currentGradingPeriod === null) {
    return null;
  }
  
  const label =
    currentGradingPeriod && currentGradingPeriod !== undefined
      ? currentGradingPeriod.name
      : `Loading ${gradingPeriodName.toLowerCase().slice(0, -1)}...`;

  return (
    <NavigationMenuItem>
      <NavigationMenuTrigger className="font-medium">
        <Link href={`/${gradingPeriodId}`} className="flex items-center gap-1">
          {label}
        </Link>
      </NavigationMenuTrigger>
      {hasList && (
        <NavigationMenuContent>
          <ul className="flex flex-col w-full gap-1">
            {gradingPeriods!.map((period) => (
              <li key={period._id}>
                <NavigationMenuLink asChild>
                  <Link
                    href={`/${period._id}`}
                    className="flex items-center justify-between"
                  >
                    <span>{period.name}</span>
                  </Link>
                </NavigationMenuLink>
              </li>
            ))}
          </ul>
        </NavigationMenuContent>
      )}
    </NavigationMenuItem>
  );
}

function CourseNavItem({
  depth,
  gradingPeriodId,
  courseIndex,
  currentGradingPeriod,
}: {
  depth: number;
  gradingPeriodId: string | null;
  courseIndex: number | null;
  currentGradingPeriod:
    | ReturnType<typeof useQuery<typeof api.gradingPeriods.getById>>
    | undefined;
}) {
  if (!gradingPeriodId || currentGradingPeriod === null) return null;

  const courses = currentGradingPeriod?.courses ?? [];
  const hasList = Array.isArray(courses) && courses.length > 0;
  const isGradingPeriodPage = depth === 1;

  // On grading period page, show "Courses" without a link
  if (isGradingPeriodPage) {
    return (
      <NavigationMenuItem>
        <NavigationMenuTrigger className="font-medium">
          <span className="flex items-center gap-1">Courses</span>
        </NavigationMenuTrigger>
        {hasList && (
          <NavigationMenuContent>
            <ul className="flex flex-col w-full gap-1">
              {courses.map((course, index) => (
                <li key={index}>
                  <NavigationMenuLink asChild>
                    <Link
                      href={`/${gradingPeriodId}/${index}`}
                      className="flex items-center justify-between"
                    >
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{course.name}</span>
                      </div>
                    </Link>
                  </NavigationMenuLink>
                </li>
              ))}
            </ul>
          </NavigationMenuContent>
        )}
      </NavigationMenuItem>
    );
  }

  // On course page, show course name with link
  if (courseIndex === null || !Number.isFinite(courseIndex) || courseIndex < 0) {
    return null;
  }

  if (!courses || courseIndex >= courses.length) {
    return null;
  }

  const currentCourse = courses[courseIndex];
  const label = currentCourse ? currentCourse.name : "Course";

  return (
    <NavigationMenuItem>
      <NavigationMenuTrigger className="font-medium">
        <Link
          href={`/${gradingPeriodId}/${courseIndex}`}
          className="flex items-center gap-1"
        >
          {label}
        </Link>
      </NavigationMenuTrigger>
      {hasList && (
        <NavigationMenuContent>
          <ul className="flex flex-col w-full gap-1">
            {courses.map((course, index) => (
              <li key={index}>
                <NavigationMenuLink asChild>
                  <Link
                    href={`/${gradingPeriodId}/${index}`}
                    className="flex items-center justify-between"
                  >
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{course.name}</span>
                    </div>
                  </Link>
                </NavigationMenuLink>
              </li>
            ))}
          </ul>
        </NavigationMenuContent>
      )}
    </NavigationMenuItem>
  );
}

export function Navbar() {
  const {
    depth,
    gradingPeriodId,
    courseIndex,
    gradingPeriods,
    currentGradingPeriod,
  } = useNavContext();

  const [settingsOpen, setSettingsOpen] = useState(false);

  const showCourse =
    depth >= 1 &&
    gradingPeriodId &&
    currentGradingPeriod &&
    currentGradingPeriod !== undefined &&
    currentGradingPeriod !== null;

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur">
      <div className="container max-w-screen-5xl mx-auto flex h-16 items-center justify-center px-4">
        <NavigationMenu viewport={false} className="max-w-full">
          <NavigationMenuList className="flex-wrap justify-start gap-2">
            <NavigationMenuItem>
              <NavigationMenuLink
                asChild
                className="hover:bg-transparent focus:bg-transparent flex flex-row items-center gap-2 font-semibold"
              >
                <Link href="/" className="relative">
                  <Weight className="size-10 stroke-1 text-black dark:text-white" />
                  <span className="absolute inset-0 top-1.5 flex items-center justify-center text-text font-bold text-[1em] leading-none">
                    A<sup className="text-[0.8em] -translate-x-0.5 leading-none">+</sup>
                  </span>
                </Link>
              </NavigationMenuLink>
            </NavigationMenuItem>

            <GradingPeriodNavItem
              depth={depth}
              gradingPeriodId={gradingPeriodId}
              gradingPeriods={gradingPeriods}
              currentGradingPeriod={currentGradingPeriod}
            />

            {showCourse && (
              <CourseNavItem
                depth={depth}
                gradingPeriodId={gradingPeriodId}
                courseIndex={courseIndex}
                currentGradingPeriod={currentGradingPeriod}
              />
            )}
          </NavigationMenuList>
        </NavigationMenu>

        <div className="flex items-center gap-2">
          <Authenticated>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSettingsOpen(true)}
            >
              <Settings className="h-5 w-5" />
            </Button>
          </Authenticated>
          <ThemeToggle />
          <Unauthenticated>
            <Button variant="outline" asChild>
              <Link href="/">Sign In</Link>
            </Button>
          </Unauthenticated>
          <Authenticated>
            <SignOut variant="ghost" />
          </Authenticated>
        </div>
      </div>
      <Authenticated>
        <SettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />
      </Authenticated>
    </nav>
  );
}
