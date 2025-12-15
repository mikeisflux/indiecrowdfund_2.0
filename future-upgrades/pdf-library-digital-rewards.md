# PDF Library for Digital Reward Fulfillment

## Overview

Allow creators to upload PDFs for digital rewards/addons after a campaign ends. Backers who pledged for those specific rewards get access to download them from their dashboard.

## Database Schema Changes

### New Tables

```prisma
model DigitalFile {
  id          String   @id @default(cuid())
  projectId   String
  project     Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  fileName    String   // Original filename
  fileKey     String   // S3/storage key
  fileSize    Int      // Size in bytes
  mimeType    String   // e.g., application/pdf
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  // Many-to-many with rewards and addons
  rewards     DigitalFileReward[]

  @@index([projectId])
}

model DigitalFileReward {
  id       String  @id @default(cuid())
  fileId   String
  file     DigitalFile @relation(fields: [fileId], references: [id], onDelete: Cascade)
  rewardId String?
  reward   Reward? @relation(fields: [rewardId], references: [id], onDelete: Cascade)
  addonId  String?
  addon    Addon?  @relation(fields: [addonId], references: [id], onDelete: Cascade)

  @@unique([fileId, rewardId])
  @@unique([fileId, addonId])
  @@index([fileId])
  @@index([rewardId])
  @@index([addonId])
}
```

### Update Existing Models

```prisma
model Reward {
  // ... existing fields
  digitalFiles DigitalFileReward[]
}

model Addon {
  // ... existing fields
  digitalFiles DigitalFileReward[]
}

model Project {
  // ... existing fields
  digitalFiles DigitalFile[]
}
```

## Access Logic

```
Backer can download file IF:
  └─► Their pledge status is COMPLETED
      └─► AND (
            pledge.rewardId matches a linked reward
            OR
            pledge.addons contains a linked addon
          )
```

## File Storage

```
/uploads/digital-rewards/{projectId}/{fileId}.pdf
         │
         └─► NOT publicly accessible
             └─► Served via signed URLs or API route
```

## API Routes

### Creator Side

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/projects/[id]/digital-files` | Upload PDF, returns fileId. Only project creator, only if project is FUNDED |
| PUT | `/api/projects/[id]/digital-files/[fileId]` | Update which rewards/addons the file is linked to |
| DELETE | `/api/projects/[id]/digital-files/[fileId]` | Remove file |
| GET | `/api/projects/[id]/digital-files` | List all files for this project (creator view) |

### Backer Side

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/pledges/[pledgeId]/digital-files` | List files the backer has access to based on their pledge |
| GET | `/api/digital-files/[fileId]/download` | Returns signed URL or streams file. Validates backer has access via their pledge |

## UI Flow

### Creator Dashboard (after campaign funded)

```
┌─────────────────────────────────────────────────────────────┐
│  Digital Rewards Fulfillment                                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [+ Upload PDF]                                             │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 📄 game-rulebook.pdf (2.4 MB)                       │   │
│  │    Linked to: Gold Tier, Platinum Tier              │   │
│  │    Downloads: 47                                    │   │
│  │    [Edit Links] [Delete]                            │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 📄 bonus-artwork.pdf (8.1 MB)                       │   │
│  │    Linked to: Art Pack Addon                        │   │
│  │    Downloads: 23                                    │   │
│  │    [Edit Links] [Delete]                            │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Backer Dashboard

```
┌─────────────────────────────────────────────────────────────┐
│  Your Digital Rewards                                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Project: "Epic Board Game"                                 │
│  Your Reward: Gold Tier + Art Pack Addon                    │
│                                                             │
│  Available Downloads:                                       │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 📄 game-rulebook.pdf (2.4 MB)     [Download]        │   │
│  │ 📄 bonus-artwork.pdf (8.1 MB)     [Download]        │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  No files available yet? The creator may still be          │
│  preparing your digital rewards.                           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Security Considerations

1. **File validation** - Only allow PDFs, validate MIME type server-side (check magic bytes, not just extension)
2. **Size limits** - Cap file size (e.g., 50MB per file, 200MB total per project)
3. **Signed URLs** - Use time-limited signed URLs for downloads (expire in 1 hour)
4. **Access logging** - Track who downloaded what and when (optional: DigitalFileDownload table)
5. **No direct S3 access** - All downloads go through API for access control
6. **Rate limiting** - Prevent abuse on download endpoint

## Optional: Download Tracking

```prisma
model DigitalFileDownload {
  id        String   @id @default(cuid())
  fileId    String
  file      DigitalFile @relation(fields: [fileId], references: [id])
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  pledgeId  String
  pledge    Pledge   @relation(fields: [pledgeId], references: [id])
  downloadedAt DateTime @default(now())
  ipAddress String?

  @@index([fileId])
  @@index([userId])
}
```

## Implementation Order

1. **Database schema** - Add DigitalFile, DigitalFileReward tables
2. **File upload API** - S3/storage integration with validation
3. **Creator dashboard UI** - Upload form + file management + reward linking
4. **Backer access check logic** - Verify pledge includes linked reward/addon
5. **Backer dashboard UI** - Display available downloads
6. **Download API** - Generate signed URLs with access validation
7. **Email notifications** (optional) - Notify backers when new files are uploaded

## Future Enhancements

- Support for other file types (ZIP, EPUB, MP3)
- Watermarking PDFs with backer info
- Version history for updated files
- Bulk download as ZIP
- Analytics dashboard for creators (download stats per file)
