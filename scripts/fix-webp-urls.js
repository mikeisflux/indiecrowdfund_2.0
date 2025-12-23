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
const prisma = new PrismaClient();

async function main() {
  console.log('Fixing WebP URLs in database...\n');

  let totalUpdates = 0;

  // Fix ProjectItem imageUrl
  console.log('Updating ProjectItem.imageUrl...');
  const projectItems = await prisma.projectItem.findMany({
    where: {
      imageUrl: {
        OR: [
          { endsWith: '.png' },
          { endsWith: '.jpg' },
          { endsWith: '.jpeg' }
        ]
      }
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
      imageUrl: {
        OR: [
          { endsWith: '.png' },
          { endsWith: '.jpg' },
          { endsWith: '.jpeg' }
        ]
      }
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
      imageUrl: {
        OR: [
          { endsWith: '.png' },
          { endsWith: '.jpg' },
          { endsWith: '.jpeg' }
        ]
      }
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
      imageUrl: {
        OR: [
          { endsWith: '.png' },
          { endsWith: '.jpg' },
          { endsWith: '.jpeg' }
        ]
      }
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

  console.log(`\nDone! Total records updated: ${totalUpdates}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
