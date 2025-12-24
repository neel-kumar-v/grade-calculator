"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Authenticated, Unauthenticated, useQuery } from "convex/react";
import { Scale } from "lucide-react";
import { api } from "../convex/_generated/api";
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

function SemesterNavItem({
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
  const hasList = Array.isArray(gradingPeriods) && gradingPeriods.length > 0;
  const isRootPage = depth === 0;
  
  // On root page, show "Semesters" without a link
  if (isRootPage) {
    return (
      <NavigationMenuItem>
        <NavigationMenuTrigger className="font-medium">
          <span className="flex items-center gap-1">Semesters</span>
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

  // On semester page, show semester name with link
  if (!gradingPeriodId || currentGradingPeriod === null) {
    return null;
  }

  const label =
    currentGradingPeriod && currentGradingPeriod !== undefined
      ? currentGradingPeriod.name
      : "Loading semester...";

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
  const isSemesterPage = depth === 1;

  // On semester page, show "Courses" without a link
  if (isSemesterPage) {
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
                className="flex flex-row items-center gap-2 font-semibold"
              >
                <Link href="/">
                  <Scale className="size-7" />
                  {/* <span>Weighted</span> */}
                </Link>
              </NavigationMenuLink>
            </NavigationMenuItem>

            <SemesterNavItem
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
    </nav>
  );
}
