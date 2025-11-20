import { getDriveClient, getFileContent, uploadFile, updateFile } from '../lib/googleDriveClient';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('=== UPDATE CSV START ===');
    
    const drive = getDriveClient();
    const rootFolderId = process.env.DRIVE_FOLDER_ID;
    
    const {
      deviceId,
      participantId,
      session,
      person,
      gender,
      handedness,
      totalKeys,
      browserInfo,
      osInfo,
      typingSpeed,
      typingCategory
    } = req.body;

    // Validate required fields
    if (!deviceId || !participantId || !session) {
      return res.status(400).json({ error: 'Missing required fields: deviceId, participantId, or session' });
    }

    console.log('CSV data:', {
      deviceId,
      participantId,
      session,
      person,
      totalKeys,
      typingSpeed,
      typingCategory
    });

    // Try to get existing CSV file
    const fileData = await getFileContent(drive, 'tracking.csv', rootFolderId);
    let records = [];
    let csvFileId = null;

    if (fileData) {
      csvFileId = fileData.id;
      const csvContent = typeof fileData.content === 'string' 
        ? fileData.content 
        : fileData.content.toString();
      
      try {
        // Parse existing CSV
        records = parse(csvContent, { columns: true, skip_empty_lines: true });
        console.log('Existing records:', records.length);
      } catch (e) {
        console.log('Error parsing CSV, starting fresh:', e.message);
        records = [];
      }
    } else {
      console.log('CSV file not found, will create new one');
    }

    // Prepare new record
    const newRecord = {
      timestamp: new Date().toISOString(),
      deviceId,
      participantId,
      session: session.toString(),
      person: person || 'N/A',
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

    // Convert records array back to CSV string with header
    const csvContent = stringify(records, { header: true });
    const csvBuffer = Buffer.from(csvContent);

    // Update existing file or create new one
    if (csvFileId) {
      console.log('Updating existing CSV file');
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
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
