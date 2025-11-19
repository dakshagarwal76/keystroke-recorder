const { getDriveClient, uploadFile, getFileContent, updateFile } = require('../lib/drive-client');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  
  try {
    const { deviceId } = req.body;
    const drive = getDriveClient();
    const rootFolderId = process.env.DRIVE_FOLDER_ID;
    
    // Get counter.json
    const fileData = await getFileContent(drive, 'counter.json', rootFolderId);
    let counter = { lastId: 0, participants: {} };
    let counterFileId = null;
    
    if (fileData) {
      counterFileId = fileData.id;
      counter = typeof fileData.content === 'string' ? JSON.parse(fileData.content) : fileData.content;
      if (!counter.participants) counter.participants = {};
    }
    
    // Increment global counter
    counter.lastId += 1;
    const participantId = `U${String(counter.lastId).padStart(3, '0')}`;
    
    // Track session for this participant on this device
    const deviceKey = `${deviceId}_${participantId}`;
    if (!counter.participants[deviceKey]) {
      counter.participants[deviceKey] = { sessionCount: 0 };
    }
    counter.participants[deviceKey].sessionCount += 1;
    const sessionNumber = counter.participants[deviceKey].sessionCount;
    
    // Update counter
    const counterBuffer = Buffer.from(JSON.stringify(counter, null, 2));
    if (counterFileId) {
      await updateFile(drive, counterFileId, counterBuffer, 'application/json');
    } else {
      await uploadFile(drive, rootFolderId, 'counter.json', counterBuffer, 'application/json');
    }
    
    res.json({ participantId, sessionNumber });
  } catch (error) {
    console.error('ID generation error:', error);
    res.status(500).json({ error: error.message });
  }
};
