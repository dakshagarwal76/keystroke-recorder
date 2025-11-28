import { google } from 'googleapis';
import { Readable } from 'stream';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '4mb',
    },
  },
};

// Use Map for better chunk storage
const uploadSessions = new Map();

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

    console.log(`[${sessionId}] Received chunk ${chunkIndex + 1}/${totalChunks}, size: ${chunkData.length} chars`);

    // Get or create session
    if (!uploadSessions.has(sessionId)) {
      const newSession = {
        chunks: {},  // Use object instead of array for better tracking
        receivedCount: 0,
        fileName: fileName,
        totalChunks: totalChunks,
        metadata: { deviceId, participantId, session, person, gender, handedness }
      };
      uploadSessions.set(sessionId, newSession);
      console.log(`[${sessionId}] New session created`);
    }

    const sessionData = uploadSessions.get(sessionId);
    
    // Store chunk if not already stored
    if (!sessionData.chunks[chunkIndex]) {
      sessionData.chunks[chunkIndex] = chunkData;
      sessionData.receivedCount++;
      console.log(`[${sessionId}] Chunk ${chunkIndex} stored. Total received: ${sessionData.receivedCount}/${totalChunks}`);
    } else {
      console.log(`[${sessionId}] Chunk ${chunkIndex} already exists, skipping`);
    }

    const receivedChunks = sessionData.receivedCount;

    // Check if all chunks are received
    if (isLast && receivedChunks === totalChunks) {
      console.log(`[${sessionId}] All ${totalChunks} chunks received! Combining and uploading...`);

      // Combine chunks in correct order
      const chunksArray = [];
      for (let i = 0; i < totalChunks; i++) {
        if (!sessionData.chunks[i]) {
          console.error(`[${sessionId}] Missing chunk ${i}!`);
          return res.status(400).json({
            success: false,
            error: `Missing chunk ${i}`,
            receivedChunks: receivedChunks,
            totalChunks: totalChunks
          });
        }
        chunksArray.push(sessionData.chunks[i]);
      }

      const fullBase64 = chunksArray.join('');
      console.log(`[${sessionId}] Combined size: ${(fullBase64.length / 1024 / 1024).toFixed(2)} MB`);
      
      // Convert to buffer
      const buffer = Buffer.from(fullBase64, 'base64');
      console.log(`[${sessionId}] Buffer size: ${(buffer.length / 1024 / 1024).toFixed(2)} MB`);
      
      // Create readable stream
      const bufferStream = new Readable();
      bufferStream.push(buffer);
      bufferStream.push(null);
      
      // Get Drive client
      const { getDriveClient } = await import('../lib/googleDriveClient.js');
      const drive = getDriveClient();
      const rootFolderId = process.env.DRIVE_FOLDER_ID;
      
      if (!rootFolderId) {
        throw new Error('DRIVE_FOLDER_ID environment variable not set');
      }

      console.log(`[${sessionId}] Uploading to Drive folder: ${rootFolderId}`);

      // Upload to Google Drive
      const response = await drive.files.create({
        requestBody: {
          name: fileName,
          parents: [rootFolderId],
        },
        media: {
          mimeType: 'application/zip',
          body: bufferStream,
        },
        fields: 'id, name, webViewLink',
      });

      // Clean up session
      uploadSessions.delete(sessionId);

      console.log(`[${sessionId}] ✅ Upload successful! File ID: ${response.data.id}`);

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
    console.error('❌ Chunk upload error:', error);
    console.error('Error details:', error.message);
    console.error('Error stack:', error.stack);
    return res.status(500).json({
      success: false,
      error: error.message || 'Upload failed',
      details: error.toString()
    });
  }
}
