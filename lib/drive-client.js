const { google } = require('googleapis');

function getDriveClient() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive.file']
  });
  return google.drive({ version: 'v3', auth });
}

async function ensureFolder(drive, parentId, folderName) {
  const query = `name='${folderName}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const res = await drive.files.list({ q: query, fields: 'files(id, name)' });
  
  if (res.data.files.length > 0) {
    return res.data.files[0].id;
  }
  
  const folder = await drive.files.create({
    requestBody: {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId]
    },
    fields: 'id'
  });
  
  return folder.data.id;
}

async function uploadFile(drive, folderId, fileName, buffer, mimeType) {
  const { Readable } = require('stream');
  const stream = Readable.from(buffer);
  
  const res = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [folderId]
    },
    media: {
      mimeType,
      body: stream
    },
    fields: 'id, webViewLink'
  });
  
  return res.data;
}

async function getFileContent(drive, fileName, folderId) {
  const query = `name='${fileName}' and '${folderId}' in parents and trashed=false`;
  const fileList = await drive.files.list({ q: query, fields: 'files(id)' });
  
  if (fileList.data.files.length === 0) {
    return null;
  }
  
  const fileId = fileList.data.files[0].id;
  const file = await drive.files.get({ fileId, alt: 'media' });
  return { id: fileId, content: file.data };
}

async function updateFile(drive, fileId, buffer, mimeType) {
  const { Readable } = require('stream');
  const stream = Readable.from(buffer);
  
  await drive.files.update({
    fileId,
    media: {
      mimeType,
      body: stream
    }
  });
}

module.exports = { getDriveClient, ensureFolder, uploadFile, getFileContent, updateFile };
