# CCLI Integration Documentation

## Overview

The CCLI (Christian Copyright Licensing International) integration allows churches to search and import licensed worship songs directly from CCLI SongSelect into Open Worship App.

## Features

✅ **Search CCLI SongSelect** - Search songs by title, author, or CCLI number  
✅ **Preview Song Details** - View song metadata, lyrics, and copyright information  
✅ **Import Songs** - Import songs as lyrics with proper formatting and metadata  
✅ **CCLI Metadata Storage** - Track CCLI information for compliance and reporting  
✅ **Secure Credentials** - Store API credentials securely in app settings  

## File Structure

```
src/lyric-list/ccli/
├── ccliTypes.ts              # TypeScript type definitions
├── ccliService.ts            # API service layer
├── ccliImportHelpers.ts      # Import utilities
├── CCLISongSearchComp.tsx    # Search UI component
└── CCLISongSearchComp.scss   # Component styles

src/setting/
└── SettingCCLIComp.tsx       # CCLI settings panel
```

## Setup Instructions

### 1. Configure CCLI Credentials

1. Open Open Worship App
2. Go to **Settings** → **CCLI** tab
3. Enter your credentials:
   - **Subscription ID**: Your CCLI account subscription ID
   - **API Key**: Your CCLI API access key
4. Click **Save Credentials**

### 2. Getting CCLI Credentials

To obtain CCLI API access:

