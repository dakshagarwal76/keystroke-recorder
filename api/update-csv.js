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
    console.log('=== UPDATE CSV START ===');
    const { deviceId, participantId, session, gender, handedness, totalKeys, browserInfo, osInfo, typingSpeed, typingCategory } = req.body;
    
    console.log('CSV data:', {
      deviceId,
      participantId,
      session,
      totalKeys,
      typingSpeed,
      typingCategory
    });
    
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
        console.log('Existing records:', records.length);
      } catch (e) {
        console.log('Error parsing CSV, starting fresh:', e.message);
        records = [];
      }
    } else {
      console.log('Creating new tracking.csv');
    }
    
    const newRecord = {
      timestamp: new Date().toISOString(),
      deviceId,
      participantId,
      session: session.toString(),
      gender: gender || 'N/A',
      handedness: handedness || 'N/A',
      totalKeys: totalKeys.toString(),
      typingSpeed: (typingSpeed || 0).toString(),
      typingCategory: typingCategory || 'N/A',
      browser: browserInfo.name,
      browserVersion: browserInfo.version,
      os: osInfo.name,
      osVersion: osInfo.version,
      deviceType: browserInfo.deviceType
    };
    
    records.push(newRecord);
    console.log('Added new record, total records:', records.length);
    
    const csvContent = stringify(records, { header: true });
    const csvBuffer = Buffer.from(csvContent);
    
    if (csvFileId) {
      console.log('Updating existing CSV');
      await updateFile(drive, csvFileId, csvBuffer, 'text/csv');
    } else {
      console.log('Creating new CSV file');
      await uploadFile(drive, rootFolderId, 'tracking.csv', csvBuffer, 'text/csv');
    }
    
    console.log('=== UPDATE CSV SUCCESS ===');
    res.json({ success: true, recordCount: records.length });
  } catch (error) {
    console.error('=== UPDATE CSV ERROR ===');
    console.error('Error details:', error);
    res.status(500).json({ error: error.message });
  }
};
