import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET - List comic shops with filtering and pagination
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    // Pagination
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "24");
    const skip = (page - 1) * limit;

    // Filters
    const search = searchParams.get("search")?.trim();
    const state = searchParams.get("state")?.trim();
    const region = searchParams.get("region")?.trim();
    const city = searchParams.get("city")?.trim();

    // Build where clause
    const where: {
      OR?: Array<{ name: { contains: string; mode: "insensitive" } } | { city: { contains: string; mode: "insensitive" } }>;
      state?: { equals: string; mode: "insensitive" };
      region?: { equals: string; mode: "insensitive" };
      city?: { contains: string; mode: "insensitive" };
    } = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { city: { contains: search, mode: "insensitive" } },
      ];
    }

    if (state) {
      where.state = { equals: state, mode: "insensitive" };
    }

    if (region) {
      where.region = { equals: region, mode: "insensitive" };
    }

    if (city && !search) {
      where.city = { contains: city, mode: "insensitive" };
    }

    // Fetch shops and count in parallel
    const [shops, totalCount] = await Promise.all([
      db.comicShop.findMany({
        where,
        orderBy: [{ name: "asc" }],
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          slug: true,
          address: true,
          city: true,
          state: true,
          zipCode: true,
          country: true,
          region: true,
          phone: true,
          email: true,
          website: true,
        },
      }),
      db.comicShop.count({ where }),
    ]);

    // Get unique states and regions for filter options
    const [states, regions] = await Promise.all([
      db.comicShop.findMany({
        distinct: ["state"],
        where: { state: { not: null } },
        select: { state: true },
        orderBy: { state: "asc" },
      }),
      db.comicShop.findMany({
        distinct: ["region"],
        where: { region: { not: null } },
        select: { region: true },
        orderBy: { region: "asc" },
      }),
    ]);

    return NextResponse.json({
      shops,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasMore: skip + shops.length < totalCount,
      },
      filters: {
        states: states.map((s: { state: string | null }) => s.state).filter(Boolean),
        regions: regions.map((r: { region: string | null }) => r.region).filter(Boolean),
      },
    });
  } catch (error) {
    console.error("Error fetching comic shops:", error);
    return NextResponse.json(
      { error: "Failed to fetch comic shops" },
      { status: 500 }
    );
  }
}