1. Visit [songselect.ccli.com](https://songselect.ccli.com)
2. Log in to your CCLI account
3. Navigate to **Account Settings** → **API Access**
4. Request API access (if not already enabled)
5. Copy your **Subscription ID** and **API Key**

> **Note**: You must have an active CCLI SongSelect subscription with API access enabled.

## Usage

### Searching for Songs

1. Open the **Presenter** tab
2. Select **Lyrics** from the left panel
3. Right-click in the lyrics list
4. Select **Import from CCLI**
5. Enter search terms (title, author, or CCLI#)
6. Click the search button

### Importing a Song

1. After searching, click on a song in the results list
2. Preview the song details and lyrics
3. Click **Import Song**
4. The song will be saved to your lyrics folder

### Imported Song Format

Songs are imported with:
- Song title as filename (sanitized)
- Complete lyrics with chord notation
- Metadata header with:
  - Song title
  - Author(s)
  - CCLI number
  - Copyright information
  - Publisher
  - Import date

Example imported lyric:
```markdown
# Amazing Grace (My Chains Are Gone)
# Author: Chris Tomlin, John Newton, Louie Giglio
# CCLI Number: 4768151
# Copyright: © 2006 sixsteps Music
# Imported from CCLI SongSelect

---
# Verse 1
---
c1:                    G
l1: Amazing grace how sweet the sound
c1:                  C      G
l1: That saved a wretch like me
...
```

## Technical Implementation

### Current Status: Mock Implementation

The current implementation uses **mock data** for development and testing. To use the actual CCLI API, you need to:

1. **Contact CCLI** to enable API access on your subscription
2. **Implement API endpoints** in `ccliService.ts`:
   - Replace mock functions with actual HTTP requests
   - Handle authentication (OAuth or API key)
   - Implement rate limiting
   - Handle error responses

3. **Update API endpoints**:
   ```typescript
   const CCLI_API_BASE_URL = 'https://api.ccli.com/v2';
   ```

### API Integration Points

#### Search Songs
```typescript
export async function searchCCLISongs(
    params: CCLISearchParamsType,
): Promise<CCLISearchResultType | null>
```

#### Get Song Details
```typescript
export async function getCCLISongDetails(
    songId: string,
): Promise<CCLISongType | null>
```

### Data Flow

1. User enters search query
2. `CCLISongSearchComp` calls `searchCCLISongs()`
3. Results displayed in UI
4. User selects song → calls `getCCLISongDetails()`
5. User clicks import → calls `importCCLISongAsLyric()`
6. Song saved with CCLI metadata

## Data Types

### CCLISongType
```typescript
{
    songId: string;
    title: string;
    author: string;
    copyright: string;
    ccliNumber: string;
    lyrics?: string;
    themes?: string[];
    keys?: string[];
    tempo?: string;
    timeSignature?: string;
    publisher?: string;
    verseOrder?: string[];
}
```

### CCLILyricMetadataType
```typescript
{
    ccliNumber?: string;
    ccliSongId?: string;
    title?: string;
    author?: string;
    copyright?: string;
    publisher?: string;
    importDate?: string;
    lastModified?: string;
}
```

## Metadata Storage

CCLI metadata is stored in the lyric file's JSON structure:

```json
{
    "metadata": {
        "app": "open-worship",
        "fileVersion": 1,
        "initDate": "2025-12-31T...",
        "ccliNumber": "4768151",
        "ccliSongId": "7011306",
        "title": "Amazing Grace (My Chains Are Gone)",
        "author": "Chris Tomlin, John Newton, Louie Giglio",
        "copyright": "© 2006 sixsteps Music",
        "publisher": "sixsteps Music",
        "importDate": "2025-12-31T...",
        "lastModified": "2025-12-31T..."
    },
    "content": "..."
}
```

## Helper Functions

### Import Helpers

```typescript
// Import a song as lyric
await importCCLISongAsLyric(song, dirPath, options);

// Check if lyric is from CCLI
const isFromCCLI = await isFromCCLI(lyric);

// Get CCLI metadata
const metadata = await getCCLIMetadataFromLyric(lyric);
```

## Security Considerations

1. **Credentials Storage**: API credentials are stored using the app's settings system
2. **No Plaintext Transmission**: All API calls should use HTTPS
3. **Rate Limiting**: Implement rate limiting to avoid API abuse
4. **License Compliance**: Only import songs your church is licensed to use

## Compliance & Reporting

### CCLI Reporting Requirements

When using CCLI songs, churches must:
- Report song usage to CCLI periodically
- Only use songs covered by their license
- Display copyright information when presenting

### Future Enhancements

Potential additions for compliance:
- [ ] Usage tracking and logging
- [ ] Automatic CCLI usage report generation
- [ ] Copyright display on presentation screens
- [ ] License validation before import

## Troubleshooting

### "CCLI Credentials Required" Message

**Problem**: Settings not configured  
**Solution**: Go to Settings → CCLI and enter your credentials

### "Failed to search CCLI songs"

**Problem**: Network error or invalid credentials  
**Solutions**:
- Check internet connection
- Verify credentials are correct
- Check CCLI API access is enabled

### Mock Data Only

**Problem**: Only seeing sample songs  
**Solution**: This is expected - implement actual API in `ccliService.ts`

## Development Notes

### Mock Songs Available

For testing, these songs are available:
1. "Amazing Grace (My Chains Are Gone)" - CCLI# 4768151
2. "10,000 Reasons (Bless The Lord)" - CCLI# 6016351
3. "How Great Is Our God" - CCLI# 4348399

### Extending the Integration

To add features:
1. **Additional Search Filters**: Modify `CCLISearchParamsType`
2. **Custom Import Options**: Extend `CCLIImportOptionsType`
3. **Metadata Fields**: Update `CCLILyricMetadataType`

## API Documentation

For CCLI API documentation:
- Contact CCLI support: [support.ccli.com](https://support.ccli.com)
- API documentation (requires approval)
- Developer forums and resources

## License

This integration module is part of Open Worship App and follows the same GPL v2 license. CCLI content and API access are subject to CCLI's terms and conditions.

## Support

For issues with:
- **Open Worship App Integration**: Create an issue on GitHub
- **CCLI API Access**: Contact CCLI support
- **SongSelect Subscription**: Contact CCLI customer service

---

**Last Updated**: December 31, 2025  
**Version**: 1.0.0  
**Status**: Development (Mock Implementation)
