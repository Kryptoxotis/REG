import pandas as pd
import requests
import time
import json
from typing import Dict, List, Optional

# Notion API configuration
import os
NOTION_API_KEY = os.environ.get("NOTION_API_KEY", "")
if not NOTION_API_KEY:
    print("ERROR: NOTION_API_KEY environment variable not set!")
    print("Please set it by running: set NOTION_API_KEY=your_key_here")
    exit(1)

DATABASE_ID = "2bb746b9-e0e8-8163-9afe-cf0c567c2586"
NOTION_VERSION = "2022-06-28"

headers = {
    "Authorization": f"Bearer {NOTION_API_KEY}",
    "Content-Type": "application/json",
    "Notion-Version": NOTION_VERSION
}

def read_xlsx_file(file_path: str) -> pd.DataFrame:
    """Read the xlsx file and return a DataFrame."""
    print(f"Reading xlsx file: {file_path}")
    df = pd.read_excel(file_path)
    print(f"Found {len(df)} properties in xlsx file")
    return df

def query_notion_database(database_id: str) -> List[Dict]:
    """Query all pages from Notion database with pagination."""
    print("Querying Notion database...")
    all_pages = []
    has_more = True
    start_cursor = None

    while has_more:
        payload = {"page_size": 100}
        if start_cursor:
            payload["start_cursor"] = start_cursor

        response = requests.post(
            f"https://api.notion.com/v1/databases/{database_id}/query",
            headers=headers,
            json=payload
        )

        if response.status_code != 200:
            print(f"Error querying database: {response.status_code} - {response.text}")
            break

        data = response.json()
        all_pages.extend(data.get("results", []))
        has_more = data.get("has_more", False)
        start_cursor = data.get("next_cursor")

        print(f"Retrieved {len(all_pages)} pages so far...")
        time.sleep(0.3)  # Rate limit

    print(f"Total pages retrieved from Notion: {len(all_pages)}")
    return all_pages

def create_address_lookup(notion_pages: List[Dict]) -> Dict[str, str]:
    """Create a lookup dictionary mapping addresses to page IDs."""
    lookup = {}
    for page in notion_pages:
        title_property = page["properties"].get("Address", {})
        if title_property.get("title"):
            address = title_property["title"][0]["plain_text"]
            lookup[address.strip().lower()] = page["id"]
    return lookup

def clean_percentage(value) -> Optional[int]:
    """Convert percentage string like '100%' to integer 100."""
    if pd.isna(value):
        return None
    if isinstance(value, str):
        return int(value.replace('%', ''))
    return int(value)

def build_notion_properties(row: pd.Series) -> Dict:
    """Build Notion properties object from xlsx row."""
    properties = {}

    # Address (title)
    address = f"{row['Stnum']} {row['Stname']}"
    properties["Address"] = {
        "title": [{"text": {"content": address}}]
    }

    # SqFt (number)
    if pd.notna(row['Sq. Ft.']):
        properties["SqFt"] = {"number": int(row['Sq. Ft.'])}

    # Floorplan (rich_text)
    if pd.notna(row['Plan']):
        properties["Floorplan"] = {
            "rich_text": [{"text": {"content": str(row['Plan'])}}]
        }

    # Subdivision (select)
    if pd.notna(row['Subdivision']):
        properties["Subdivision"] = {
            "select": {"name": str(row['Subdivision'])}
        }

    # Lot (rich_text)
    if pd.notna(row['Lot']):
        properties["Lot"] = {
            "rich_text": [{"text": {"content": str(int(row['Lot']))}}]
        }

    # Block (rich_text)
    if pd.notna(row['Block']):
        properties["Block"] = {
            "rich_text": [{"text": {"content": str(int(row['Block']))}}]
        }

    # Stage (rich_text) - Foreman Stage
    if pd.notna(row['Foreman Stage']):
        properties["Stage"] = {
            "rich_text": [{"text": {"content": str(row['Foreman Stage'])}}]
        }

    # Stage Completion % (number)
    completion = clean_percentage(row['Stage Completion Percentage'])
    if completion is not None:
        properties["Stage Completion %"] = {"number": completion}

    # Status (select) - Sold/Available
    if pd.notna(row['Sold/Available']):
        status_value = str(row['Sold/Available']).strip()
        if status_value.lower() in ['sold', 'available', 'model']:
            properties["Status"] = {
                "select": {"name": status_value.capitalize()}
            }

    # Edwards Co. (rich_text)
    if pd.notna(row['Edwards Co.']):
        properties["Edwards Co."] = {
            "rich_text": [{"text": {"content": str(row['Edwards Co.'])}}]
        }

    # Sales Price (number) - SP
    if pd.notna(row['SP']):
        properties["Sales Price"] = {"number": float(row['SP'])}

    # Foreman (rich_text)
    if pd.notna(row['Foreman']):
        properties["Foreman"] = {
            "rich_text": [{"text": {"content": str(row['Foreman'])}}]
        }

    return properties

def update_notion_page(page_id: str, properties: Dict) -> bool:
    """Update an existing Notion page."""
    response = requests.patch(
        f"https://api.notion.com/v1/pages/{page_id}",
        headers=headers,
        json={"properties": properties}
    )

    if response.status_code == 200:
        return True
    else:
        print(f"Error updating page {page_id}: {response.status_code} - {response.text}")
        return False

def create_notion_page(database_id: str, properties: Dict) -> bool:
    """Create a new Notion page."""
    payload = {
        "parent": {"database_id": database_id},
        "properties": properties
    }

    response = requests.post(
        "https://api.notion.com/v1/pages",
        headers=headers,
        json=payload
    )

    if response.status_code == 200:
        return True
    else:
        print(f"Error creating page: {response.status_code} - {response.text}")
        return False

def sync_properties(xlsx_path: str, database_id: str):
    """Main sync function."""
    print("=== Starting Property Sync ===\n")

    # Read xlsx file
    df = read_xlsx_file(xlsx_path)

    # Query Notion database
    notion_pages = query_notion_database(database_id)
    address_lookup = create_address_lookup(notion_pages)

    # Process in batches
    batch_size = 10
    updated_count = 0
    created_count = 0
    error_count = 0

    for i in range(0, len(df), batch_size):
        batch = df.iloc[i:i+batch_size]
        print(f"\nProcessing batch {i//batch_size + 1} (rows {i+1}-{min(i+batch_size, len(df))})")

        for idx, row in batch.iterrows():
            # Create address
            address = f"{row['Stnum']} {row['Stname']}"
            address_key = address.strip().lower()

            # Build properties
            properties = build_notion_properties(row)

            # Check if exists
            if address_key in address_lookup:
                # Update existing
                page_id = address_lookup[address_key]
                if update_notion_page(page_id, properties):
                    updated_count += 1
                    print(f"  ✓ Updated: {address}")
                else:
                    error_count += 1
                    print(f"  ✗ Error updating: {address}")
            else:
                # Create new
                if create_notion_page(database_id, properties):
                    created_count += 1
                    print(f"  ✓ Created: {address}")
                else:
                    error_count += 1
                    print(f"  ✗ Error creating: {address}")

            time.sleep(0.3)  # Rate limit

    # Summary
    print("\n=== Sync Complete ===")
    print(f"Total properties in xlsx: {len(df)}")
    print(f"Properties updated: {updated_count}")
    print(f"Properties created: {created_count}")
    print(f"Errors: {error_count}")

if __name__ == "__main__":
    xlsx_file = r"C:\Users\Aidan\OneDrive\Desktop\CURSOR\REG\REG Sheets\Status Report 12.3.2025.xlsx"
    sync_properties(xlsx_file, DATABASE_ID)
