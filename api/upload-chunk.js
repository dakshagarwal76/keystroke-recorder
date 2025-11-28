import { google } from 'googleapis';
import { Readable } from 'stream';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '4mb',
    },
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { 
      chunkData, 
      chunkIndex, 
      totalChunks, 
      sessionId, 
      fileName,
      deviceId,
      participantId,
      session,
      person,
      gender,
      handedness,
      isLast 
    } = req.body;

    if (!chunkData || chunkIndex === undefined || !totalChunks || !sessionId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    console.log(`[${sessionId}] Received chunk ${chunkIndex + 1}/${totalChunks}`);

    // Initialize session storage
    global.uploadSessions = global.uploadSessions || {};
    
    if (!global.uploadSessions[sessionId]) {
      global.uploadSessions[sessionId] = {
        chunks: new Array(totalChunks).fill(null), // Initialize with nulls
        fileName: fileName,
        totalChunks: totalChunks,
        metadata: {
          deviceId,
          participantId,
          session,
          person,
          gender,
          handedness
        }
      };
      console.log(`[${sessionId}] New upload session created`);
    }

    // Store chunk at the correct index
    global.uploadSessions[sessionId].chunks[chunkIndex] = chunkData;

    // Count ACTUAL received chunks (non-null)
    const receivedChunks = global.uploadSessions[sessionId].chunks.filter(c => c !== null && c !== undefined).length;
    console.log(`[${sessionId}] Chunks received: ${receivedChunks}/${totalChunks}`);

    // If this is the last chunk AND all chunks are received, upload to Drive
    if (isLast && receivedChunks === totalChunks) {
      console.log(`[${sessionId}] All chunks received! Combining and uploading...`);

      // Combine all chunks
      const fullBase64 = global.uploadSessions[sessionId].chunks.join('');
      console.log(`[${sessionId}] Combined file size: ${(fullBase64.length / 1024 / 1024).toFixed(2)} MB`);
      
      // Convert base64 to buffer
      const buffer = Buffer.from(fullBase64, 'base64');
      console.log(`[${sessionId}] Buffer created, size: ${(buffer.length / 1024 / 1024).toFixed(2)} MB`);
      
      // Create a readable stream from buffer
      const bufferStream = new Readable();
      bufferStream.push(buffer);
      bufferStream.push(null); // Signal end of stream
      
      // Import getDriveClient
      const { getDriveClient } = await import('../lib/googleDriveClient.js');
      const drive = getDriveClient();
      
      // Get root folder ID
      const rootFolderId = process.env.DRIVE_FOLDER_ID;
      
      // Upload to Google Drive with stream
      const fileMetadata = {
        name: fileName,
        parents: [rootFolderId],
      };

      const media = {
        mimeType: 'application/zip',
        body: bufferStream,
      };

      console.log(`[${sessionId}] Uploading to Google Drive...`);
      const response = await drive.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: 'id, name, webViewLink',
      });

      // Clean up session
      delete global.uploadSessions[sessionId];

      console.log(`[${sessionId}] Upload successful! File ID: ${response.data.id}`);

      return res.status(200).json({
        success: true,
        fileId: response.data.id,
        fileName: response.data.name,
        webViewLink: response.data.webViewLink,
        message: 'File uploaded successfully to Google Drive'
      });
    }

    return res.status(200).json({
      success: true,
      message: `Chunk ${chunkIndex + 1}/${totalChunks} received`,
      chunksReceived: receivedChunks,
      totalChunks: totalChunks
    });

  } catch (error) {
    console.error('Chunk upload error:', error);
    console.error('Error details:', error.message);
    console.error('Error stack:', error.stack);
    return res.status(500).json({
      success: false,
      error: error.message || 'Upload failed',
      details: error.toString()
    });
  }
}
