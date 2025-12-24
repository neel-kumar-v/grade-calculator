type GradeStep = {
  minPercentage: number; // The lowest % to achieve this GPA
  gpa: number;           // The GPA value assigned
};
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

  // The "Strict" 4.0 (A+ = 4.0, A = 3.7) - What you asked for
  STRICT_4_0: [
    { minPercentage: 97, gpa: 4.0 }, // Only A+ gets 4.0
    { minPercentage: 93, gpa: 3.7 }, // A is 3.7
    { minPercentage: 90, gpa: 3.3 }, // A- moves down to 3.3
    { minPercentage: 87, gpa: 3.0 },
    { minPercentage: 80, gpa: 2.7 },
    { minPercentage: 0,  gpa: 0.0 }, // Truncated for brevity
  ],

  // The 4.3 Scale (A+ = 4.3, A = 4.0) - Common in Ivy Leagues/some Canadian Unis
  SCALE_4_3: [
    { minPercentage: 97, gpa: 4.3 },
    { minPercentage: 93, gpa: 4.0 },
    { minPercentage: 90, gpa: 3.7 },
    { minPercentage: 87, gpa: 3.3 },
    { minPercentage: 83, gpa: 3.0 },
    { minPercentage: 0,  gpa: 0.0 },
  ],

  // Weighted 5.0 Scale (Simulated for Honors/AP)
  WEIGHTED_5_0: [
    { minPercentage: 93, gpa: 5.0 }, // A is boosted to 5.0
    { minPercentage: 90, gpa: 4.7 },
    { minPercentage: 87, gpa: 4.3 },
    { minPercentage: 83, gpa: 4.0 }, // B is a 4.0
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

function calculateGPA(percentage: number, scaleType: GradeStep[]): number {
  // Sort scales descending just in case they were defined out of order
  // (Optional optimization: Sort them once outside the function)
  const sortedScale = [...scaleType].sort((a, b) => b.minPercentage - a.minPercentage);

  for (const step of sortedScale) {
    if (percentage >= step.minPercentage) {
      return step.gpa;
    }
  }
  return 0.0;
}