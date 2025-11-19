const { getDriveClient } = require('../lib/googleDriveClient');

export default async function handler(req, res) {
  try {
    const drive = getDriveClient();

    // Your payload fields: fileName, mimeType, base64Data ... replace variables accordingly
    const { zipFileName, zipData } = req.body;

    if (!zipFileName || !zipData) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const buffer = Buffer.from(zipData, 'base64');

    const uploadResult = await drive.files.create({
      requestBody: {
        name: zipFileName,
      },
      media: {
        mimeType: 'application/zip',
        body: buffer,
      },
      fields: 'id, webViewLink',
    });

    return res.json({ success: true, id: uploadResult.data.id, link: uploadResult.data.webViewLink });
  } catch (err) {
    console.error('Upload error:', err);
    return res.status(500).json({ error: err.message });
  }
}
