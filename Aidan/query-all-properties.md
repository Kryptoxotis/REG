# Notion Properties Database - Find ALL Duplicates

## Database ID
2bb746b9-e0e8-8163-9afe-cf0c567c2586

## Strategy
1. Query with page_size=100
2. Track has_more and next_cursor
3. Continue until has_more=false
4. Collect all addresses and IDs
5. Find duplicates

## Known Information
- User expects 5 total duplicate addresses
- "252 Park Vista" is confirmed as one duplicate
- Need to find 4 more duplicate addresses

## Progress
- Batch 1 (cursor: initial): Retrieved ~24 properties
- Need to continue pagination to get ALL properties
