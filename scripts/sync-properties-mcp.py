#!/usr/bin/env python3
"""
Sync properties from xlsx to Notion using MCP API
This script orchestrates the sync by preparing the data, then you run the MCP commands.
"""
import pandas as pd
import json
from typing import Dict, List, Optional

def read_xlsx_properties(file_path: str) -> List[Dict]:
    """Read properties from xlsx file."""
    df = pd.read_excel(file_path)
    properties = []

    for idx, row in df.iterrows():
        address = f"{int(row['Stnum'])} {row['Stname']}"

        prop = {
            'address': address,
            'sqft': int(row['Sq. Ft.']) if pd.notna(row['Sq. Ft.']) else None,
            'plan': str(row['Plan']) if pd.notna(row['Plan']) else None,
            'subdivision': str(row['Subdivision']) if pd.notna(row['Subdivision']) else None,
            'lot': str(int(row['Lot'])) if pd.notna(row['Lot']) else None,
            'block': str(int(row['Block'])) if pd.notna(row['Block']) else None,
            'foreman_stage': str(row['Foreman Stage']) if pd.notna(row['Foreman Stage']) else None,
            'completion_pct': int(str(row['Stage Completion Percentage']).replace('%', '')) if pd.notna(row['Stage Completion Percentage']) else None,
            'status': str(row['Sold/Available']) if pd.notna(row['Sold/Available']) else None,
            'edwards_co': str(row['Edwards Co.']) if pd.notna(row['Edwards Co.']) else None,
            'sale_price': float(row['SP']) if pd.notna(row['SP']) else None,
            'foreman': str(row['Foreman']) if pd.notna(row['Foreman']) else None
        }
        properties.append(prop)

    return properties

def build_notion_properties(prop: Dict) -> Dict:
    """Build Notion API properties object from property dict."""
    properties = {}

    # SqFt (number)
    if prop['sqft'] is not None:
        properties["SqFt"] = {"number": prop['sqft']}

    # Floorplan (rich_text)
    if prop['plan']:
        properties["Floorplan"] = {"rich_text": [{"text": {"content": prop['plan']}}]}

    # Subdivision (select)
    if prop['subdivision']:
        properties["Subdivision"] = {"select": {"name": prop['subdivision']}}

    # Lot (rich_text)
    if prop['lot']:
        properties["Lot"] = {"rich_text": [{"text": {"content": prop['lot']}}]}

    # Block (rich_text)
    if prop['block']:
        properties["Block"] = {"rich_text": [{"text": {"content": prop['block']}}]}

    # Stage (rich_text) - Foreman Stage
    if prop['foreman_stage']:
        properties["Stage"] = {"rich_text": [{"text": {"content": prop['foreman_stage']}}]}

    # Stage Completion % (number)
    if prop['completion_pct'] is not None:
        properties["Stage Completion %"] = {"number": prop['completion_pct']}

    # Status (select)
    if prop['status']:
        properties["Status"] = {"select": {"name": prop['status']}}

    # Edwards Co. (rich_text)
    if prop['edwards_co']:
        properties["Edwards Co."] = {"rich_text": [{"text": {"content": prop['edwards_co']}}]}

    # Sales Price (number)
    if prop['sale_price'] is not None:
        properties["Sales Price"] = {"number": prop['sale_price']}

    # Foreman (rich_text)
    if prop['foreman']:
        properties["Foreman"] = {"rich_text": [{"text": {"content": prop['foreman']}}]}

    return properties

def main():
    xlsx_file = r"C:\Users\Aidan\OneDrive\Desktop\CURSOR\REG\REG Sheets\Status Report 12.3.2025.xlsx"
    output_file = r"C:\Users\Aidan\OneDrive\Desktop\CURSOR\REG\scripts\sync_commands.json"

    print("Reading xlsx file...")
    properties = read_xlsx_properties(xlsx_file)
    print(f"Found {len(properties)} properties")

    # Build sync commands
    sync_data = []
    for prop in properties:
        notion_props = build_notion_properties(prop)
        sync_data.append({
            'address': prop['address'],
            'notion_properties': notion_props
        })

    # Save to file
    with open(output_file, 'w') as f:
        json.dump(sync_data, f, indent=2)

    print(f"\nSync data saved to: {output_file}")
    print(f"Total properties to sync: {len(sync_data)}")
    print("\nNext: Run the Node.js sync script to execute the MCP calls")

if __name__ == "__main__":
    main()
