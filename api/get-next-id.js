import { getDriveClient, getFileContent, uploadFile, updateFile } from '../lib/googleDriveClient';

export default async function handler(req, res) {
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

    // Load counter file from Drive
    const fileData = await getFileContent(drive, 'counter.json', rootFolderId);
    let counter = { lastId: 0, deviceParticipants: {} };
    let counterFileId = null;

    if (fileData) {
      counterFileId = fileData.id;
      counter = typeof fileData.content === 'string' ? JSON.parse(fileData.content) : fileData.content;
      if (!counter.deviceParticipants) counter.deviceParticipants = {};
    }

    // Assign or re-use participant ID for this device
    let participantId;
    if (!counter.deviceParticipants[deviceId]) {
      counter.lastId += 1;
      participantId = `U${String(counter.lastId).padStart(3, '0')}`;
      counter.deviceParticipants[deviceId] = {
        participantId,
        sessionCount: 0,
        lastAccess: new Date().toISOString()
      };
    } else {
      participantId = counter.deviceParticipants[deviceId].participantId;
    }

    // Increment session count on each call (i.e., on each reload/load)
    counter.deviceParticipants[deviceId].sessionCount += 1;
    counter.deviceParticipants[deviceId].lastAccess = new Date().toISOString();
    const nextSessionNumber = counter.deviceParticipants[deviceId].sessionCount;

    // Save updated counter file to Google Drive
    const counterBuffer = Buffer.from(JSON.stringify(counter, null, 2));
    if (counterFileId) {
      await updateFile(drive, counterFileId, counterBuffer, 'application/json');
    } else {
      await uploadFile(drive, rootFolderId, 'counter.json', counterBuffer, 'application/json');
    }

    // Respond with participant and session info
    res.json({ participantId, sessionNumber: nextSessionNumber });
  } catch (error) {
    console.error('Get next ID error:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
