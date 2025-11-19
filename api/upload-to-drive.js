const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

export default async function handler(req, res) {
  try {
    // Read refresh_token from /tmp -- replace with Edge Config or env for persistence
    const refresh_token = fs.readFileSync('/tmp/refresh_token.txt', 'utf8').trim();

    const oauth2Client = new google.auth.OAuth2(
      process.env.CLIENT_ID,
      process.env.CLIENT_SECRET,
      process.env.OAUTH_REDIRECT_URI
    );
    oauth2Client.setCredentials({ refresh_token });

    // Init Drive client
    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    // Data from frontend
    const { fileName, mimeType, zipData, folderId } = req.body;

    if (!fileName || !zipData || !mimeType) {
      res.status(400).json({ error: 'Missing fileName, mimeType, or zipData' });
      return;
    }

    // Decode base64 data
    const fileBuffer = Buffer.from(zipData, 'base64');

    // Upload file to Drive
    const uploadRes = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: folderId ? [folderId] : undefined, // If uploading to a specific folder
      },
      media: {
        mimeType,
        body: fileBuffer
      },
      fields: 'id, name, webViewLink'
    });

    res.json({
      success: true,
      id: uploadRes.data.id,
      name: uploadRes.data.name,
      webViewLink: uploadRes.data.webViewLink
    });
  } catch (error) {
    console.error('Drive upload error:', error.message);
    res.status(500).json({ error: error.message });
  }
}
