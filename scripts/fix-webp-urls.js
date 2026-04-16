#!/usr/bin/env node

/**
 * Fix WebP URLs Script
 *
 * Updates database URLs from .png/.jpg to .webp for images that were
 * already converted but whose DB references weren't updated.
 *
 * Run with: node scripts/fix-webp-urls.js
 */

const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

// Prisma 7 requires a driver adapter. Match src/lib/db/index.ts.
const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  }),
});

async function main() {
  console.log('Fixing WebP URLs in database...\n');

  let totalUpdates = 0;

  // Fix ProjectItem imageUrl
  console.log('Updating ProjectItem.imageUrl...');
  const projectItems = await prisma.projectItem.findMany({
    where: {
      OR: [
        { imageUrl: { endsWith: '.png' } },
        { imageUrl: { endsWith: '.jpg' } },
        { imageUrl: { endsWith: '.jpeg' } }
      ]
    }
  });

  for (const item of projectItems) {
    if (item.imageUrl) {
      const newUrl = item.imageUrl.replace(/\.(png|jpg|jpeg)$/i, '.webp');
      await prisma.projectItem.update({
        where: { id: item.id },
        data: { imageUrl: newUrl }
      });
      totalUpdates++;
    }
  }
  console.log(`  Updated ${projectItems.length} ProjectItem records`);

  // Fix RewardItem imageUrl
  console.log('Updating RewardItem.imageUrl...');
  const rewardItems = await prisma.rewardItem.findMany({
    where: {
      OR: [
        { imageUrl: { endsWith: '.png' } },
        { imageUrl: { endsWith: '.jpg' } },
        { imageUrl: { endsWith: '.jpeg' } }
      ]
    }
  });

  for (const item of rewardItems) {
    if (item.imageUrl) {
      const newUrl = item.imageUrl.replace(/\.(png|jpg|jpeg)$/i, '.webp');
      await prisma.rewardItem.update({
        where: { id: item.id },
        data: { imageUrl: newUrl }
      });
      totalUpdates++;
    }
  }
  console.log(`  Updated ${rewardItems.length} RewardItem records`);

  // Fix Reward imageUrl
  console.log('Updating Reward.imageUrl...');
  const rewards = await prisma.reward.findMany({
    where: {
      OR: [
        { imageUrl: { endsWith: '.png' } },
        { imageUrl: { endsWith: '.jpg' } },
        { imageUrl: { endsWith: '.jpeg' } }
      ]
    }
  });

  for (const reward of rewards) {
    if (reward.imageUrl) {
      const newUrl = reward.imageUrl.replace(/\.(png|jpg|jpeg)$/i, '.webp');
      await prisma.reward.update({
        where: { id: reward.id },
        data: { imageUrl: newUrl }
      });
      totalUpdates++;
    }
  }
  console.log(`  Updated ${rewards.length} Reward records`);

  // Fix MediaFile url and thumbnailUrl
  console.log('Updating MediaFile.url...');
  const mediaFiles = await prisma.mediaFile.findMany({
    where: {
      OR: [
        { url: { endsWith: '.png' } },
        { url: { endsWith: '.jpg' } },
        { url: { endsWith: '.jpeg' } }
      ]
    }
  });

  for (const file of mediaFiles) {
    const updates = {};
    if (file.url) {
      updates.url = file.url.replace(/\.(png|jpg|jpeg)$/i, '.webp');
      updates.filename = file.filename.replace(/\.(png|jpg|jpeg)$/i, '.webp');
      updates.mimeType = 'image/webp';
    }
    if (file.thumbnailUrl) {
      updates.thumbnailUrl = file.thumbnailUrl.replace(/\.(png|jpg|jpeg)$/i, '.webp');
    }
    if (Object.keys(updates).length > 0) {
      await prisma.mediaFile.update({
        where: { id: file.id },
        data: updates
      });
      totalUpdates++;
    }
  }
  console.log(`  Updated ${mediaFiles.length} MediaFile records`);

  // Fix Project imageUrl
  console.log('Updating Project.imageUrl...');
  const projects = await prisma.project.findMany({
    where: {
      OR: [
        { imageUrl: { endsWith: '.png' } },
        { imageUrl: { endsWith: '.jpg' } },
        { imageUrl: { endsWith: '.jpeg' } }
      ]
    }
  });

  for (const project of projects) {
    if (project.imageUrl) {
      const newUrl = project.imageUrl.replace(/\.(png|jpg|jpeg)$/i, '.webp');
      await prisma.project.update({
        where: { id: project.id },
        data: { imageUrl: newUrl }
      });
      totalUpdates++;
    }
  }
  console.log(`  Updated ${projects.length} Project records`);

  // Fix URLs embedded in Project description (story content)
  console.log('Updating Project.description (story images)...');
  const projectsWithStoryImages = await prisma.project.findMany({
    where: {
      OR: [
        { description: { contains: '.png' } },
        { description: { contains: '.jpg' } },
        { description: { contains: '.jpeg' } }
      ]
    },
    select: { id: true, description: true }
  });

  let storyUpdates = 0;
  for (const project of projectsWithStoryImages) {
    if (project.description) {
      // Replace image URLs in the HTML content
      const newDescription = project.description
        .replace(/\/api\/uploads\/([^"'\s]+)\.(png|jpg|jpeg)/gi, '/api/uploads/$1.webp')
        .replace(/\/uploads\/([^"'\s]+)\.(png|jpg|jpeg)/gi, '/uploads/$1.webp');

      if (newDescription !== project.description) {
        await prisma.project.update({
          where: { id: project.id },
          data: { description: newDescription }
        });
        storyUpdates++;
        totalUpdates++;
      }
    }
  }
  console.log(`  Updated ${storyUpdates} Project descriptions with story images`);

  // Fix URLs embedded in Reward description
  console.log('Updating Reward.description (embedded images)...');
  const rewardsWithImages = await prisma.reward.findMany({
    where: {
      OR: [
        { description: { contains: '.png' } },
        { description: { contains: '.jpg' } },
        { description: { contains: '.jpeg' } }
      ]
    },
    select: { id: true, description: true }
  });

  let rewardDescUpdates = 0;
  for (const reward of rewardsWithImages) {
    if (reward.description) {
      const newDescription = reward.description
        .replace(/\/api\/uploads\/([^"'\s]+)\.(png|jpg|jpeg)/gi, '/api/uploads/$1.webp')
        .replace(/\/uploads\/([^"'\s]+)\.(png|jpg|jpeg)/gi, '/uploads/$1.webp');

      if (newDescription !== reward.description) {
        await prisma.reward.update({
          where: { id: reward.id },
          data: { description: newDescription }
        });
        rewardDescUpdates++;
        totalUpdates++;
      }
    }
  }
  console.log(`  Updated ${rewardDescUpdates} Reward descriptions with embedded images`);

  console.log(`\nDone! Total records updated: ${totalUpdates}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
