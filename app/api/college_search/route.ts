import { NextRequest, NextResponse } from "next/server";
import { collegeNames } from "@/lib/collegeNames";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("query") || "";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    // Validate parameters
    if (page < 1 || limit < 1 || limit > 100) {
      return NextResponse.json(
        { error: "Invalid query parameters" },
        { status: 400 }
      );
    }

    // Filter colleges based on query (case-insensitive)
    let filteredColleges = collegeNames;
    if (query.trim()) {
      const queryLower = query.toLowerCase();
      filteredColleges = collegeNames.filter((college) =>
        college.toLowerCase().includes(queryLower)
      );
    }

    // Calculate pagination
    const total = filteredColleges.length;
    const totalPages = Math.ceil(total / limit);
    const startIndex = (page - 1) * limit;
    const endIndex = Math.min(startIndex + limit, total);
    const paginatedColleges = filteredColleges.slice(startIndex, endIndex);

    return NextResponse.json({
      data: paginatedColleges,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore: page < totalPages,
      },
    });
  } catch (error) {
    console.error("Error in college_search API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

