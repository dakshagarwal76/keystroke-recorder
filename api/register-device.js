const { getDriveClient, ensureFolder, uploadFile, getFileContent, updateFile } = require('../lib/drive-client');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const { deviceFingerprint, browserInfo, osInfo } = req.body;
    
    const drive = getDriveClient();
    const rootFolderId = process.env.DRIVE_FOLDER_ID;
    
    const fileData = await getFileContent(drive, 'devices.json', rootFolderId);
    let devices = {};
    let devicesFileId = null;
    
    if (fileData) {
      devicesFileId = fileData.id;
      devices = typeof fileData.content === 'string' ? JSON.parse(fileData.content) : fileData.content;
    }
    
    if (devices[deviceFingerprint]) {
      return res.json({ 
        deviceId: devices[deviceFingerprint].deviceId,
        isNew: false 
      });
    }
    
    const deviceId = `D${String(Object.keys(devices).length + 1).padStart(3, '0')}`;
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
    
    await ensureFolder(drive, rootFolderId, deviceId);
    
    res.json({ deviceId, isNew: true });
  } catch (error) {
    console.error('Device registration error:', error);
    res.status(500).json({ error: error.message });
  }
};
