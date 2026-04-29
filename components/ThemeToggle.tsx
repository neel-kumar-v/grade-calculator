"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Button } from "./ui/button";

export function ThemeToggle({
  menuStyle = false,
  className,
}: {
  menuStyle?: boolean;
  className?: string;
}) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    if (menuStyle) {
      return (
        <Button variant="ghost" className={className}>
          <Sun className="size-4" />
          Light Mode
        </Button>
      );
    }

    return (
      <Button variant="ghost" size="icon" className="size-9">
        <Sun className="size-4" />
      </Button>
    );
  }

  const isDark = resolvedTheme === "dark";
  const label = isDark ? "Light Mode" : "Dark Mode";
  const Icon = isDark ? Sun : Moon;

  const handleToggle = () => {
    if (theme === "system") {
      setTheme(isDark ? "light" : "dark");
    } else {
      setTheme(theme === "dark" ? "light" : "dark");
    }
  };

  if (menuStyle) {
    return (
      <Button variant="ghost" className={className} onClick={handleToggle}>
        <Icon className="size-4" />
        {label}
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-9"
      onClick={handleToggle}
    >
      <Icon className="size-4" />
    </Button>
  );
}

