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
    const { deviceId, participantId, session, gender, handedness, totalKeys, browserInfo, osInfo, typingSpeed, typingCategory } = req.body;
    
    const drive = getDriveClient();
    const rootFolderId = process.env.DRIVE_FOLDER_ID;
    
    // Get tracking.csv from ROOT directory
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
    
    // Add new record
    records.push({
      timestamp: new Date().toISOString(),
      deviceId,
      participantId,
      session,
      gender,
      handedness,
      totalKeys,
      typingSpeed: typingSpeed || 0,
      typingCategory: typingCategory || 'N/A',
      browser: browserInfo.name,
      browserVersion: browserInfo.version,
      os: osInfo.name,
      osVersion: osInfo.version,
      deviceType: browserInfo.deviceType
    });
    
    // Convert to CSV
    const csvContent = stringify(records, { header: true });
    const csvBuffer = Buffer.from(csvContent);
    
    // Update or create CSV in ROOT
    if (csvFileId) {
      await updateFile(drive, csvFileId, csvBuffer, 'text/csv');
    } else {
      await uploadFile(drive, rootFolderId, 'tracking.csv', csvBuffer, 'text/csv');
    }
    
    res.json({ success: true, recordCount: records.length });
  } catch (error) {
    console.error('CSV update error:', error);
    res.status(500).json({ error: error.message });
  }
};
