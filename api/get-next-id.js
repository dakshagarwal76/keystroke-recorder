import { getDriveClient, getFileContent, uploadFile, updateFile } from '../lib/googleDriveClient';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const drive = getDriveClient();
    const rootFolderId = process.env.DRIVE_FOLDER_ID; // Your participants folder ID
    const { deviceId } = req.body;

    if (!deviceId) {
      return res.status(400).json({ error: 'Missing deviceId' });
    }

    // Load counter file from Google Drive
    const fileData = await getFileContent(drive, 'counter.json', rootFolderId);
    let counter = { lastId: 0, deviceParticipants: {} };
    let counterFileId = null;

    if (fileData) {
      counterFileId = fileData.id;
      counter = typeof fileData.content === 'string' 
        ? JSON.parse(fileData.content) 
        : fileData.content;
      if (!counter.deviceParticipants) counter.deviceParticipants = {};
    }

    // Check if this device already has a participant ID assigned
    let participantId;
    if (counter.deviceParticipants[deviceId]) {
      participantId = counter.deviceParticipants[deviceId].participantId;
    } else {
      // List all existing participant folders in the Google Drive folder
      const folderList = await drive.files.list({
        q: `'${rootFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: 'files(name)',
        spaces: 'drive',
      });

      // Extract participant IDs from folder names (e.g., U001, U004)
      const existingIds = [];
      if (folderList.data.files) {
        for (const file of folderList.data.files) {
          const match = file.name.match(/^U(\d{3})$/);
          if (match) {
            existingIds.push(parseInt(match[1], 10));
          }
        }
      }

      // Sort existing IDs numerically
      existingIds.sort((a, b) => a - b);

      // Find the first available ID (fill gaps)
      let nextId = 1;
      for (const id of existingIds) {
        if (id === nextId) {
          nextId++;
        } else if (id > nextId) {
          break; // Found a gap
        }
      }

      // Assign the next available participant ID
      participantId = `U${String(nextId).padStart(3, '0')}`;
      counter.lastId = Math.max(counter.lastId, nextId);

      // Save participant assignment for this device
      counter.deviceParticipants[deviceId] = {
        participantId,
        sessionCount: 0,
        lastAccess: new Date().toISOString(),
      };
    }

    // Increment session count on each call (page load/reload)
    counter.deviceParticipants[deviceId].sessionCount += 1;
    counter.deviceParticipants[deviceId].lastAccess = new Date().toISOString();
    const nextSessionNumber = counter.deviceParticipants[deviceId].sessionCount;

    // Save updated counter file back to Google Drive
    const counterBuffer = Buffer.from(JSON.stringify(counter, null, 2));
    if (counterFileId) {
      await updateFile(drive, counterFileId, counterBuffer, 'application/json');
    } else {
      await uploadFile(drive, rootFolderId, 'counter.json', counterBuffer, 'application/json');
    }

    // Return participant ID and session number
    res.json({ participantId, sessionNumber: nextSessionNumber });
  } catch (error) {
    console.error('Get next ID error:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
