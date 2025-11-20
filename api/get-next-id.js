import { getDriveClient, getFileContent, uploadFile, updateFile } from '../lib/googleDriveClient';

export default async function handler(req, res) {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const drive = getDriveClient();
    const rootFolderId = process.env.DRIVE_FOLDER_ID;
    const { deviceId } = req.body;

    if (!deviceId) {
      return res.status(400).json({ error: 'Missing deviceId' });
    }

    console.log('Getting participant ID for device:', deviceId);

    // Load counter file with retry logic
    let counter = { lastId: 0, deviceParticipants: {} };
    let counterFileId = null;
    let retryCount = 0;
    const maxRetries = 3;

    while (retryCount < maxRetries) {
      try {
        const fileData = await getFileContent(drive, 'counter.json', rootFolderId);
        
        if (fileData) {
          counterFileId = fileData.id;
          counter = typeof fileData.content === 'string' 
            ? JSON.parse(fileData.content) 
            : fileData.content;
          if (!counter.deviceParticipants) counter.deviceParticipants = {};
        }
        break; // Success, exit retry loop
      } catch (err) {
        retryCount++;
        if (retryCount >= maxRetries) throw err;
        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, 100 * retryCount));
      }
    }

    let participantId;
    let participantData;
    let isNewParticipant = false;

    if (counter.deviceParticipants[deviceId]) {
      // Existing device - return existing participant data
      participantData = counter.deviceParticipants[deviceId];
      participantId = participantData.participantId;
      console.log('Existing device:', deviceId, '-> Participant:', participantId);
    } else {
      // NEW device - need to assign unique participant ID
      isNewParticipant = true;
      console.log('New device detected:', deviceId);

      // Query Google Drive for ALL existing participant folders (source of truth)
      const folderList = await drive.files.list({
        q: `'${rootFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: 'files(name)',
        spaces: 'drive',
      });

      // Extract all existing participant IDs from folder names
      const existingIds = [];
      if (folderList.data.files) {
        for (const file of folderList.data.files) {
          const match = file.name.match(/^U(\d{3})$/);
          if (match) {
            existingIds.push(parseInt(match[1], 10));
          }
        }
      }

      // Also check counter.json for any IDs not yet in folders
      const counterIds = Object.values(counter.deviceParticipants).map(p => {
        if (!p.participantId || typeof p.participantId !== 'string') return 0;
        const match = p.participantId.match(/^U(\d{3})$/);
        return match ? parseInt(match[1], 10) : 0;
      });

      existingIds.push(...counterIds);

      // Remove duplicates and sort
      const allIds = [...new Set(existingIds)].sort((a, b) => a - b);
      console.log('Existing participant IDs:', allIds);

      // Find the first available gap or next sequential ID
      let nextId = 1;
      for (const id of allIds) {
        if (id === nextId) {
          nextId++;
        } else if (id > nextId) {
          break; // Found a gap
        }
      }

      // Assign the participant ID
      participantId = `U${String(nextId).padStart(3, '0')}`;
      counter.lastId = Math.max(counter.lastId, nextId);
      console.log('Assigned new participant ID:', participantId);

      // Initialize participant data with persons tracking
      participantData = {
        participantId,
        persons: {
          '1': { 
            sessionCount: 0, 
            completedSubmissions: 0, 
            lastAccess: null 
          }
        },
        lastAccess: new Date().toISOString(),
        registeredAt: new Date().toISOString()
      };
      counter.deviceParticipants[deviceId] = participantData;
    }

    // Ensure persons object exists (for backward compatibility)
    if (!participantData.persons) {
      participantData.persons = {
        '1': { sessionCount: 0, completedSubmissions: 0, lastAccess: null }
      };
    }

    // Ensure Person 1 exists
    if (!participantData.persons['1']) {
      participantData.persons['1'] = { sessionCount: 0, completedSubmissions: 0, lastAccess: null };
    }

    // Increment session count for Person 1 (default on page load)
    participantData.persons['1'].sessionCount += 1;
    participantData.persons['1'].lastAccess = new Date().toISOString();
    participantData.lastAccess = new Date().toISOString();

    const sessionNumber = participantData.persons['1'].sessionCount;

    // Determine which persons are unlocked
    const unlockedPersons = [1]; // Person 1 always unlocked
    for (let i = 1; i <= 5; i++) {
      const person = participantData.persons[String(i)];
      if (person && person.completedSubmissions > 0) {
        // This person has completed at least one submission
        // Unlock next person
        if (i < 5 && !unlockedPersons.includes(i + 1)) {
          unlockedPersons.push(i + 1);
          // Initialize next person if not exists
          if (!participantData.persons[String(i + 1)]) {
            participantData.persons[String(i + 1)] = {
              sessionCount: 0,
              completedSubmissions: 0,
              lastAccess: null
            };
          }
        }
      }
    }

    console.log('Unlocked persons:', unlockedPersons);

    // Save updated counter file with retry logic
    const counterBuffer = Buffer.from(JSON.stringify(counter, null, 2));
    retryCount = 0;

    while (retryCount < maxRetries) {
      try {
        if (counterFileId) {
          await updateFile(drive, counterFileId, counterBuffer, 'application/json');
        } else {
          await uploadFile(drive, rootFolderId, 'counter.json', counterBuffer, 'application/json');
        }
        console.log('Counter saved successfully');
        break; // Success
      } catch (err) {
        retryCount++;
        if (retryCount >= maxRetries) {
          console.error('Failed to save counter after retries:', err);
          throw err;
        }
        await new Promise(resolve => setTimeout(resolve, 100 * retryCount));
      }
    }

    console.log(`Session assigned: ${participantId} - Session ${sessionNumber}`);

    // Return participant ID, session number, and unlocked persons
    res.json({ 
      participantId, 
      sessionNumber,
      unlockedPersons, // Array of unlocked person numbers [1, 2, etc.]
      currentPerson: '1', // Default to Person 1
      isNewParticipant
    });
  } catch (error) {
    console.error('Get next ID error:', error);
    res.status(500).json({ 
      error: error.message || 'Internal Server Error' 
    });
  }
}
