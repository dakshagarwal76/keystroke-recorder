const { google } = require('googleapis');

function getDriveClient() {
  try {
    if (!process.env.GOOGLE_SERVICE_ACCOUNT) {
      throw new Error('GOOGLE_SERVICE_ACCOUNT environment variable not set');
    }
    
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/drive.file']
    });
    
    return google.drive({ version: 'v3', auth });
  } catch (error) {
    console.error('Drive client error:', error);
    throw error;
  }
}

async function ensureFolder(drive, parentId, folderName) {
  try {
    // Check if folder exists
    const query = `name='${folderName}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    const res = await drive.files.list({ 
      q: query, 
      fields: 'files(id, name)',
      spaces: 'drive'
    });
    
    if (res.data.files && res.data.files.length > 0) {
      console.log(`Folder exists: ${folderName} (${res.data.files[0].id})`);
      return res.data.files[0].id;
    }
    
    // Create folder
    console.log(`Creating folder: ${folderName} in parent: ${parentId}`);
    const folder = await drive.files.create({
      requestBody: {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentId]
      },
      fields: 'id, name'
    });
    
    console.log(`Folder created: ${folderName} (${folder.data.id})`);
    return folder.data.id;
  } catch (error) {
    console.error(`Error ensuring folder ${folderName}:`, error);
    throw error;
  }
}

async function uploadFile(drive, folderId, fileName, buffer, mimeType) {
  try {
    const { Readable } = require('stream');
    const stream = Readable.from(buffer);
    
    console.log(`Uploading file: ${fileName} to folder: ${folderId}, size: ${buffer.length} bytes`);
    
    const res = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [folderId]
      },
      media: {
        mimeType,
        body: stream
      },
      fields: 'id, name, webViewLink, size'
    });
    
    console.log(`File uploaded successfully: ${fileName} (${res.data.id}), size: ${res.data.size}`);
    return res.data;
  } catch (error) {
    console.error(`Error uploading file ${fileName}:`, error);
    throw error;
  }
}

async function getFileContent(drive, fileName, folderId) {
  try {
    const query = `name='${fileName}' and '${folderId}' in parents and trashed=false`;
    const fileList = await drive.files.list({ 
      q: query, 
      fields: 'files(id, name)',
      spaces: 'drive'
    });
    
    if (!fileList.data.files || fileList.data.files.length === 0) {
      console.log(`File not found: ${fileName}`);
      return null;
    }
    
    const fileId = fileList.data.files[0].id;
    console.log(`Found file: ${fileName} (${fileId})`);
    
    const file = await drive.files.get({ 
      fileId, 
      alt: 'media' 
    });
    
    return { id: fileId, content: file.data };
  } catch (error) {
    console.error(`Error getting file ${fileName}:`, error);
    return null;
  }
}

async function updateFile(drive, fileId, buffer, mimeType) {
  try {
    const { Readable } = require('stream');
    const stream = Readable.from(buffer);
    
    console.log(`Updating file: ${fileId}, size: ${buffer.length} bytes`);
    
    await drive.files.update({
      fileId,
      media: {
        mimeType,
        body: stream
      }
    });
    
    console.log(`File updated successfully: ${fileId}`);
  } catch (error) {
    console.error(`Error updating file ${fileId}:`, error);
    throw error;
  }
}

module.exports = { getDriveClient, ensureFolder, uploadFile, getFileContent, updateFile };
