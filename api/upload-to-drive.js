const { getDriveClient, ensureFolder, uploadFile } = require('../lib/drive-client');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  
  try {
    const { deviceId, participantId, session, gender, handedness, zipData, zipFileName, metadata } = req.body;
    
    console.log('Upload request:', { deviceId, participantId, session, zipFileName });
    
    const drive = getDriveClient();
    const rootFolderId = process.env.DRIVE_FOLDER_ID;
    
    // Create folder structure: RootFolder/DeviceID/ParticipantID/
    const deviceFolderId = await ensureFolder(drive, rootFolderId, deviceId);
    const participantFolderId = await ensureFolder(drive, deviceFolderId, participantId);
    
    // Upload ZIP file
    const zipBuffer = Buffer.from(zipData, 'base64');
    const fileName = zipFileName || `${participantId}_S${session}_${gender}_${handedness}_session_${session}.zip`;
    
    console.log('Uploading file:', fileName, 'Size:', zipBuffer.length);
    
    const uploadedFile = await uploadFile(drive, participantFolderId, fileName, zipBuffer, 'application/zip');
    
    console.log('Upload successful:', uploadedFile.id);
    
    res.json({ 
      success: true, 
      fileId: uploadedFile.id,
      webViewLink: uploadedFile.webViewLink 
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message, stack: error.stack });
  }
};
