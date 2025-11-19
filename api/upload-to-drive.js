const { getDriveClient } = require('../lib/googleDriveClient');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const drive = getDriveClient();

    // Expecting file name and base64-encoded ZIP data in request body
    const { zipFileName, zipData } = req.body;

    // Validate required inputs
    if (!zipFileName || typeof zipFileName !== 'string' || zipFileName.trim() === '') {
      return res.status(400).json({ error: 'Invalid or missing zipFileName' });
    }
    if (!zipData || typeof zipData !== 'string' || zipData.trim() === '') {
      return res.status(400).json({ error: 'Invalid or missing zipData' });
    }

    // Decode base64 ZIP data to buffer
    const buffer = Buffer.from(zipData, 'base64');

    // Upload ZIP file to Google Drive root folder of authorized user
    // You can optionally specify parents to upload to specific folder
    const uploadResult = await drive.files.create({
      requestBody: {
        name: zipFileName,
        mimeType: 'application/zip',
        // Add parents: [process.env.DRIVE_FOLDER_ID], if you want to upload to a folder
      },
      media: {
        mimeType: 'application/zip',
        body: buffer,
      },
      fields: 'id, webViewLink',
    });

    // Respond with success details
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
