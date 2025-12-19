#!/usr/bin/env node

/**
 * Script to fix campaign images by extracting base64 data and saving to public folder
 * Run with: node scripts/fix-campaign-images.js
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs').promises;
const path = require('path');
const { randomUUID } = require('crypto');

const prisma = new PrismaClient();

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://indiecrowdfund.com';

async function processBase64Images(html) {
  // Match the same path structure as media upload API
  const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'email-campaigns', 'images');

  // Ensure upload directory exists
  await fs.mkdir(uploadDir, { recursive: true });

  // Find all base64 image sources
  const base64Pattern = /src=["'](data:image\/(png|jpg|jpeg|gif|webp);base64,([^"']+))["']/gi;

  let processedHtml = html;
  let uploadedCount = 0;
  let match;

  // Collect all matches first
  const matches = [];
  while ((match = base64Pattern.exec(html)) !== null) {
    matches.push({
      dataUrl: match[1],
      extension: match[2] === 'jpeg' ? 'jpg' : match[2],
      base64Data: match[3],
    });
  }

  console.log(`Found ${matches.length} base64 images`);

  // Process each match
  for (const m of matches) {
    try {
      // Generate unique filename
      const filename = `${randomUUID()}.${m.extension}`;
      const filePath = path.join(uploadDir, filename);

      // Decode base64 and write file
      const imageBuffer = Buffer.from(m.base64Data, 'base64');
      await fs.writeFile(filePath, imageBuffer);

      // Create public URL
      const publicUrl = `${BASE_URL}/uploads/email-campaigns/images/${filename}`;

      // Replace in HTML
      processedHtml = processedHtml.replace(m.dataUrl, publicUrl);
      uploadedCount++;

      console.log(`  Saved: ${filename} (${(imageBuffer.length / 1024).toFixed(1)} KB)`);
    } catch (err) {
      console.error(`  Failed to process image:`, err.message);
    }
  }

  return { processedHtml, uploadedCount };
}

async function main() {
  console.log('Looking for campaigns with base64 images...\n');

  // Find campaigns with base64 images
  const campaigns = await prisma.emailCampaign.findMany({
    where: {
      htmlContent: { contains: 'data:image' }
    },
    select: {
      id: true,
      name: true,
      htmlContent: true,
    }
  });

  console.log(`Found ${campaigns.length} campaign(s) with base64 images\n`);

  for (const campaign of campaigns) {
    console.log(`Processing: "${campaign.name}" (${campaign.id})`);

    const { processedHtml, uploadedCount } = await processBase64Images(campaign.htmlContent);

    if (uploadedCount > 0) {
      // Update campaign with new HTML
      await prisma.emailCampaign.update({
        where: { id: campaign.id },
        data: { htmlContent: processedHtml }
      });

      console.log(`  Updated campaign with ${uploadedCount} public image URL(s)\n`);
    } else {
      console.log(`  No images to process\n`);
    }
  }

  console.log('Done!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
