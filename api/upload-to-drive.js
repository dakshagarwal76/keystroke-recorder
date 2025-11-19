const { getDriveClient, ensureFolder, uploadFile } = require('../lib/googleDriveClient');

export default async function handler(req, res) {
  try {
    const drive = getDriveClient();

    const { deviceId, participantId, session, gender, handedness, zipData, zipFileName } = req.body;

    if (!zipData || !zipFileName) {
      return res.status(400).json({ error: 'Missing zipData or zipFileName' });
    }

    const zipBuffer = Buffer.from(zipData, 'base64');

    // Ensure folder structure: root/deviceId/participantId
    const rootFolderId = process.env.DRIVE_FOLDER_ID;
    if (!rootFolderId) throw new Error('Missing DRIVE_FOLDER_ID env');

    const deviceFolderId = await ensureFolder(drive, rootFolderId, deviceId);
    const participantFolderId = await ensureFolder(drive, deviceFolderId, participantId);

    const result = await uploadFile(drive, participantFolderId, zipFileName, zipBuffer, 'application/zip');

    res.json({ success: true, fileId: result.id, webViewLink: result.webViewLink });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: err.message });
  }
}
