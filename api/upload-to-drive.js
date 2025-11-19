import { Readable } from 'stream';
import { getDriveClient, ensureFolder } from '../lib/googleDriveClient';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const drive = getDriveClient();
    // Expect: participantId (e.g., U001), session (number), zipFileName, zipData
    const { participantId, session, zipFileName, zipData } = req.body;

    if (!participantId || typeof participantId !== 'string' || participantId.trim() === '') {
      return res.status(400).json({ error: 'Invalid or missing participantId' });
    }
    if (!session || isNaN(Number(session))) {
      return res.status(400).json({ error: 'Invalid or missing session' });
    }
    if (!zipFileName || typeof zipFileName !== 'string' || zipFileName.trim() === '') {
      return res.status(400).json({ error: 'Invalid or missing zipFileName' });
    }
    if (!zipData || typeof zipData !== 'string' || zipData.trim() === '') {
      return res.status(400).json({ error: 'Invalid or missing zipData' });
    }

    // Your root Google Drive folder for participants
    const participantsFolderId = "1V3JP_oAztX6coqxCvGFqAIJ63BJTzrPm";

    // Ensure participant folder exists under participants/
    const participantFolderId = await ensureFolder(drive, participantsFolderId, participantId);

    // Ensure session folder exists under participant/
    const sessionFolderName = `session_${String(session).padStart(2, '0')}`;
    const sessionFolderId = await ensureFolder(drive, participantFolderId, sessionFolderName);

    // Convert base64 ZIP data to stream
    const buffer = Buffer.from(zipData, 'base64');
    const stream = Readable.from(buffer);

    // Upload the ZIP file to session folder
    const uploadResult = await drive.files.create({
      requestBody: {
        name: zipFileName,
        parents: [sessionFolderId],
        mimeType: 'application/zip',
      },
      media: {
        mimeType: 'application/zip',
        body: stream,
      },
      fields: 'id, name, webViewLink',
    });

    return res.json({
      success: true,
      id: uploadResult.data.id,
      name: uploadResult.data.name,
      link: uploadResult.data.webViewLink || null,
    });
  } catch (err) {
    console.error('Upload error:', err);
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
}
