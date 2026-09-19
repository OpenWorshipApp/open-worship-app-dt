# CCLI Integration Module

This module provides CCLI SongSelect integration for importing licensed worship songs.

## Quick Start

1. **Configure Credentials**: Settings → CCLI tab
2. **Search Songs**: Right-click in Lyrics list → Import from CCLI
3. **Import**: Select song → Click Import

## Files

- `ccliTypes.ts` - Type definitions
- `ccliService.ts` - API service (currently mock implementation)
- `ccliImportHelpers.ts` - Import utilities
- `CCLISongSearchComp.tsx/scss` - Search UI

## Documentation

See [CCLI_INTEGRATION.md](../../docs/CCLI_INTEGRATION.md) for complete documentation.

## Implementation Status

⚠️ **Current**: Mock implementation with sample data  
🎯 **Next**: Implement actual CCLI API integration

## Mock Songs Available

For development/testing:
- Amazing Grace (My Chains Are Gone) - CCLI# 4768151
- 10,000 Reasons (Bless The Lord) - CCLI# 6016351
- How Great Is Our God - CCLI# 4348399
