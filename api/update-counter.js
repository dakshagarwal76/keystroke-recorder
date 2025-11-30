import { getDriveClient, getFileContent, updateFile } from '../lib/googleDriveClient';

export default async function handler(req, res) {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const drive = getDriveClient();
    const rootFolderId = process.env.DRIVE_FOLDER_ID;
    const { deviceId, person } = req.body;

    if (!deviceId || !person) {
      return res.status(400).json({ error: 'Missing deviceId or person' });
    }

    console.log('Updating counter for device:', deviceId, 'person:', person);

    // Load counter.json
    const counterData = await getFileContent(drive, 'counter.json', rootFolderId);
    
    if (!counterData) {
      return res.status(404).json({ error: 'Counter.json not found' });
    }

    const counter = typeof counterData.content === 'string'
      ? JSON.parse(counterData.content)
      : counterData.content;

    if (!counter.deviceParticipants || !counter.deviceParticipants[deviceId]) {
      return res.status(404).json({ error: 'Device not found in counter' });
    }

    const participantData = counter.deviceParticipants[deviceId];

    // Ensure person exists
    if (!participantData.persons[person]) {
      participantData.persons[person] = {
        sessionCount: 0,
        completedSubmissions: 0,
        lastAccess: null
      };
    }

    console.log('📊 BEFORE:', {
      person,
      sessionCount: participantData.persons[person].sessionCount,
      completedSubmissions: participantData.persons[person].completedSubmissions
    });

    // Increment BOTH sessionCount and completedSubmissions
    participantData.persons[person].sessionCount += 1;
    participantData.persons[person].completedSubmissions += 1;
    participantData.persons[person].lastAccess = new Date().toISOString();
    participantData.lastAccess = new Date().toISOString();

    const completedCount = participantData.persons[person].completedSubmissions;

    console.log('📊 AFTER:', {
      person,
      sessionCount: participantData.persons[person].sessionCount,
      completedSubmissions: completedCount
    });

    // Unlock next person if this person just completed their FIRST upload
    if (completedCount === 1 && parseInt(person) < 5) {
      const nextPerson = String(parseInt(person) + 1);
      if (!participantData.persons[nextPerson]) {
        participantData.persons[nextPerson] = {
          sessionCount: 0,
          completedSubmissions: 0,
          lastAccess: null
        };
      }
      console.log(`✅ Person ${nextPerson} has been unlocked!`);
    }

    // Save updated counter
    const counterBuffer = Buffer.from(JSON.stringify(counter, null, 2));
    await updateFile(drive, counterData.id, counterBuffer, 'application/json');
    console.log('✅ Counter.json saved successfully');

    res.json({
      success: true,
      updatedSession: participantData.persons[person].sessionCount,
      updatedCompletions: completedCount
    });

  } catch (error) {
    console.error('Update counter error:', error);
    res.status(500).json({ error: error.message });
  }
}
