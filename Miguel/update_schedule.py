import re
from datetime import datetime

# Staff name mapping from ICS to Notion Team Member IDs
STAFF_MAPPING = {
    "C. Gutierrez": ("Carina Gutierrez", "2bb746b9-e0e8-81e0-88d8-e6460cb03050"),
    "Arian Wallace": ("Arian Wallace", "2bb746b9-e0e8-81f4-8ca6-f9570d62d80d"),
    "Derek Almeida": ("Derek Almeida", "2bb746b9-e0e8-815f-9535-ff58e90acb70"),
    "Mark Morales": ("Mark Morales", "2bb746b9-e0e8-816a-88b1-e7cde5c9e83b"),
    "Cassandra V.": ("Cassandra Vasquez", "2bb746b9-e0e8-81c1-bd9e-d31e8e9f4060"),
    "M. Beltran": ("Michelle Beltran", "2bb746b9-e0e8-8199-b79c-e1369cac5e24"),
    "Kaleb Ibarra": ("Kaleb Ibarra", "2bb746b9-e0e8-812b-ae17-f5dc495c5467"),
    "Ibarra": ("Kaleb Ibarra", "2bb746b9-e0e8-812b-ae17-f5dc495c5467"),
    "Susana Terrazas": ("Susana Terrazas", "2bb746b9-e0e8-8157-ae59-d6d34de87518"),
    "Terrazas": ("Susana Terrazas", "2bb746b9-e0e8-8157-ae59-d6d34de87518"),
    "Angel Alba": ("Angel Alba", "2bb746b9-e0e8-81c9-8856-cdf43681afac"),
    "Alba": ("Angel Alba", "2bb746b9-e0e8-81c9-8856-cdf43681afac"),
    "Angel Almeida": ("Angel Almeida", "2bb746b9-e0e8-81ed-a603-fa990cb85a6b"),
    "Ashley Martin": ("Ashley Martin", "2bb746b9-e0e8-819e-bbe2-de3f51cfba47"),
    "Martin": ("Ashley Martin", "2bb746b9-e0e8-819e-bbe2-de3f51cfba47"),
    "D. Romero": ("Diana Romero", "2bb746b9-e0e8-81dd-98d0-ca8224c84b3e"),
    "Juan Pablo": ("Juan Amaya", "2bb746b9-e0e8-8173-bbc5-fc8814fcf386"),
    "Elsa Martinez": ("Elsa Martinez", "2bb746b9-e0e8-81c1-9b05-cf1daf07a3d1"),
    "Martinez": ("Elsa Martinez", "2bb746b9-e0e8-81c1-9b05-cf1daf07a3d1"),
    "Valerie Gomez": ("Valerie Gomez", "2bb746b9-e0e8-8183-a0de-fa93c6062cdd"),
    "Gomez": ("Valerie Gomez", "2bb746b9-e0e8-8183-a0de-fa93c6062cdd"),
    "D. Caballero": ("Diana Caballero", "2bb746b9-e0e8-81a2-ab4f-f97ef81a97c3"),
    "Vada Garcia": ("Vada Garcia", "2bb746b9-e0e8-8195-a92f-f6e80de6c6d6"),
    "Garcia": ("Vada Garcia", "2bb746b9-e0e8-8195-a92f-f6e80de6c6d6"),
    "Alex Morales": ("Alex Morales", "2bb746b9-e0e8-8160-8f9d-c539efd5bd9e"),
    "M. Dominguez": ("Marisol Dominguez", "2bb746b9-e0e8-8174-bf16-c83fb8c77e61"),
    "Priscilla Ramos": ("Priscilla Ramos", "2bb746b9-e0e8-81e8-a36b-e978548bcedf"),
    "Ramos": ("Priscilla Ramos", "2bb746b9-e0e8-81e8-a36b-e978548bcedf"),
    "Audrey G.": ("Audrey Gutierrez", "2bb746b9-e0e8-8102-a1c4-d481d8c8b4a9"),
    "Karla Santillan": ("Karla Santillan", "2bb746b9-e0e8-81c9-983e-ea42f1e67864"),
    "Santillan": ("Karla Santillan", "2bb746b9-e0e8-81c9-983e-ea42f1e67864"),
}

def parse_ics_file(filepath):
    """Parse ICS file and extract events"""
    events = []
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Split into individual events
    event_blocks = re.findall(r'BEGIN:VEVENT.*?END:VEVENT', content, re.DOTALL)

    for block in event_blocks:
        # Extract date (YYYYMMDD format)
        date_match = re.search(r'DTSTART;VALUE=DATE:(\d{8})', block)
        if not date_match:
            continue

        date_str = date_match.group(1)
        date_obj = datetime.strptime(date_str, '%Y%m%d')

        # Extract location (address)
        location_match = re.search(r'LOCATION:(.+)', block)
        if not location_match:
            continue
        location = location_match.group(1).strip()

        # Extract summary to get staff names
        summary_match = re.search(r'SUMMARY:(.+)', block)
        if not summary_match:
            continue
        summary = summary_match.group(1).strip()

        # Parse staff from summary: "ADDRESS - STAFF1 & STAFF2" or "ADDRESS - STAFF1"
        staff_part = summary.split(' - ', 1)
        if len(staff_part) < 2:
            continue

        staff_names = staff_part[1]
        staff_list = [s.strip() for s in staff_names.split(' & ')]

        events.append({
            'date': date_obj,
            'date_str': date_str,
            'address': location,
            'staff': staff_list
        })

    return events

def format_date_for_notion_title(date_obj):
    """Convert date to DD/MM/YYYY format for matching Notion titles"""
    return date_obj.strftime('%d/%m/%Y')

def main():
    # Parse ICS file
    ics_file = r'C:\Users\Aidan\Downloads\model_home_schedule_dec_2025 (2) (1).ics'
    events = parse_ics_file(ics_file)

    print(f"Parsed {len(events)} events from ICS file")

    # Create a lookup by date and address
    events_by_date_address = {}
    for event in events:
        key = (format_date_for_notion_title(event['date']), event['address'])
        events_by_date_address[key] = event

    # Print parsed data for verification
    print("\nSample parsed events:")
    for i, event in enumerate(events[:5]):
        print(f"\n{i+1}. {format_date_for_notion_title(event['date'])} - {event['address']}")
        print(f"   Staff: {', '.join(event['staff'])}")
        for staff_name in event['staff']:
            if staff_name in STAFF_MAPPING:
                full_name, member_id = STAFF_MAPPING[staff_name]
                print(f"   - {staff_name} => {full_name} ({member_id})")
            else:
                print(f"   - {staff_name} => NOT MAPPED!")

    # Output mapping for MCP tool usage
    print("\n\n=== EVENTS BY DATE/ADDRESS ===")
    for key, event in sorted(events_by_date_address.items()):
        date_str, address = key
        print(f"\n{date_str} - {address}")
        print(f"  Staff 1: {event['staff'][0] if len(event['staff']) > 0 else 'None'}")
        if len(event['staff']) > 0 and event['staff'][0] in STAFF_MAPPING:
            print(f"    => {STAFF_MAPPING[event['staff'][0]][0]} ({STAFF_MAPPING[event['staff'][0]][1]})")
        if len(event['staff']) > 1:
            print(f"  Staff 2: {event['staff'][1]}")
            if event['staff'][1] in STAFF_MAPPING:
                print(f"    => {STAFF_MAPPING[event['staff'][1]][0]} ({STAFF_MAPPING[event['staff'][1]][1]})")

if __name__ == '__main__':
    main()
