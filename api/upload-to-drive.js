const { getDriveClient, ensureFolder, uploadFile } = require('../lib/drive-client');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  
  try {
    console.log('=== UPLOAD TO DRIVE START ===');
    const { deviceId, participantId, session, gender, handedness, zipData, zipFileName } = req.body;
    
    console.log('Upload params:', {
      deviceId,
      participantId,
      session,
      gender,
      handedness,
      zipFileName,
      zipDataLength: zipData ? zipData.length : 0
    });
    
    if (!zipData) {
      throw new Error('No ZIP data provided');
    }
    
    const drive = getDriveClient();
    const rootFolderId = process.env.DRIVE_FOLDER_ID;
    
    console.log('Creating folder structure...');
    const deviceFolderId = await ensureFolder(drive, rootFolderId, deviceId);
    const participantFolderId = await ensureFolder(drive, deviceFolderId, participantId);
    
    const zipBuffer = Buffer.from(zipData, 'base64');
    console.log('ZIP buffer size:', zipBuffer.length);
    
    const fileName = zipFileName || `${participantId}_S${session}_${gender}_${handedness}.zip`;
    console.log('Final filename:', fileName);
    
    const uploadedFile = await uploadFile(drive, participantFolderId, fileName, zipBuffer, 'application/zip');
    
    console.log('=== UPLOAD TO DRIVE SUCCESS ===');
    console.log('File ID:', uploadedFile.id);
    
    res.json({ 
      success: true, 
      fileId: uploadedFile.id,
      webViewLink: uploadedFile.webViewLink,
      fileName
    });
  } catch (error) {
    console.error('=== UPLOAD TO DRIVE ERROR ===');
    console.error('Error details:', error);
    res.status(500).json({ 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};
