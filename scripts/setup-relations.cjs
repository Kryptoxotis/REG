const axios = require('axios');

const NOTION_API_KEY = process.env.NOTION_API_KEY;
const NOTION_VERSION = '2022-06-28';

// Updated Database IDs (confirmed visible to API)
const DB_IDS = {
  TEAM_MEMBERS: '2bb746b9-e0e8-815b-a4de-d2d5aa5ef4e5',
  PROPERTIES: '2bb746b9-e0e8-8163-9afe-cf0c567c2586',
  PIPELINE: '2bb746b9-e0e8-81f3-90c9-d2d317085a50',
  CLIENTS: '2bb746b9-e0e8-8176-b5ed-dfe744fc0246',
  SCHEDULE: '2bb746b9-e0e8-810a-b85d-e1a517ca1349'
};

const notionApi = axios.create({
  baseURL: 'https://api.notion.com/v1',
  headers: {
    'Authorization': `Bearer ${NOTION_API_KEY}`,
    'Notion-Version': NOTION_VERSION,
    'Content-Type': 'application/json'
  }
});

// Helper to get all pages from a database
async function getAllPages(databaseId) {
  const pages = [];
  let cursor = undefined;

  do {
    const response = await notionApi.post(`/databases/${databaseId}/query`, {
      start_cursor: cursor,
      page_size: 100
    });
    pages.push(...response.data.results);
    cursor = response.data.next_cursor;
  } while (cursor);

  return pages;
}

// Helper to update database schema
async function updateDatabaseSchema(databaseId, properties) {
  try {
    const response = await notionApi.patch(`/databases/${databaseId}`, { properties });
    console.log(`Updated database schema: ${databaseId}`);
    return response.data;
  } catch (error) {
    console.error('Failed to update schema:', error.response?.data || error.message);
    throw error;
  }
}

// Helper to update a page
async function updatePage(pageId, properties) {
  try {
    await notionApi.patch(`/pages/${pageId}`, { properties });
    return true;
  } catch (error) {
    console.error(`Failed to update page ${pageId}:`, error.response?.data?.message || error.message);
    return false;
  }
}

// Get text value from property
function getTextValue(prop) {
  if (!prop) return '';
  if (prop.type === 'title' && prop.title?.length) {
    return prop.title[0].plain_text || '';
  }
  if (prop.type === 'rich_text' && prop.rich_text?.length) {
    return prop.rich_text[0].plain_text || '';
  }
  return '';
}

