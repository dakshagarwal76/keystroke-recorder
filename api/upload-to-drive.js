import { getDriveClient, getFileContent, updateFile } from '../lib/googleDriveClient';


export const config = {
  api: {
    bodyParser: {
      sizeLimit: '50mb',
    },
  },
  maxDuration: 60,
};


// Helper function to ensure folder exists, create if not
async function ensureFolder(drive, parentId, folderName) {
  try {
    // Search for existing folder
    const query = `name='${folderName}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    const res = await drive.files.list({ 
      q: query, 
      fields: 'files(id, name)',
      spaces: 'drive'
    });
    
    if (res.data.files && res.data.files.length > 0) {
      console.log(`Folder exists: ${folderName}`);
      return res.data.files[0].id;
    }
    
    // Create folder if not exists
    console.log(`Creating folder: ${folderName}`);
    const folder = await drive.files.create({
      requestBody: {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentId]
      },
      fields: 'id'
    });
    return folder.data.id;
  } catch (err) {
    console.error(`Error ensuring folder ${folderName}:`, err);
    throw err;
  }
}

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
    const drive = getDriveClient();
    const rootFolderId = process.env.DRIVE_FOLDER_ID;
    const { 
      deviceId,
      participantId, 
      session, 
      person,
      gender, 
      handedness, 
      zipData, 
      zipFileName 
    } = req.body;

    console.log('Upload request:', {
      participantId,
      session,
      person,
      fileName: zipFileName
    });

    if (!participantId || !zipData || !zipFileName || !person || !deviceId) {
      return res.status(400).json({ error: 'Missing required fields: participantId, person, deviceId, zipData, or zipFileName' });
    }

    // Create hierarchical folder structure: U001/Person_1/Session_1/
    console.log('Creating folder structure...');
    const participantFolderId = await ensureFolder(drive, rootFolderId, participantId);
    const personFolderName = `Person_${person}`;
    const personFolderId = await ensureFolder(drive, participantFolderId, personFolderName);
    const sessionFolderName = `Session_${session}`;
    const sessionFolderId = await ensureFolder(drive, personFolderId, sessionFolderName);

    console.log(`Folder structure created: ${participantId}/${personFolderName}/${sessionFolderName}`);

    // Upload ZIP file to session folder
    const buffer = Buffer.from(zipData, 'base64');
    console.log(`Uploading file: ${zipFileName} (${buffer.length} bytes)`);
    
    const { Readable } = await import('stream');
    const uploadRes = await drive.files.create({
      requestBody: {
        name: zipFileName,
        parents: [sessionFolderId]
      },
      media: {
        mimeType: 'application/zip',
        body: Readable.from(buffer)
      },
      fields: 'id, name, webViewLink'
    });

    console.log('File uploaded successfully:', uploadRes.data.name);

    // Update counter.json to mark this person has completed a submission
    try {
      const counterData = await getFileContent(drive, 'counter.json', rootFolderId);
      if (counterData) {
        const counter = typeof counterData.content === 'string' 
          ? JSON.parse(counterData.content) 
          : counterData.content;
        
        if (counter.deviceParticipants && counter.deviceParticipants[deviceId]) {
          const participantData = counter.deviceParticipants[deviceId];
          
          // Ensure persons object exists
          if (!participantData.persons) participantData.persons = {};
          
          // Ensure this person exists in tracking
          if (!participantData.persons[person]) {
            participantData.persons[person] = { 
              sessionCount: 0, 
              completedSubmissions: 0, 
              lastAccess: null 
            };
          }
          
          // Save updated counter
          const counterBuffer = Buffer.from(JSON.stringify(counter, null, 2));
          await updateFile(drive, counterData.id, counterBuffer, 'application/json');
          console.log('Counter.json updated successfully');
          console.log('Updated counter for device:', deviceId);
          console.log('Updated person data:', participantData.persons[person]);

          // Increment completed submissions for this person
          // Increment BOTH sessionCount and completedSubmissions
          participantData.persons[person].sessionCount += 1;
          participantData.persons[person].completedSubmissions += 1;
          participantData.persons[person].lastAccess = new Date().toISOString();
          participantData.lastAccess = new Date().toISOString();


          const completedCount = participantData.persons[person].completedSubmissions;
          console.log(`Updated submissions: Person ${person} now has ${completedCount} completed submissions`);

          // Unlock next person if this person just completed their FIRST upload
          if (completedCount === 1 && parseInt(person) < 5) {
            const nextPerson = String(parseInt(person) + 1);
            if (!participantData.persons[nextPerson]) {
              participantData.persons[nextPerson] = {
                sessionCount: 0,
                completedSubmissions: 0,
                lastAccess: null
              };
              console.log(`✅ Person ${nextPerson} unlocked!`);
            }
          }

          // Save updated counter
          const counterBuffer = Buffer.from(JSON.stringify(counter, null, 2));
          await updateFile(drive, counterData.id, counterBuffer, 'application/json');
          console.log('Counter.json updated successfully');

        }
      }
    } catch (err) {
      console.error('Error updating counter.json:', err);
      // Don't fail the upload if counter update fails
    }

    res.json({ 
      success: true, 
      fileId: uploadRes.data.id,
      fileName: uploadRes.data.name,
      folder: `${participantId}/${personFolderName}/${sessionFolderName}`,
      webViewLink: uploadRes.data.webViewLink
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ 
      error: error.message || 'Internal Server Error' 
    });
  }
}
