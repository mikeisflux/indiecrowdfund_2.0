#!/usr/bin/env node

/**
 * WebP Conversion Script
 *
 * Converts all PNG/JPG images in the uploads directory to WebP format,
 * updates database references, and deletes the original files.
 *
 * Run with: node scripts/convert-to-webp.js
 *
 * Options:
 *   --dry-run    Show what would be converted without making changes
 *   --verbose    Show detailed progress
 *   --keep       Keep original files after conversion (don't delete)
 */

const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const fs = require('fs').promises;
const path = require('path');
const sharp = require('sharp');

// Prisma 7 requires a driver adapter. Match src/lib/db/index.ts.
const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  }),
});

// Configuration
const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
const PUBLIC_UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads');
const WEBP_QUALITY = 85; // Good balance of quality and compression

// Parse command line arguments
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const VERBOSE = args.includes('--verbose');
const KEEP_ORIGINALS = args.includes('--keep');

// Statistics
const stats = {
  found: 0,
  converted: 0,
  skipped: 0,
  failed: 0,
  savedBytes: 0,
};

function log(message) {
  console.log(message);
}

function verbose(message) {
  if (VERBOSE) {
    console.log(`  ${message}`);
  }
}

/**
 * Check if a path is a "companion" JPG/PNG kept intentionally alongside
 * a WebP of the same basename (used for social media share previews where
 * Facebook/X/LinkedIn reject WebP). These files must NEVER be converted
 * or deleted — doing so breaks Facebook share previews for every project.
 */
async function hasWebpCompanion(imagePath) {
  const webpPath = imagePath.replace(/\.(png|jpe?g)$/i, '.webp');
  if (webpPath === imagePath) return false;
  try {
    await fs.access(webpPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Recursively find all image files in a directory
 */
async function findImages(dir) {
  const images = [];

  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        const subImages = await findImages(fullPath);
        images.push(...subImages);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (['.png', '.jpg', '.jpeg'].includes(ext)) {
          // Skip files that have a .webp sibling — they're intentional
          // companions for social media sharing (Facebook/X/LinkedIn reject
          // WebP images, so we pre-generate .jpg copies alongside every
          // project cover .webp file).
          if (await hasWebpCompanion(fullPath)) {
            verbose(`Skipping companion file: ${path.basename(fullPath)} (webp sibling exists)`);
            stats.skipped++;
            continue;
          }
          images.push(fullPath);
        }
      }
    }
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.error(`Error reading directory ${dir}:`, err.message);
    }
  }

  return images;
}

/**
 * Convert a single image to WebP
 */
async function convertToWebP(imagePath) {
  const ext = path.extname(imagePath);
  const webpPath = imagePath.replace(/\.(png|jpg|jpeg)$/i, '.webp');

  try {
    // Get original file size
    const originalStats = await fs.stat(imagePath);
    const originalSize = originalStats.size;

    // Convert to WebP
    await sharp(imagePath)
      .webp({ quality: WEBP_QUALITY })
      .toFile(webpPath);

    // Get new file size
    const webpStats = await fs.stat(webpPath);
    const webpSize = webpStats.size;

    const savedBytes = originalSize - webpSize;
    const savingsPercent = ((savedBytes / originalSize) * 100).toFixed(1);

    verbose(`Converted: ${path.basename(imagePath)} -> ${path.basename(webpPath)} (${savingsPercent}% smaller)`);

    return {
      success: true,
      originalPath: imagePath,
      webpPath,
      originalSize,
      webpSize,
      savedBytes,
    };
  } catch (err) {
    console.error(`  Failed to convert ${imagePath}:`, err.message);
    return { success: false, originalPath: imagePath, error: err.message };
  }
}

/**
 * Update URL from original extension to .webp
 */
function getWebPUrl(url) {
  if (!url) return null;
  return url.replace(/\.(png|jpg|jpeg)$/i, '.webp');
}

/**
 * Update all database references from old image URL to WebP
 */
