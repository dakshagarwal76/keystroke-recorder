import { google } from 'googleapis';
import { Readable } from 'stream';
import fs from 'fs';
import path from 'path';
import os from 'os';

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

  let tempFilePath = null;

  try {
    const { 
      chunkData, 
      chunkIndex, 
      totalChunks, 
      sessionId, 
      fileName,
      isLast 
    } = req.body;

    if (!chunkData || chunkIndex === undefined || !totalChunks || !sessionId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    console.log(`[${sessionId}] Chunk ${chunkIndex + 1}/${totalChunks} received`);

    // Create temp directory for this session
    const tempDir = path.join(os.tmpdir(), 'uploads', sessionId);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Save this chunk to a temp file
    const chunkFilePath = path.join(tempDir, `chunk_${chunkIndex}.txt`);
    fs.writeFileSync(chunkFilePath, chunkData);
    console.log(`[${sessionId}] Chunk ${chunkIndex} saved to temp file`);

    // Count how many chunks we have now
    const chunkFiles = fs.readdirSync(tempDir).filter(f => f.startsWith('chunk_'));
    const receivedCount = chunkFiles.length;
    console.log(`[${sessionId}] Total chunks on disk: ${receivedCount}/${totalChunks}`);

    // If this is the last chunk AND we have all chunks, upload
    if (isLast && receivedCount === totalChunks) {
      console.log(`[${sessionId}] All chunks present! Combining and uploading...`);

      // Read and combine all chunks in order
      const chunksArray = [];
      for (let i = 0; i < totalChunks; i++) {
        const chunkPath = path.join(tempDir, `chunk_${i}.txt`);
        if (!fs.existsSync(chunkPath)) {
          throw new Error(`Missing chunk ${i}`);
        }
        const chunkContent = fs.readFileSync(chunkPath, 'utf8');
        chunksArray.push(chunkContent);
      }

      const fullBase64 = chunksArray.join('');
      console.log(`[${sessionId}] Combined size: ${(fullBase64.length / 1024 / 1024).toFixed(2)} MB`);
      
      // Convert to buffer
      const buffer = Buffer.from(fullBase64, 'base64');
      
      // Write combined file to temp location
      tempFilePath = path.join(os.tmpdir(), `${sessionId}.zip`);
      fs.writeFileSync(tempFilePath, buffer);
      console.log(`[${sessionId}] Temp file created: ${tempFilePath}`);
      
      // Get Drive client
      const { getDriveClient } = await import('../lib/googleDriveClient.js');
      const drive = getDriveClient();
      const rootFolderId = process.env.DRIVE_FOLDER_ID;
      
      console.log(`[${sessionId}] Uploading to Drive folder: ${rootFolderId}`);

      // Upload using file stream
      const response = await drive.files.create({
        requestBody: {
          name: fileName,
          parents: [rootFolderId],
        },
        media: {
          mimeType: 'application/zip',
          body: fs.createReadStream(tempFilePath),
        },
        fields: 'id, name, webViewLink',
      });

      console.log(`[${sessionId}] ✅ Upload successful! File ID: ${response.data.id}`);

      // Clean up temp files
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
        if (tempFilePath && fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      } catch (cleanupErr) {
        console.error('Cleanup error:', cleanupErr);
      }

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
      chunksReceived: receivedCount,
      totalChunks: totalChunks
    });

  } catch (error) {
    console.error('❌ Upload error:', error);
    
    // Clean up on error
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
      } catch (e) {}
    }
    
    return res.status(500).json({
      success: false,
      error: error.message || 'Upload failed',
      details: error.toString()
    });
  }
}