// Task 1: Setup Relations
async function setupRelations() {
  console.log('\n=== TASK 1: Setting up Relations ===\n');

  // Step 1: Get all Team Members for matching
  console.log('Fetching Team Members...');
  const teamMembers = await getAllPages(DB_IDS.TEAM_MEMBERS);
  const teamMemberMap = {};
  teamMembers.forEach(tm => {
    const name = getTextValue(tm.properties['Name']);
    if (name) {
      teamMemberMap[name.toLowerCase().trim()] = tm.id;
      // Also map partial names (first name only)
      const firstName = name.split(' ')[0].toLowerCase();
      if (!teamMemberMap[firstName]) {
        teamMemberMap[firstName] = tm.id;
      }
    }
  });
  console.log(`Found ${teamMembers.length} team members`);

  // Step 2: Get all Properties for matching
  console.log('Fetching Properties...');
  const properties = await getAllPages(DB_IDS.PROPERTIES);
  const propertyMap = {};
  properties.forEach(p => {
    const address = getTextValue(p.properties['Address']);
    if (address) {
      propertyMap[address.toLowerCase().trim()] = p.id;
      // Also map without subdivision suffixes
      const simpleAddr = address.split(',')[0].toLowerCase().trim();
      if (!propertyMap[simpleAddr]) {
        propertyMap[simpleAddr] = p.id;
      }
    }
  });
  console.log(`Found ${properties.length} properties`);

  // Step 3: Add relation properties to Pipeline database
  console.log('\nAdding relation properties to Pipeline...');
  try {
    await updateDatabaseSchema(DB_IDS.PIPELINE, {
      'Agent Relation': {
        relation: {
          database_id: DB_IDS.TEAM_MEMBERS,
          single_property: {}
        }
      },
      'Assisting Agent Relation': {
        relation: {
          database_id: DB_IDS.TEAM_MEMBERS,
          single_property: {}
        }
      }
    });
  } catch (e) {
    console.log('Relations may already exist, continuing...');
  }

  // Step 4: Add relation properties to Schedule database
  console.log('Adding relation properties to Schedule...');
  try {
    await updateDatabaseSchema(DB_IDS.SCHEDULE, {
      'Staff 1 Relation': {
        relation: {
          database_id: DB_IDS.TEAM_MEMBERS,
          single_property: {}
        }
      },
      'Staff 2 Relation': {
        relation: {
          database_id: DB_IDS.TEAM_MEMBERS,
          single_property: {}
        }
      },
      'Property Relation': {
        relation: {
          database_id: DB_IDS.PROPERTIES,
          single_property: {}
        }
      }
    });
  } catch (e) {
    console.log('Relations may already exist, continuing...');
  }

  // Step 5: Update Pipeline records with relations
  console.log('\nUpdating Pipeline records with relations...');
  const pipelineRecords = await getAllPages(DB_IDS.PIPELINE);
  let pipelineUpdated = 0;
  let pipelineSkipped = 0;
  const unmatchedAgents = new Set();

  for (const record of pipelineRecords) {
    const agentText = getTextValue(record.properties['Agent']);
    const props = {};

    if (agentText) {
      const agentId = teamMemberMap[agentText.toLowerCase().trim()];
      if (agentId) {
        props['Agent Relation'] = { relation: [{ id: agentId }] };
      } else {
        unmatchedAgents.add(agentText);
      }
    }

    if (Object.keys(props).length > 0) {
      const success = await updatePage(record.id, props);
      if (success) {
        pipelineUpdated++;
        process.stdout.write('.');
      }
    } else {
      pipelineSkipped++;
    }
  }
  console.log(`\nPipeline: Updated ${pipelineUpdated}, Skipped ${pipelineSkipped}`);
  if (unmatchedAgents.size > 0) {
    console.log('Unmatched agents:', Array.from(unmatchedAgents));
  }

  // Step 6: Update Schedule records with relations
  console.log('\nUpdating Schedule records with relations...');
  const scheduleRecords = await getAllPages(DB_IDS.SCHEDULE);
  let scheduleUpdated = 0;
  let scheduleSkipped = 0;
  const unmatchedStaff = new Set();
  const unmatchedProperties = new Set();

  for (const record of scheduleRecords) {
    const staff1Text = getTextValue(record.properties['Assigned Staff 1']);
    const staff2Text = getTextValue(record.properties['Assigned Staff 2']);
    const modelHomeText = getTextValue(record.properties['Model Home Address']);
    const props = {};

    if (staff1Text) {
      const staffId = teamMemberMap[staff1Text.toLowerCase().trim()];
      if (staffId) {
        props['Staff 1 Relation'] = { relation: [{ id: staffId }] };
      } else {
        unmatchedStaff.add(staff1Text);
      }
    }

    if (staff2Text) {
      const staffId = teamMemberMap[staff2Text.toLowerCase().trim()];
      if (staffId) {
        props['Staff 2 Relation'] = { relation: [{ id: staffId }] };
      } else {
        unmatchedStaff.add(staff2Text);
      }
    }

    if (modelHomeText) {
      const propId = propertyMap[modelHomeText.toLowerCase().trim()];
      if (propId) {
        props['Property Relation'] = { relation: [{ id: propId }] };
      } else {
        unmatchedProperties.add(modelHomeText);
      }
    }

    if (Object.keys(props).length > 0) {
      const success = await updatePage(record.id, props);
      if (success) {
        scheduleUpdated++;
        process.stdout.write('.');
      }
    } else {
      scheduleSkipped++;
    }
  }
  console.log(`\nSchedule: Updated ${scheduleUpdated}, Skipped ${scheduleSkipped}`);
  if (unmatchedStaff.size > 0) {
    console.log('Unmatched staff:', Array.from(unmatchedStaff).slice(0, 10));
  }
  if (unmatchedProperties.size > 0) {
    console.log('Unmatched properties:', Array.from(unmatchedProperties).slice(0, 10));
  }
}

