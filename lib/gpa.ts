export type GradeStep = {
  minPercentage: number; // The lowest % to achieve this GPA
  gpa: number;           // The GPA value assigned
};

export const SCALE_NAMES = {
  STANDARD_4_0: "STANDARD_4_0",
  STRICT_4_0: "STRICT_4_0",
  SCALE_4_3: "SCALE_4_3",
  WEIGHTED_5_0: "WEIGHTED_5_0",
  AUS_7_0: "AUS_7_0",
  WAM: "WAM",
  CUSTOM: "CUSTOM",
} as const;

const SCALES: Record<string, GradeStep[]> = {
  // The Standard 4.0 (A = 4.0, A- = 3.7) - Your current logic
  STANDARD_4_0: [
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
    { minPercentage: 0,  gpa: 0.0 },
  ],

  // The "Strict" 4.0 (A+ = 4.0, A = 3.7)
  STRICT_4_0: [
    { minPercentage: 97, gpa: 4.0 }, // Only A+ gets 4.0
    { minPercentage: 93, gpa: 3.7 }, // A is 3.7
    { minPercentage: 90, gpa: 3.3 }, // A- moves down to 3.3
    { minPercentage: 87, gpa: 3.0 },
    { minPercentage: 83, gpa: 2.7 },
    { minPercentage: 80, gpa: 2.3 },
    { minPercentage: 77, gpa: 2.0 },
    { minPercentage: 73, gpa: 1.7 },
    { minPercentage: 70, gpa: 1.3 },
    { minPercentage: 67, gpa: 1.0 },
    { minPercentage: 65, gpa: 0.7 },
    { minPercentage: 0,  gpa: 0.0 },
  ],

  // The 4.3 Scale (A+ = 4.3, A = 4.0) - Common in Ivy Leagues/some Canadian Unis
  SCALE_4_3: [
    { minPercentage: 97, gpa: 4.3 },
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
    { minPercentage: 0,  gpa: 0.0 },
  ],

  // Weighted 5.0 Scale (Simulated for Honors/AP)
  WEIGHTED_5_0: [
    { minPercentage: 93, gpa: 5.0 }, // A is boosted to 5.0
    { minPercentage: 90, gpa: 4.7 },
    { minPercentage: 87, gpa: 4.3 },
    { minPercentage: 83, gpa: 4.0 }, // B is a 4.0
    { minPercentage: 80, gpa: 3.7 },
    { minPercentage: 77, gpa: 3.3 },
    { minPercentage: 73, gpa: 3.0 },
    { minPercentage: 70, gpa: 2.7 },
    { minPercentage: 67, gpa: 2.3 },
    { minPercentage: 65, gpa: 2.0 },
    { minPercentage: 0,  gpa: 0.0 },
  ],
  
  // Australian 7.0 Scale
  AUS_7_0: [
    { minPercentage: 85, gpa: 7.0 }, // High Distinction
    { minPercentage: 75, gpa: 6.0 }, // Distinction
    { minPercentage: 65, gpa: 5.0 }, // Credit
    { minPercentage: 50, gpa: 4.0 }, // Pass
    { minPercentage: 0,  gpa: 0.0 }, // Fail
  ]
};

export function getScaleByName(scaleName: string, customScale?: GradeStep[]): GradeStep[] | "WAM" {
  if (scaleName === SCALE_NAMES.WAM) {
    return "WAM";
  }
  if (scaleName === SCALE_NAMES.CUSTOM && customScale) {
    return customScale;
  }
  return SCALES[scaleName] || SCALES.STANDARD_4_0;
}

export function calculateGPA(percentage: number, scaleType: GradeStep[] | "WAM"): number {
  // For WAM, return the percentage directly (no conversion)
  if (scaleType === "WAM") {
    return percentage;
  }

  // Sort scales descending just in case they were defined out of order
  const sortedScale = [...scaleType].sort((a, b) => b.minPercentage - a.minPercentage);

  for (const step of sortedScale) {
    if (percentage >= step.minPercentage) {
      return step.gpa;
    }
  }
  return 0.0;
}

export function convertGradeToLetter(grade: number): string {
  // Letter grades remain standard across all scales
  switch (true) {
    case grade >= 97: return "A+";
    case grade >= 93: return "A";
    case grade >= 90: return "A-";
    case grade >= 87: return "B+";
    case grade >= 83: return "B";
    case grade >= 80: return "B-";
    case grade >= 77: return "C+";
    case grade >= 73: return "C";
    case grade >= 70: return "C-";
    case grade >= 67: return "D+";
    case grade >= 65: return "D";
    case grade >= 63: return "D-";
    default: return "F";
  }
}

export function getScaleDisplayName(scaleName: string): string {
  const displayNames: Record<string, string> = {
    [SCALE_NAMES.STANDARD_4_0]: "Standard 4.0",
    [SCALE_NAMES.STRICT_4_0]: "Strict 4.0",
    [SCALE_NAMES.SCALE_4_3]: "4.3 Scale",
    [SCALE_NAMES.WEIGHTED_5_0]: "Weighted 5.0",
    [SCALE_NAMES.AUS_7_0]: "Australian 7.0",
    [SCALE_NAMES.WAM]: "WAM (Weighted Average Marks)",
    [SCALE_NAMES.CUSTOM]: "Custom Scale",
  };
  return displayNames[scaleName] || scaleName;
}