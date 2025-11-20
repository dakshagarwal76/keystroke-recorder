import { getDriveClient, getFileContent, uploadFile, updateFile } from '../lib/googleDriveClient';

export default async function handler(req, res) {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

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
    if (!deviceId || !participantId || !session || !person) {
      console.error('Missing required fields');
      return res.status(400).json({ 
        error: 'Missing required fields: deviceId, participantId, session, or person' 
      });
    }

    console.log('CSV data received:', {
      deviceId,
      participantId,
      session,
      person,
      totalKeys,
      typingSpeed,
      typingCategory
    });

    // Try to get existing CSV file
    let csvFileId = null;
    let csvContent = '';
    
    try {
      const fileData = await getFileContent(drive, 'tracking.csv', rootFolderId);
      if (fileData) {
        csvFileId = fileData.id;
        csvContent = typeof fileData.content === 'string' 
          ? fileData.content 
          : fileData.content.toString();
        console.log('Existing CSV found, size:', csvContent.length);
      }
    } catch (err) {
      console.log('No existing CSV file, will create new one');
    }

    // Parse existing CSV or create header
    let lines = [];
    const header = 'timestamp,deviceId,participantId,session,person,gender,handedness,totalKeys,typingSpeed,typingCategory,browser,browserVersion,os,osVersion,deviceType';
    
    if (csvContent) {
      lines = csvContent.split('\n').filter(line => line.trim() !== '');
      console.log('Existing lines:', lines.length);
    } else {
      lines.push(header);
      console.log('Creating new CSV with header');
    }

    // Prepare new record
    const newRecord = [
      new Date().toISOString(),
      deviceId || '',
      participantId || '',
      session?.toString() || '',
      person?.toString() || '',
      gender || 'N/A',
      handedness || 'N/A',
      totalKeys !== undefined ? totalKeys.toString() : '0',
      typingSpeed !== undefined ? typingSpeed.toString() : '0',
      typingCategory || 'N/A',
      browserInfo?.name || 'Unknown',
      browserInfo?.version || 'Unknown',
      osInfo?.name || 'Unknown',
      osInfo?.version || 'Unknown',
      browserInfo?.deviceType || 'Unknown'
    ].join(',');

    // Add new record
    lines.push(newRecord);
    console.log('Added new record, total lines:', lines.length);

    // Convert back to CSV string
    const newCsvContent = lines.join('\n') + '\n';
    const csvBuffer = Buffer.from(newCsvContent, 'utf-8');

    // Update existing file or create new one
    if (csvFileId) {
      console.log('Updating existing CSV file');
      await updateFile(drive, csvFileId, csvBuffer, 'text/csv');
    } else {
      console.log('Creating new CSV file');
      await uploadFile(drive, rootFolderId, 'tracking.csv', csvBuffer, 'text/csv');
    }

    console.log('=== UPDATE CSV SUCCESS ===');
    res.json({ 
      success: true, 
      recordCount: lines.length - 1, // minus header
      message: 'CSV updated successfully'
    });
  } catch (error) {
    console.error('=== UPDATE CSV ERROR ===');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      error: error.message || 'Internal Server Error',
      details: error.toString()
    });
  }
}
