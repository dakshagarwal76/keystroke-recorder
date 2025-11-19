import { google } from 'googleapis';
import { Readable } from 'stream';

export function getDriveClient() {
  if (
    !process.env.CLIENT_ID ||
    !process.env.CLIENT_SECRET ||
    !process.env.OAUTH_REDIRECT_URI ||
    !process.env.REFRESH_TOKEN
  ) {
    throw new Error(
      'Missing one or more required OAuth2 environment variables: CLIENT_ID, CLIENT_SECRET, OAUTH_REDIRECT_URI, REFRESH_TOKEN'
    );
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.CLIENT_ID,
    process.env.CLIENT_SECRET,
    process.env.OAUTH_REDIRECT_URI
  );

  oauth2Client.setCredentials({
    refresh_token: process.env.REFRESH_TOKEN,
  });

  return google.drive({ version: 'v3', auth: oauth2Client });
}

export async function ensureFolder(drive, parentId, folderName) {
  try {
    const query = `name='${folderName}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    const res = await drive.files.list({
      q: query,
      fields: 'files(id, name)',
      spaces: 'drive',
    });

    if (res.data.files && res.data.files.length > 0) {
      console.log(`Folder exists: ${folderName} (${res.data.files[0].id})`);
      return res.data.files[0].id;
    }

    console.log(`Creating folder: ${folderName} in parent: ${parentId}`);
    const folder = await drive.files.create({
      requestBody: {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentId],
      },
      fields: 'id, name',
    });

    console.log(`Folder created: ${folderName} (${folder.data.id})`);
    return folder.data.id;
  } catch (error) {
    console.error(`Error ensuring folder ${folderName}:`, error);
    throw error;
  }
}

export async function uploadFile(drive, folderId, fileName, buffer, mimeType) {
  try {
    const stream = Readable.from(buffer);

    console.log(`Uploading file: ${fileName} to folder: ${folderId}, size: ${buffer.length} bytes`);

    const res = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [folderId],
      },
      media: {
        mimeType,
        body: stream,
      },
      fields: 'id, name, webViewLink, size',
    });

    console.log(`File uploaded successfully: ${fileName} (${res.data.id}), size: ${res.data.size}`);
    return res.data;
  } catch (error) {
    console.error(`Error uploading file ${fileName}:`, error);
    throw error;
  }
}

export async function getFileContent(drive, fileName, folderId) {
  try {
    const query = `name='${fileName}' and '${folderId}' in parents and trashed=false`;
    const fileList = await drive.files.list({
      q: query,
      fields: 'files(id, name)',
      spaces: 'drive',
    });

    if (!fileList.data.files || fileList.data.files.length === 0) {
      console.log(`File not found: ${fileName}`);
      return null;
    }

    const fileId = fileList.data.files[0].id;
    console.log(`Found file: ${fileName} (${fileId})`);

    const file = await drive.files.get({
      fileId,
      alt: 'media',
    });

    return { id: fileId, content: file.data };
  } catch (error) {
    console.error(`Error getting file ${fileName}:`, error);
    return null;
  }
}

export async function updateFile(drive, fileId, buffer, mimeType) {
  try {
    const stream = Readable.from(buffer);

    console.log(`Updating file: ${fileId}, size: ${buffer.length} bytes`);

    await drive.files.update({
      fileId,
      media: {
        mimeType,
        body: stream,
      },
    });

    console.log(`File updated successfully: ${fileId}`);
  } catch (error) {
    console.error(`Error updating file ${fileId}:`, error);
    throw error;
  }
}
