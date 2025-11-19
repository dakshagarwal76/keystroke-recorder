import { getDriveClient, getFileContent, uploadFile, updateFile } from '../lib/googleDriveClient';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const drive = getDriveClient();
    const rootFolderId = process.env.DRIVE_FOLDER_ID;
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

    // Validate required fields
    if (!deviceId || !participantId || !session) {
      return res.status(400).json({ error: 'Missing required fields: deviceId, participantId, session' });
    }
    
    // Check for CSV file
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

    // Prepare new record
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

    records.push(newRecord);

    // Convert records to CSV string with header
    const csvContentOut = stringify(records, { header: true });
    const csvBuffer = Buffer.from(csvContentOut);

    if (csvFileId) {
      await updateFile(drive, csvFileId, csvBuffer, 'text/csv');
    } else {
      await uploadFile(drive, rootFolderId, 'tracking.csv', csvBuffer, 'text/csv');
    }

    res.json({ success: true, recordCount: records.length });
  } catch (error) {
    console.error('=== UPDATE CSV ERROR ===');
    console.error('Error details:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
