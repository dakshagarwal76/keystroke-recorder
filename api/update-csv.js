const { getDriveClient, uploadFile, getFileContent, updateFile } = require('../lib/drive-client');
const { parse } = require('csv-parse/sync');
const { stringify } = require('csv-stringify/sync');

module.exports = async (req, res) => {
  // CORS headers to allow cross-origin requests
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    console.log('=== UPDATE CSV START ===');

    // Extract and validate fields from request body
    const {
      deviceId,
      participantId,
      session,
      gender,
      handedness,
      totalKeys,
      browserInfo,
      osInfo,
      typingSpeed,
      typingCategory
    } = req.body;

    if (!deviceId || !participantId || !session) {
      return res.status(400).json({ error: 'Missing required fields: deviceId, participantId, or session' });
    }

    console.log('CSV data:', {
      deviceId,
      participantId,
      session,
      totalKeys,
      typingSpeed,
      typingCategory
    });

    // Get authorized Google Drive client
    const drive = getDriveClient();
    const rootFolderId = process.env.DRIVE_FOLDER_ID;
    if (!rootFolderId) {
      return res.status(500).json({ error: 'DRIVE_FOLDER_ID environment variable not set' });
    }

    // Try to get existing 'tracking.csv' file content if available
    const fileData = await getFileContent(drive, 'tracking.csv', rootFolderId);
    let records = [];
    let csvFileId = null;

    if (fileData) {
      csvFileId = fileData.id;
      const csvContent = typeof fileData.content === 'string' ? fileData.content : fileData.content.toString();

      try {
        // Parse CSV into array of records (objects)
        records = parse(csvContent, { columns: true, skip_empty_lines: true });
        console.log('Existing records:', records.length);
      } catch (e) {
        console.log('Error parsing CSV, starting fresh:', e.message);
        records = [];
      }
    } else {
      console.log('Creating new tracking.csv file');
    }

    // Prepare new record with all fields coerced as needed
    const newRecord = {
      timestamp: new Date().toISOString(),
      deviceId,
      participantId,
      session: session.toString(),
      gender: gender || 'N/A',
      handedness: handedness || 'N/A',
      totalKeys: totalKeys !== undefined ? totalKeys.toString() : '0',
      typingSpeed: typingSpeed !== undefined ? typingSpeed.toString() : '0',
      typingCategory: typingCategory || 'N/A',
      browser: browserInfo?.name || 'Unknown',
      browserVersion: browserInfo?.version || 'Unknown',
      os: osInfo?.name || 'Unknown',
      osVersion: osInfo?.version || 'Unknown',
      deviceType: browserInfo?.deviceType || 'Unknown'
    };

    // Add new record to records array
    records.push(newRecord);
    console.log('Added new record, total records:', records.length);

    // Convert records back to CSV string content
    const csvContent = stringify(records, { header: true });
    const csvBuffer = Buffer.from(csvContent);

    // Update or create the CSV file on Google Drive
    if (csvFileId) {
      console.log('Updating existing CSV file');
      await updateFile(drive, csvFileId, csvBuffer, 'text/csv');
    } else {
      console.log('Uploading new CSV file');
      await uploadFile(drive, rootFolderId, 'tracking.csv', csvBuffer, 'text/csv');
    }

    console.log('=== UPDATE CSV SUCCESS ===');
    res.json({ success: true, recordCount: records.length });

  } catch (error) {
    console.error('=== UPDATE CSV ERROR ===');
    console.error('Error details:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
};