async function updateDatabaseReferences(originalUrl, webpUrl) {
  const updates = [];

  // Update MediaFile records
  try {
    const result = await prisma.mediaFile.updateMany({
      where: { url: originalUrl },
      data: {
        url: webpUrl,
        thumbnailUrl: webpUrl,
        mimeType: 'image/webp',
        filename: path.basename(webpUrl),
      },
    });
    if (result.count > 0) {
      updates.push(`MediaFile: ${result.count}`);
    }
  } catch (err) {
    console.error(`  Error updating MediaFile:`, err.message);
  }

  // Update Project imageUrl
  try {
    const result = await prisma.project.updateMany({
      where: { imageUrl: originalUrl },
      data: { imageUrl: webpUrl },
    });
    if (result.count > 0) {
      updates.push(`Project.imageUrl: ${result.count}`);
    }
  } catch (err) {
    console.error(`  Error updating Project.imageUrl:`, err.message);
  }

  // Update ProjectItem imageUrl
  try {
    const result = await prisma.projectItem.updateMany({
      where: { imageUrl: originalUrl },
      data: { imageUrl: webpUrl },
    });
    if (result.count > 0) {
      updates.push(`ProjectItem.imageUrl: ${result.count}`);
    }
  } catch (err) {
    verbose(`ProjectItem update skipped`);
  }

  // Update RewardItem imageUrl
  try {
    const result = await prisma.rewardItem.updateMany({
      where: { imageUrl: originalUrl },
      data: { imageUrl: webpUrl },
    });
    if (result.count > 0) {
      updates.push(`RewardItem.imageUrl: ${result.count}`);
    }
  } catch (err) {
    verbose(`RewardItem update skipped`);
  }

  // Update Reward imageUrl
  try {
    const result = await prisma.reward.updateMany({
      where: { imageUrl: originalUrl },
      data: { imageUrl: webpUrl },
    });
    if (result.count > 0) {
      updates.push(`Reward.imageUrl: ${result.count}`);
    }
  } catch (err) {
    verbose(`Reward update skipped`);
  }

  // Update User image (avatar)
  try {
    const result = await prisma.user.updateMany({
      where: { image: originalUrl },
      data: { image: webpUrl },
    });
    if (result.count > 0) {
      updates.push(`User.image: ${result.count}`);
    }
  } catch (err) {
    console.error(`  Error updating User.image:`, err.message);
  }

  // Update ProjectGallery imageUrl
  try {
    const result = await prisma.projectGallery.updateMany({
      where: { imageUrl: originalUrl },
      data: { imageUrl: webpUrl },
    });
    if (result.count > 0) {
      updates.push(`ProjectGallery.imageUrl: ${result.count}`);
    }
  } catch (err) {
    // Table might not exist
    verbose(`ProjectGallery update skipped (may not exist)`);
  }

  // Note: Update model doesn't have thumbnailUrl field - skipped

  // Update EmailTemplate imageUrl
  try {
    const result = await prisma.emailTemplate.updateMany({
      where: { imageUrl: originalUrl },
      data: { imageUrl: webpUrl },
    });
    if (result.count > 0) {
      updates.push(`EmailTemplate.imageUrl: ${result.count}`);
    }
  } catch (err) {
    verbose(`EmailTemplate update skipped`);
  }

  return updates;
}

/**
 * Convert file path to URL path
 */
function pathToUrl(filePath) {
  // Handle /uploads/ directory
  if (filePath.includes('/uploads/')) {
    const uploadsIndex = filePath.indexOf('/uploads/');
    return '/api' + filePath.substring(uploadsIndex);
  }
  // Handle /public/uploads/ directory
  if (filePath.includes('/public/uploads/')) {
    const publicIndex = filePath.indexOf('/public/uploads/');
    return filePath.substring(publicIndex + 7); // Remove '/public' prefix
  }
  return null;
}

/**
 * Main conversion process
 */
async function main() {
  log('');
  log('='.repeat(60));
  log('WebP Conversion Script');
  log('='.repeat(60));

  if (DRY_RUN) {
    log('');
    log('** DRY RUN MODE - No changes will be made **');
  }

  if (KEEP_ORIGINALS) {
    log('');
    log('** KEEP MODE - Original files will not be deleted **');
  }

  log('');

  // Find all images in both upload directories
  log('Scanning for PNG/JPG images...');

  const uploadsImages = await findImages(UPLOADS_DIR);
  const publicUploadsImages = await findImages(PUBLIC_UPLOADS_DIR);
  const allImages = [...uploadsImages, ...publicUploadsImages];

  stats.found = allImages.length;
  log(`Found ${allImages.length} images to convert`);

  if (allImages.length === 0) {
    log('');
    log('No images found to convert. Exiting.');
    return;
  }

  log('');
  log('Processing images...');
  log('');

  for (const imagePath of allImages) {
    const relativePath = imagePath.replace(process.cwd(), '');
    log(`Processing: ${relativePath}`);

    if (DRY_RUN) {
      verbose('Would convert to WebP');
      stats.converted++;
      continue;
    }

    // Convert the image
    const result = await convertToWebP(imagePath);

    if (!result.success) {
      stats.failed++;
      continue;
    }

    stats.converted++;
    stats.savedBytes += result.savedBytes;

    // Get URL paths for database updates
    const originalUrl = pathToUrl(imagePath);
    const webpUrl = pathToUrl(result.webpPath);

    if (originalUrl && webpUrl) {
      verbose(`Updating DB: ${originalUrl} -> ${webpUrl}`);
      const dbUpdates = await updateDatabaseReferences(originalUrl, webpUrl);
      if (dbUpdates.length > 0) {
        verbose(`DB updates: ${dbUpdates.join(', ')}`);
      }
    }

    // Delete original file
    if (!KEEP_ORIGINALS) {
      try {
        await fs.unlink(imagePath);
        verbose(`Deleted original: ${path.basename(imagePath)}`);
      } catch (err) {
        console.error(`  Failed to delete ${imagePath}:`, err.message);
      }
    }
  }

  // Summary
  log('');
  log('='.repeat(60));
  log('Summary');
  log('='.repeat(60));
  log('');
  log(`Images found:     ${stats.found}`);
  log(`Converted:        ${stats.converted}`);
  log(`Failed:           ${stats.failed}`);
  log(`Skipped:          ${stats.skipped}`);

  if (!DRY_RUN && stats.savedBytes > 0) {
    const savedMB = (stats.savedBytes / (1024 * 1024)).toFixed(2);
    log(`Space saved:      ${savedMB} MB`);
  }

  log('');
  log('Done!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
