import { Readable } from 'stream';
import { getDriveClient } from '../lib/googleDriveClient';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const drive = getDriveClient();
    const { zipFileName, zipData } = req.body;

    if (!zipFileName || typeof zipFileName !== 'string' || zipFileName.trim() === '') {
      return res.status(400).json({ error: 'Invalid or missing zipFileName' });
    }
    if (!zipData || typeof zipData !== 'string' || zipData.trim() === '') {
      return res.status(400).json({ error: 'Invalid or missing zipData' });
    }

    // Decode base64 zip data to buffer
    const buffer = Buffer.from(zipData, 'base64');

    // Convert buffer into a readable stream for Google Drive API
    const stream = Readable.from(buffer);

    // Upload file to Google Drive root folder or specify folder via parents
    const uploadResult = await drive.files.create({
      requestBody: {
        name: zipFileName,
        // Optionally add: parents: [process.env.DRIVE_FOLDER_ID]
      },
      media: {
        mimeType: 'application/zip',
        body: stream,
      },
      fields: 'id, webViewLink',
    });

    return res.json({
      success: true,
      id: uploadResult.data.id,
      link: uploadResult.data.webViewLink,
    });
  } catch (err) {
    console.error('Upload error:', err);
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
}
