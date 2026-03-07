import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const adminLcsLocatorShopsLogger = logger.child({ module: "admin-lcs-locator-shops" });
import { db } from "@/lib/db";
import { isAdmin } from "@/lib/auth-helpers";
import { slugify } from "@/lib/utils";

// GET - List all comic shops with pagination/search (admin)
export async function GET(req: NextRequest) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1") || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50") || 50));
    const skip = (page - 1) * limit;
    const search = searchParams.get("search") || "";
    const state = searchParams.get("state") || "";
    const region = searchParams.get("region") || "";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { city: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }

    if (state) {
      where.state = { equals: state, mode: "insensitive" };
    }

    if (region) {
      where.region = { equals: region, mode: "insensitive" };
    }

    const [shops, totalCount, states, regions] = await Promise.all([
      db.comicShop.findMany({
        where,
        orderBy: { name: "asc" },
        skip,
        take: limit,
      }),
      db.comicShop.count({ where }),
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      shops: shops.map((s: any) => ({
        ...s,
        createdAt: s.createdAt.toISOString(),
        updatedAt: s.updatedAt.toISOString(),
      })),
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
      filters: {
        states: states.map((s: { state: string | null }) => s.state).filter(Boolean),
        regions: regions.map((r: { region: string | null }) => r.region).filter(Boolean),
      },
    });
  } catch (error) {
    adminLcsLocatorShopsLogger.error({ err: String(error) }, "Error fetching comic shops:");
    return NextResponse.json({ error: "Failed to fetch comic shops" }, { status: 500 });
  }
}

// POST - Create a new comic shop
export async function POST(req: NextRequest) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { name, city, state, zipCode, country, region, address, phone, email, website } = body;

    if (!name || !city) {
      return NextResponse.json({ error: "Name and city are required" }, { status: 400 });
    }

    // Generate unique slug
    let slug = slugify(name);
    const existing = await db.comicShop.findUnique({ where: { slug } });
    if (existing) {
      slug = `${slug}-${city.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
      const existing2 = await db.comicShop.findUnique({ where: { slug } });
      if (existing2) {
        slug = `${slug}-${Date.now()}`;
      }
    }

    const shop = await db.comicShop.create({
      data: {
        name,
        slug,
        city,
        state: state || null,
        zipCode: zipCode || null,
        country: country || "USA",
        region: region || null,
        address: address || null,
        phone: phone || null,
        email: email || null,
        website: website || null,
      },
    });

    return NextResponse.json(shop);
  } catch (error) {
    adminLcsLocatorShopsLogger.error({ err: String(error) }, "Error creating comic shop:");
    return NextResponse.json({ error: "Failed to create comic shop" }, { status: 500 });
  }
}

// PATCH - Update a comic shop
export async function PATCH(req: NextRequest) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { id, name, city, state, zipCode, country, region, address, phone, email, website } = body;

    if (!id) {
      return NextResponse.json({ error: "Shop id is required" }, { status: 400 });
    }

    const existing = await db.comicShop.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Shop not found" }, { status: 404 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = {};
    if (name !== undefined) data.name = name;
    if (city !== undefined) data.city = city;
    if (state !== undefined) data.state = state || null;
    if (zipCode !== undefined) data.zipCode = zipCode || null;
    if (country !== undefined) data.country = country || "USA";
    if (region !== undefined) data.region = region || null;
    if (address !== undefined) data.address = address || null;
    if (phone !== undefined) data.phone = phone || null;
    if (email !== undefined) data.email = email || null;
    if (website !== undefined) data.website = website || null;

    // Update slug if name changed
    if (name && name !== existing.name) {
      let slug = slugify(name);
      const slugExists = await db.comicShop.findFirst({
        where: { slug, id: { not: id } },
      });
      if (slugExists) {
        slug = `${slug}-${(city || existing.city).toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
      }
      data.slug = slug;
    }

    const shop = await db.comicShop.update({ where: { id }, data });

    return NextResponse.json(shop);
  } catch (error) {
    adminLcsLocatorShopsLogger.error({ err: String(error) }, "Error updating comic shop:");
    return NextResponse.json({ error: "Failed to update comic shop" }, { status: 500 });
  }
}

// DELETE - Delete a comic shop
export async function DELETE(req: NextRequest) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Shop id is required" }, { status: 400 });
    }

    const existing = await db.comicShop.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Shop not found" }, { status: 404 });
    }

    await db.comicShop.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    adminLcsLocatorShopsLogger.error({ err: String(error) }, "Error deleting comic shop:");
    return NextResponse.json({ error: "Failed to delete comic shop" }, { status: 500 });
  }
}
