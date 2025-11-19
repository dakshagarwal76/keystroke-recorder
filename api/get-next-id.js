const { getDriveClient, uploadFile, getFileContent, updateFile } = require('../lib/googleDriveClient');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  
  try {
    console.log('=== GET NEXT ID START ===');
    const { deviceId } = req.body;
    if (!deviceId) {
      return res.status(400).json({ error: 'Missing deviceId in request body' });
    }
    console.log('Device ID:', deviceId);
    
    // Get Drive client authenticated via OAuth2 refresh token
    const drive = getDriveClient();
    const rootFolderId = process.env.DRIVE_FOLDER_ID;
    if (!rootFolderId) {
      return res.status(500).json({ error: 'DRIVE_FOLDER_ID environment variable not set' });
    }
    
    // Load current counter file contents if exist
    const fileData = await getFileContent(drive, 'counter.json', rootFolderId);
    let counter = { lastId: 0, deviceParticipants: {} };
    let counterFileId = null;
    
    if (fileData) {
      counterFileId = fileData.id;
      counter = typeof fileData.content === 'string' ? JSON.parse(fileData.content) : fileData.content;
      if (!counter.deviceParticipants) counter.deviceParticipants = {};
      console.log('Current counter:', counter.lastId);
    } else {
      console.log('Creating new counter');
    }
    
    // Initialize participants array for this device if missing
    if (!counter.deviceParticipants[deviceId]) {
      counter.deviceParticipants[deviceId] = [];
    }
    
    // Participant/session management logic
    let participantId;
    let sessionNumber;
    
    if (counter.deviceParticipants[deviceId].length === 0) {
      counter.lastId += 1;
      participantId = `U${String(counter.lastId).padStart(3, '0')}`;
      sessionNumber = 1;
      
      counter.deviceParticipants[deviceId].push({
        participantId,
        sessionCount: 1,
        lastAccess: new Date().toISOString(),
      });
      
      console.log('New participant created:', participantId);
    } else {
      const lastParticipant = counter.deviceParticipants[deviceId][counter.deviceParticipants[deviceId].length - 1];
      const lastAccessTime = new Date(lastParticipant.lastAccess).getTime();
      const now = Date.now();
      const oneHour = 60 * 60 * 1000;
      
      if (now - lastAccessTime > oneHour) {
        counter.lastId += 1;
        participantId = `U${String(counter.lastId).padStart(3, '0')}`;
        sessionNumber = 1;
        
        counter.deviceParticipants[deviceId].push({
          participantId,
          sessionCount: 1,
          lastAccess: new Date().toISOString(),
        });
        
        console.log('New participant (session expired):', participantId);
      } else {
        participantId = lastParticipant.participantId;
        lastParticipant.sessionCount += 1;
        lastParticipant.lastAccess = new Date().toISOString();
        sessionNumber = lastParticipant.sessionCount;
        
        console.log('Existing participant, session:', sessionNumber);
      }
    }
    
    // Serialize counter to buffer and upload/update to Drive
    const counterBuffer = Buffer.from(JSON.stringify(counter, null, 2));
    if (counterFileId) {
      await updateFile(drive, counterFileId, counterBuffer, 'application/json');
    } else {
      await uploadFile(drive, rootFolderId, 'counter.json', counterBuffer, 'application/json');
    }
    
    console.log('=== GET NEXT ID SUCCESS ===');
    console.log('Result:', { participantId, sessionNumber });
    res.json({ participantId, sessionNumber });
  } catch (error) {
    console.error('=== GET NEXT ID ERROR ===');
    console.error('Error details:', error);
    res.status(500).json({ error: error.message });
  }
};