// Task 2: Add Calculated Fields to Pipeline
async function addCalculatedFields() {
  console.log('\n=== TASK 2: Adding Calculated Fields to Pipeline ===\n');

  try {
    await updateDatabaseSchema(DB_IDS.PIPELINE, {
      'Commission %': {
        number: {
          format: 'percent'
        }
      },
      'Commission $': {
        formula: {
          expression: 'prop(\"Sales Price\") * prop(\"Commission %\")'
        }
      },
      'Closing Cost %': {
        number: {
          format: 'percent'
        }
      },
      'Closing Cost $': {
        formula: {
          expression: 'prop(\"Sales Price\") * prop(\"Closing Cost %\")'
        }
      },
      'Total Builder Contribution': {
        formula: {
          expression: 'prop(\"Closing Cost $\")'
        }
      }
    });
    console.log('Added calculated fields to Pipeline');

    // Set default commission % to 3% for existing records
    console.log('Setting default Commission % (3%) for existing records...');
    const pipelineRecords = await getAllPages(DB_IDS.PIPELINE);
    let updated = 0;

    for (const record of pipelineRecords) {
      const success = await updatePage(record.id, {
        'Commission %': { number: 0.03 }
      });
      if (success) {
        updated++;
        process.stdout.write('.');
      }
    }
    console.log(`\nSet default commission for ${updated} records`);

  } catch (error) {
    console.error('Error adding calculated fields:', error.response?.data || error.message);
  }
}

// Task 4: Add Team Scoreboard Rollups
async function addTeamScoreboard() {
  console.log('\n=== TASK 4: Adding Team Scoreboard Rollups ===\n');

  // First we need to add a relation from Team Members to Pipeline (reverse of Agent Relation)
  // This is needed for rollups to work

  try {
    // Get the current Pipeline database to find the relation property ID
    const pipelineDb = await notionApi.get(`/databases/${DB_IDS.PIPELINE}`);
    const agentRelationProp = pipelineDb.data.properties['Agent Relation'];

    if (agentRelationProp && agentRelationProp.relation) {
      console.log('Found Agent Relation, adding rollups to Team Members...');

      // The rollups reference the relation on Team Members that syncs back
      await updateDatabaseSchema(DB_IDS.TEAM_MEMBERS, {
        'Deal Count': {
          rollup: {
            relation_property_name: 'Agent Relation',
            rollup_property_name: 'Address',
            function: 'count'
          }
        },
        'Total Sales': {
          rollup: {
            relation_property_name: 'Agent Relation',
            rollup_property_name: 'Sales Price',
            function: 'sum'
          }
        }
      });
      console.log('Added rollup fields to Team Members');
    }
  } catch (error) {
    console.error('Error adding rollups:', error.response?.data || error.message);
    console.log('Note: Rollups require bi-directional relations which may need manual setup in Notion UI');
  }
}

// Main execution
async function main() {
  console.log('Starting Phase 2 Setup...\n');

  try {
    // Task 1: Setup Relations
    await setupRelations();

    // Task 2: Add Calculated Fields
    await addCalculatedFields();

    // Task 4: Team Scoreboard (Task 3 views need to be done in Notion UI)
    await addTeamScoreboard();

    console.log('\n\n=== PHASE 2 COMPLETE ===');
    console.log('\nNote: Database views (Task 3) need to be created manually in Notion:');
    console.log('1. Properties → Create "Model Homes" view filtered by Status = "Model Home"');
    console.log('2. Pipeline → Create "Active Deals" view excluding Closed/Cancelled');
    console.log('3. Pipeline → Create "By Agent" view grouped by Agent Relation');
    console.log('4. Team Members → Create "Active Agents" view filtered by Status = "Active"');

  } catch (error) {
    console.error('Fatal error:', error);
  }
}

main();
