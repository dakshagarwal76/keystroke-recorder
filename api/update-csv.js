const { getDriveClient, uploadFile, getFileContent, updateFile } = require('../lib/drive-client');
const { parse } = require('csv-parse/sync');
const { stringify } = require('csv-stringify/sync');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  
  try {
    const { deviceId, participantId, session, gender, handedness, totalKeys, browserInfo, osInfo } = req.body;
    
    const drive = getDriveClient();
    const rootFolderId = process.env.DRIVE_FOLDER_ID;
    
    const fileData = await getFileContent(drive, 'tracking.csv', rootFolderId);
    let records = [];
    let csvFileId = null;
    
    if (fileData) {
      csvFileId = fileData.id;
      const csvContent = typeof fileData.content === 'string' ? fileData.content : fileData.content.toString();
      try {
        records = parse(csvContent, { columns: true, skip_empty_lines: true });
      } catch (e) {
        records = [];
      }
    }
    
    records.push({
      timestamp: new Date().toISOString(),
      deviceId,
      participantId,
      session,
      gender,
      handedness,
      totalKeys,
      browser: browserInfo.name,
      browserVersion: browserInfo.version,
      os: osInfo.name,
      osVersion: osInfo.version,
      deviceType: browserInfo.deviceType
    });
    
    const csvContent = stringify(records, { header: true });
    const csvBuffer = Buffer.from(csvContent);
    
    if (csvFileId) {
      await updateFile(drive, csvFileId, csvBuffer, 'text/csv');
    } else {
      await uploadFile(drive, rootFolderId, 'tracking.csv', csvBuffer, 'text/csv');
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('CSV update error:', error);
    res.status(500).json({ error: error.message });
  }
};
