const { getDriveClient, uploadFile, getFileContent, updateFile } = require('../lib/drive-client');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    console.log('=== REGISTER DEVICE START ===');
    const { deviceFingerprint, browserInfo, osInfo } = req.body;
    console.log('Device fingerprint:', deviceFingerprint);
    
    if (!process.env.DRIVE_FOLDER_ID) {
      throw new Error('DRIVE_FOLDER_ID not configured');
    }
    
    const drive = getDriveClient();
    const rootFolderId = process.env.DRIVE_FOLDER_ID;
    console.log('Root folder ID:', rootFolderId);
    
    const fileData = await getFileContent(drive, 'devices.json', rootFolderId);
    let devices = {};
    let devicesFileId = null;
    
    if (fileData) {
      devicesFileId = fileData.id;
      devices = typeof fileData.content === 'string' ? JSON.parse(fileData.content) : fileData.content;
      console.log('Loaded existing devices:', Object.keys(devices).length);
    } else {
      console.log('No existing devices.json found');
    }
    
    if (devices[deviceFingerprint]) {
      console.log('Device already exists:', devices[deviceFingerprint].deviceId);
      return res.json({ 
        deviceId: devices[deviceFingerprint].deviceId,
        isNew: false 
      });
    }
    
    const deviceId = `D${String(Object.keys(devices).length + 1).padStart(3, '0')}`;
    console.log('Creating new device:', deviceId);
    
    devices[deviceFingerprint] = {
      deviceId,
      browserInfo,
      osInfo,
      registeredAt: new Date().toISOString()
    };
    
    const devicesBuffer = Buffer.from(JSON.stringify(devices, null, 2));
    if (devicesFileId) {
      await updateFile(drive, devicesFileId, devicesBuffer, 'application/json');
    } else {
      await uploadFile(drive, rootFolderId, 'devices.json', devicesBuffer, 'application/json');
    }
    
    console.log('=== REGISTER DEVICE SUCCESS ===');
    res.json({ deviceId, isNew: true });
  } catch (error) {
    console.error('=== REGISTER DEVICE ERROR ===');
    console.error('Error details:', error);
    res.status(500).json({ 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};
