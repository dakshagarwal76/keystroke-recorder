import { getDriveClient } from '../../lib/googleDriveClient';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { deviceFingerprint } = req.body;

    if (!deviceFingerprint) {
      return res.status(400).json({ error: 'Missing device fingerprint' });
    }

    const drive = getDriveClient();
    const folderId = process.env.DRIVE_FOLDER_ID;

    if (!folderId) {
      return res.status(500).json({ error: 'DRIVE_FOLDER_ID not configured' });
    }

    const resList = await drive.files.list({
      q: `'${folderId}' in parents and name='${deviceFingerprint}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id, name)',
      spaces: 'drive',
    });

    let deviceId;

    if (resList.data.files && resList.data.files.length > 0) {
      deviceId = resList.data.files[0].id;
    } else {
      const resCreate = await drive.files.create({
        requestBody: {
          name: deviceFingerprint,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [folderId],
        },
        fields: 'id',
      });
      deviceId = resCreate.data.id;
    }

    return res.status(200).json({ deviceId });
  } catch (err) {
    console.error('Register device error:', err);
    return res.status(500).json({ error: err.message });
  }
}
