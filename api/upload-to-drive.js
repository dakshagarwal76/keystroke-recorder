const { getDriveClient, ensureFolder, uploadFile } = require('../lib/drive-client');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  
  try {
    const { deviceId, participantId, session, gender, handedness, zipData, metadata } = req.body;
    
    const drive = getDriveClient();
    const rootFolderId = process.env.DRIVE_FOLDER_ID;
    
    const deviceFolderId = await ensureFolder(drive, rootFolderId, deviceId);
    const participantFolderId = await ensureFolder(drive, deviceFolderId, participantId);
    
    const zipBuffer = Buffer.from(zipData, 'base64');
    const zipFileName = `${participantId}_S${session}_${gender}_${handedness}_session_${session}.zip`;
    const uploadedFile = await uploadFile(drive, participantFolderId, zipFileName, zipBuffer, 'application/zip');
    
    res.json({ 
      success: true, 
      fileId: uploadedFile.id,
      webViewLink: uploadedFile.webViewLink 
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message });
  }
};
