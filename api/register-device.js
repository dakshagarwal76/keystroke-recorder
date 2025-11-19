import { google } from 'googleapis';

// Helper function to get authorized Drive client using OAuth2 refresh token
function getDriveClient() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.CLIENT_ID,
    process.env.CLIENT_SECRET,
    process.env.OAUTH_REDIRECT_URI
  );

  oauth2Client.setCredentials({
    refresh_token: process.env.REFRESH_TOKEN,
  });

  return google.drive({ version: 'v3', auth: oauth2Client });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { deviceFingerprint, browserInfo, osInfo } = req.body;

    // Validate input
    if (!deviceFingerprint) {
      return res.status(400).json({ error: 'Missing device fingerprint' });
    }

    const drive = getDriveClient();

    const folderId = process.env.DRIVE_FOLDER_ID;

    if (!folderId) {
      return res.status(500).json({ error: 'DRIVE_FOLDER_ID not configured' });
    }

    // Here, for demonstration, we register a device by creating a file/folder named with fingerprint
    // Adjust this logic depending on how your app manages devices

    // Check if a folder/file with the fingerprint name already exists (optional)
    const searchResponse = await drive.files.list({
      q: `'${folderId}' in parents and name='${deviceFingerprint}' and trashed=false`,
      fields: 'files(id, name)',
      spaces: 'drive',
    });

    let deviceId;

    if (searchResponse.data.files.length > 0) {
      // Device already registered
      deviceId = searchResponse.data.files[0].id;
    } else {
      // Create a new folder for the device fingerprint
      const createResponse = await drive.files.create({
        requestBody: {
          name: deviceFingerprint,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [folderId],
        },
        fields: 'id',
      });
      deviceId = createResponse.data.id;
    }

    return res.status(200).json({ deviceId });
  } catch (error) {
    console.error('Register device error:', error);
    return res.status(500).json({ error: error.message });
  }
}
